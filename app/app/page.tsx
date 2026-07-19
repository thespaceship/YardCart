import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser, requireYardUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatCents, unitLabel } from "@/lib/money";
import { computeDayLoads, orderYards } from "@/lib/capacity";
import StatusBadge from "@/components/StatusBadge";

export const metadata = { title: "Today" };

function dayRange(offset: number): { start: Date; end: Date } {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() + offset);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

export default async function OverviewPage() {
  const { yard } = await requireYardUser();

  const today = dayRange(0);
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

  const loads = computeDayLoads(
    todaysOrders,
    trucks,
    [today.start]
  );
  const load = loads.values().next().value;
  const pct = load && load.capacityYards > 0 ? Math.min(100, (load.usedYards / load.capacityYards) * 100) : 0;

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

      {load && load.capacityYards > 0 && (
        <div className="card">
          <div className="spread">
            <strong>Today&apos;s truck capacity</strong>
            <span className="muted">
              {load.usedYards} / {load.capacityYards} yds committed
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
                    <div className="muted">{orderYards(o.items)} yds</div>
                  </td>
                  <td>
                    {o.requestedDate
                      ? o.requestedDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })
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
