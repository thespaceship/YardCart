import Link from "next/link";
import { requireYardUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatCents, unitLabel } from "@/lib/money";
import { computeDayLoads } from "@/lib/capacity";
import { localNow, addDays } from "@/lib/tz";
import StatusBadge from "@/components/StatusBadge";

export const metadata = { title: "Today" };

export default async function OverviewPage() {
  const { yard } = await requireYardUser();

  // "today" in the yard's own timezone; order dates are stored as UTC-noon calendar dates
  const now = localNow(yard.timezone);
  const today = {
    start: new Date(`${now.dateKey}T00:00:00Z`),
    end: new Date(`${addDays(now.dateKey, 1)}T00:00:00Z`),
  };
  const [newOrders, todaysOrders, trucks, weekDelivered] = await Promise.all([
    db.order.findMany({
      where: { yardId: yard.id, status: "NEW" },
      include: { items: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    db.order.findMany({
      where: {
        yardId: yard.id,
        status: { in: ["SCHEDULED", "OUT_FOR_DELIVERY"] },
        scheduledDate: { gte: today.start, lt: today.end },
      },
      include: { items: true, truck: true },
      orderBy: [{ scheduledSlot: "asc" }, { createdAt: "asc" }],
    }),
    db.truck.findMany({ where: { yardId: yard.id, active: true } }),
    db.order.aggregate({
      where: {
        yardId: yard.id,
        status: "DELIVERED",
        deliveredAt: { gte: new Date(Date.now() - 7 * 864e5) },
      },
      _sum: { totalCents: true },
      _count: true,
    }),
  ]);

  const loads = computeDayLoads(todaysOrders, trucks, [now.dateKey]);
  const load = loads.get(now.dateKey);
  const pct =
    load && load.capacityTrips > 0 ? Math.min(100, (load.usedTrips / load.capacityTrips) * 100) : 0;

  return (
    <div className="stack">
      <div className="spread">
        <h1 style={{ margin: 0 }}>{yard.name}</h1>
        <Link className="btn" href="/app/orders/new">
          + Phone order
        </Link>
      </div>

      <div className="grid4">
        <div className="card statcard">
          <div className="num">{newOrders.length}</div>
          <div className="lbl">New orders</div>
        </div>
        <div className="card statcard">
          <div className="num">{todaysOrders.length}</div>
          <div className="lbl">Deliveries today</div>
        </div>
        <div className="card statcard">
          <div className="num">{weekDelivered._count}</div>
          <div className="lbl">Delivered (7 days)</div>
        </div>
        <div className="card statcard">
          <div className="num">{formatCents(weekDelivered._sum.totalCents ?? 0)}</div>
          <div className="lbl">Revenue (7 days)</div>
        </div>
      </div>

      {load && load.capacityTrips > 0 && (
        <div className="card">
          <div className="spread">
            <strong>Today&apos;s truck capacity</strong>
            <span className="muted">
              {load.usedTrips} / {load.capacityTrips} trips booked
            </span>
          </div>
          <div className={`meter ${pct > 85 ? "hot" : ""}`} style={{ marginTop: 8 }}>
            <div style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      <div className="card">
        <div className="spread">
          <h2 style={{ margin: 0 }}>Needs scheduling</h2>
          <Link className="muted" href="/app/orders?status=NEW">
            All new orders →
          </Link>
        </div>
        {newOrders.length === 0 ? (
          <p className="muted" style={{ marginTop: 12 }}>
            Nothing waiting — new online orders will appear here.
          </p>
        ) : (
          <table style={{ marginTop: 8 }}>
            <thead>
              <tr>
                <th>#</th>
                <th>Customer</th>
                <th>Items</th>
                <th>Requested</th>
                <th>Total</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {newOrders.map((o) => (
                <tr key={o.id}>
                  <td>
                    <Link href={`/app/orders/${o.id}`}>#{o.number}</Link>
                  </td>
                  <td>
                    {o.customerName}
                    <div className="muted">{o.zip}</div>
                  </td>
                  <td>
                    {o.items.map((i) => `${i.qty} ${unitLabel(i.unitSnap)} ${i.nameSnap}`).join(", ")}
                    <div className="muted">
                      {o.deliveryMethodSnap || "Delivery"}
                      {o.tripCount > 1 ? ` · ${o.tripCount} trips` : ""}
                    </div>
                  </td>
                  <td>
                    {o.requestedDate
                      ? o.requestedDate.toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric" })
                      : "—"}
                  </td>
                  <td>{formatCents(o.totalCents)}</td>
                  <td>
                    <Link className="btn small" href={`/app/orders/${o.id}`}>
                      Schedule
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <div className="spread">
          <h2 style={{ margin: 0 }}>Today&apos;s route</h2>
          <Link className="muted" href="/app/dispatch">
            Dispatch board →
          </Link>
        </div>
        {todaysOrders.length === 0 ? (
          <p className="muted" style={{ marginTop: 12 }}>
            No deliveries scheduled today.
          </p>
        ) : (
          <table style={{ marginTop: 8 }}>
            <thead>
              <tr>
                <th>Slot</th>
                <th>#</th>
                <th>Customer / address</th>
                <th>Truck</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {todaysOrders.map((o) => (
                <tr key={o.id}>
                  <td>{o.scheduledSlot || "—"}</td>
                  <td>
                    <Link href={`/app/orders/${o.id}`}>#{o.number}</Link>
                  </td>
                  <td>
                    {o.customerName}
                    <div className="muted">
                      {o.addressLine}, {o.zip}
                    </div>
                  </td>
                  <td>{o.truck?.name ?? "—"}</td>
                  <td>
                    <StatusBadge status={o.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
