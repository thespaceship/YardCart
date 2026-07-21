import Link from "next/link";
import { notFound } from "next/navigation";
import { requireYardUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { meetsPlan } from "@/lib/entitlements";
import { formatCents, unitLabel } from "@/lib/money";
import {
  scheduleOrder,
  setOrderStatus,
  setPaymentStatus,
  saveInternalNotes,
} from "@/app/actions/orders";
import StatusBadge from "@/components/StatusBadge";

export const metadata = { title: "Order" };

export default async function OrderDetailPage(props: { params: Promise<{ id: string }> }) {
  const ctx = await requireYardUser();
  const { id } = await props.params;
  const order = await db.order.findUnique({
    where: { id },
    include: { items: true, truck: true, zone: true },
  });
  if (!order || order.yardId !== ctx.yard.id) notFound();

  const isPro = meetsPlan(ctx.yard, "PRO"); // dispatch scheduling + printable tickets are Pro
  const trucks = await db.truck.findMany({ where: { yardId: ctx.yard.id, active: true } });
  const defaultDate = (order.scheduledDate ?? order.requestedDate ?? new Date())
    .toISOString()
    .slice(0, 10);

  return (
    <div className="stack">
      <div className="spread">
        <div>
          <Link className="muted" href="/app/orders">
            ← Orders
          </Link>
          <h1 style={{ margin: "4px 0 0" }}>
            Order #{order.number} <StatusBadge status={order.status} />
          </h1>
          <p className="muted" style={{ margin: "4px 0 0" }}>
            {order.channel === "PHONE" ? "Phone order" : "Online order"} ·{" "}
            {order.createdAt.toLocaleString("en-US")}
          </p>
        </div>
        {isPro && (
          <div style={{ display: "flex", gap: 8 }}>
            <a className="btn secondary" href={`/app/orders/${order.id}/ticket`} target="_blank">
              Print ticket
            </a>
          </div>
        )}
      </div>

      <div className="grid2">
        <div className="card">
          <h3>Customer</h3>
          <p>
            <strong>{order.customerName}</strong>
            <br />
            <a href={`tel:${order.customerPhone}`}>{order.customerPhone}</a>
            {order.customerEmail && (
              <>
                <br />
                {order.customerEmail}
              </>
            )}
          </p>
          <h3>Delivery address</h3>
          <p>
            {order.addressLine}
            <br />
            {order.city && `${order.city}, `}
            {order.zip} {order.zone && <span className="badge neutral">{order.zone.name}</span>}
          </p>
          {order.placementNotes && (
            <>
              <h3>Placement instructions</h3>
              <p>{order.placementNotes}</p>
            </>
          )}
        </div>

        <div className="card">
          <h3>Items</h3>
          <table>
            <tbody>
              {order.items.map((i) => (
                <tr key={i.id}>
                  <td>
                    {i.nameSnap}
                    <span className="muted">
                      {" "}
                      — {i.qty} {unitLabel(i.unitSnap)} × {formatCents(i.unitCents)}
                    </span>
                  </td>
                  <td className="right">{formatCents(i.totalCents)}</td>
                </tr>
              ))}
              <tr>
                <td>Delivery fee</td>
                <td className="right">{formatCents(order.deliveryCents)}</td>
              </tr>
              <tr>
                <td>
                  <strong>Total</strong>
                </td>
                <td className="right">
                  <strong>{formatCents(order.totalCents)}</strong>
                </td>
              </tr>
            </tbody>
          </table>

          <h3 style={{ marginTop: 16 }}>Payment</h3>
          <form action={setPaymentStatus} className="field-row" style={{ alignItems: "flex-end" }}>
            <input type="hidden" name="orderId" value={order.id} />
            <div>
              <label>Status</label>
              <select name="paymentStatus" defaultValue={order.paymentStatus}>
                <option value="PAY_ON_DELIVERY">Pay on delivery</option>
                <option value="PAID">Paid</option>
                <option value="UNPAID">Unpaid</option>
              </select>
            </div>
            <div>
              <label>Method</label>
              <select name="paymentMethod" defaultValue={order.paymentMethod}>
                <option value="">—</option>
                <option value="cash">Cash</option>
                <option value="check">Check</option>
                <option value="card">Card</option>
              </select>
            </div>
            <div>
              <button className="btn secondary">Save</button>
            </div>
          </form>
        </div>
      </div>

      {isPro && order.status !== "DELIVERED" && order.status !== "CANCELED" && (
        <div className="card">
          <h3>Schedule &amp; dispatch</h3>
          {order.requestedDate && (
            <p className="muted">
              Customer requested{" "}
              {order.requestedDate.toLocaleDateString("en-US", { timeZone: "UTC", weekday: "long", month: "long", day: "numeric" })}
            </p>
          )}
          <form action={scheduleOrder} className="field-row" style={{ alignItems: "flex-end" }}>
            <input type="hidden" name="orderId" value={order.id} />
            <div>
              <label>Delivery date</label>
              <input type="date" name="date" defaultValue={defaultDate} required />
            </div>
            <div>
              <label>Slot</label>
              <select name="slot" defaultValue={order.scheduledSlot}>
                <option value="">Any</option>
                <option value="AM">AM</option>
                <option value="PM">PM</option>
              </select>
            </div>
            <div>
              <label>Truck</label>
              <select name="truckId" defaultValue={order.truckId ?? ""}>
                <option value="">Unassigned</option>
                {trucks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <button className="btn">
                {order.status === "NEW" ? "Confirm & schedule" : "Update schedule"}
              </button>
            </div>
          </form>
          <p className="muted" style={{ marginTop: 8 }}>
            Scheduling emails the customer a confirmation{order.customerEmail ? "" : " (no email on file)"}.
          </p>
        </div>
      )}

      <div className="card">
        <h3>Status</h3>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {order.status === "SCHEDULED" && (
            <form action={setOrderStatus}>
              <input type="hidden" name="orderId" value={order.id} />
              <input type="hidden" name="status" value="OUT_FOR_DELIVERY" />
              <button className="btn">Mark out for delivery</button>
            </form>
          )}
          {(order.status === "SCHEDULED" || order.status === "OUT_FOR_DELIVERY") && (
            <form action={setOrderStatus}>
              <input type="hidden" name="orderId" value={order.id} />
              <input type="hidden" name="status" value="DELIVERED" />
              <button className="btn">Mark delivered</button>
            </form>
          )}
          {order.status !== "CANCELED" && order.status !== "DELIVERED" && (
            <form action={setOrderStatus}>
              <input type="hidden" name="orderId" value={order.id} />
              <input type="hidden" name="status" value="CANCELED" />
              <button className="btn danger">Cancel order</button>
            </form>
          )}
          {order.status === "CANCELED" && (
            <form action={setOrderStatus}>
              <input type="hidden" name="orderId" value={order.id} />
              <input type="hidden" name="status" value="NEW" />
              <button className="btn secondary">Reopen as new</button>
            </form>
          )}
        </div>
      </div>

      <div className="card">
        <h3>Internal notes</h3>
        <form action={saveInternalNotes}>
          <input type="hidden" name="orderId" value={order.id} />
          <textarea name="internalNotes" rows={3} defaultValue={order.internalNotes} />
          <div style={{ marginTop: 10 }}>
            <button className="btn secondary">Save notes</button>
          </div>
        </form>
      </div>
    </div>
  );
}
