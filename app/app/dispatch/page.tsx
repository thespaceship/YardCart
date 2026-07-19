import Link from "next/link";
import { requireYardUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { orderYards, dailyCapacityYards } from "@/lib/capacity";
import { unitLabel } from "@/lib/money";
import StatusBadge from "@/components/StatusBadge";

export const metadata = { title: "Dispatch" };

const DAYS_SHOWN = 7;

export default async function DispatchPage(props: {
  searchParams: Promise<{ start?: string }>;
}) {
  const ctx = await requireYardUser();
  const { start } = await props.searchParams;

  const startDate = start && /^\d{4}-\d{2}-\d{2}$/.test(start) ? new Date(`${start}T00:00:00`) : new Date();
  startDate.setHours(0, 0, 0, 0);
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + DAYS_SHOWN);

  const [orders, trucks, unscheduled] = await Promise.all([
    db.order.findMany({
      where: {
        yardId: ctx.yard.id,
        status: { in: ["SCHEDULED", "OUT_FOR_DELIVERY", "DELIVERED"] },
        scheduledDate: { gte: startDate, lt: endDate },
      },
      include: { items: true, truck: true },
      orderBy: [{ scheduledSlot: "asc" }, { createdAt: "asc" }],
    }),
    db.truck.findMany({ where: { yardId: ctx.yard.id, active: true } }),
    db.order.count({ where: { yardId: ctx.yard.id, status: "NEW" } }),
  ]);

  const capacity = dailyCapacityYards(trucks);
  const days: { date: Date; key: string }[] = [];
  for (let i = 0; i < DAYS_SHOWN; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    days.push({ date: d, key: d.toISOString().slice(0, 10) });
  }
  const byDay = new Map<string, typeof orders>();
  for (const o of orders) {
    const key = o.scheduledDate!.toISOString().slice(0, 10);
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key)!.push(o);
  }

  const prev = new Date(startDate);
  prev.setDate(prev.getDate() - DAYS_SHOWN);
  const next = new Date(startDate);
  next.setDate(next.getDate() + DAYS_SHOWN);

  return (
    <div className="stack">
      <div className="spread">
        <h1 style={{ margin: 0 }}>Dispatch board</h1>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {unscheduled > 0 && (
            <Link className="btn accent small" href="/app/orders?status=NEW">
              {unscheduled} unscheduled →
            </Link>
          )}
          <Link className="btn secondary small" href={`/app/dispatch?start=${prev.toISOString().slice(0, 10)}`}>
            ← Prev week
          </Link>
          <Link className="btn secondary small" href="/app/dispatch">
            Today
          </Link>
          <Link className="btn secondary small" href={`/app/dispatch?start=${next.toISOString().slice(0, 10)}`}>
            Next week →
          </Link>
        </div>
      </div>

      {days.map(({ date, key }) => {
        const dayOrders = byDay.get(key) ?? [];
        const used = dayOrders
          .filter((o) => o.status !== "CANCELED")
          .reduce((s, o) => s + orderYards(o.items), 0);
        const pct = capacity > 0 ? Math.min(100, (used / capacity) * 100) : 0;
        const isToday = key === new Date().toISOString().slice(0, 10);
        return (
          <div className="card" key={key} style={isToday ? { borderColor: "var(--brand)" } : undefined}>
            <div className="spread">
              <h3 style={{ margin: 0 }}>
                {date.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
                {isToday && <span className="badge scheduled" style={{ marginLeft: 8 }}>Today</span>}
              </h3>
              <span className="muted">
                {used} / {capacity || "—"} yds
              </span>
            </div>
            {capacity > 0 && (
              <div className={`meter ${pct > 85 ? "hot" : ""}`} style={{ margin: "8px 0" }}>
                <div style={{ width: `${pct}%` }} />
              </div>
            )}
            {dayOrders.length === 0 ? (
              <p className="muted" style={{ margin: "8px 0 0" }}>
                No deliveries.
              </p>
            ) : (
              <table style={{ marginTop: 4 }}>
                <tbody>
                  {dayOrders.map((o) => (
                    <tr key={o.id}>
                      <td style={{ width: 50 }}>{o.scheduledSlot || "—"}</td>
                      <td style={{ width: 80 }}>
                        <Link href={`/app/orders/${o.id}`}>#{o.number}</Link>
                      </td>
                      <td>
                        {o.customerName} — {o.addressLine}, {o.zip}
                        <div className="muted">
                          {o.items.map((i) => `${i.qty} ${unitLabel(i.unitSnap)} ${i.nameSnap}`).join(", ")}
                        </div>
                      </td>
                      <td style={{ width: 140 }}>{o.truck?.name ?? <span className="muted">no truck</span>}</td>
                      <td style={{ width: 130 }} className="right">
                        <StatusBadge status={o.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        );
      })}
    </div>
  );
}
