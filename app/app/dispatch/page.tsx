import Link from "next/link";
import { requireYardUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { meetsPlan } from "@/lib/entitlements";
import UpgradePrompt from "@/components/UpgradePrompt";
import { dailyTripsByMethod, LEGACY_POOL } from "@/lib/capacity";
import { localNow, addDays, storedDateKey } from "@/lib/tz";
import { unitLabel } from "@/lib/money";
import StatusBadge from "@/components/StatusBadge";

export const metadata = { title: "Dispatch" };

const DAYS_SHOWN = 7;

export default async function DispatchPage(props: {
  searchParams: Promise<{ start?: string }>;
}) {
  const ctx = await requireYardUser();
  if (!meetsPlan(ctx.yard, "PRO")) return <UpgradePrompt feature="Dispatch board" required="PRO" />;
  const { start } = await props.searchParams;

  const todayKey = localNow(ctx.yard.timezone).dateKey;
  const startKey = start && /^\d{4}-\d{2}-\d{2}$/.test(start) ? start : todayKey;
  const startDate = new Date(`${startKey}T00:00:00Z`);
  const endDate = new Date(`${addDays(startKey, DAYS_SHOWN)}T00:00:00Z`);

  const [orders, trucks, unscheduled, methods] = await Promise.all([
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
    db.deliveryMethod.findMany({
      where: { yardId: ctx.yard.id },
      select: { id: true, name: true },
    }),
  ]);

  const tripsByMethod = dailyTripsByMethod(trucks);
  const capacity = [...tripsByMethod.values()].reduce((a, b) => a + b, 0);
  const methodNames = new Map(methods.map((m) => [m.id, m.name]));
  const days: { date: Date; key: string }[] = [];
  for (let i = 0; i < DAYS_SHOWN; i++) {
    const key = addDays(startKey, i);
    days.push({ date: new Date(`${key}T12:00:00Z`), key });
  }
  const byDay = new Map<string, typeof orders>();
  for (const o of orders) {
    const key = storedDateKey(o.scheduledDate!);
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key)!.push(o);
  }

  const prevKey = addDays(startKey, -DAYS_SHOWN);
  const nextKey = addDays(startKey, DAYS_SHOWN);

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
          <Link className="btn secondary small" href={`/app/dispatch?start=${prevKey}`}>
            ← Prev week
          </Link>
          <Link className="btn secondary small" href="/app/dispatch">
            Today
          </Link>
          <Link className="btn secondary small" href={`/app/dispatch?start=${nextKey}`}>
            Next week →
          </Link>
        </div>
      </div>

      {days.map(({ date, key }) => {
        const dayOrders = byDay.get(key) ?? [];
        const live = dayOrders.filter((o) => o.status !== "CANCELED");
        const used = live.reduce((s, o) => s + Math.max(1, o.tripCount), 0);
        // trips booked per method, so a full flatbed day doesn't read as a full dump-truck day
        const usedByMethod = new Map<string, number>();
        for (const o of live) {
          const key = o.deliveryMethodId ?? LEGACY_POOL;
          usedByMethod.set(key, (usedByMethod.get(key) ?? 0) + Math.max(1, o.tripCount));
        }
        const pct = capacity > 0 ? Math.min(100, (used / capacity) * 100) : 0;
        const isToday = key === todayKey;
        return (
          <div className="card" key={key} style={isToday ? { borderColor: "var(--brand)" } : undefined}>
            <div className="spread">
              <h3 style={{ margin: 0 }}>
                {date.toLocaleDateString("en-US", { timeZone: "UTC", weekday: "long", month: "short", day: "numeric" })}
                {isToday && <span className="badge scheduled" style={{ marginLeft: 8 }}>Today</span>}
              </h3>
              <span className="muted">
                {used} / {capacity || "—"} trips
              </span>
            </div>
            {capacity > 0 && (
              <div style={{ margin: "8px 0" }}>
                <div className={`meter ${pct > 85 ? "hot" : ""}`}>
                  <div style={{ width: `${pct}%` }} />
                </div>
                {tripsByMethod.size > 1 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 6 }}>
                    {[...tripsByMethod.entries()].map(([methodId, cap]) => {
                      const u = usedByMethod.get(methodId) ?? 0;
                      return (
                        <span key={methodId} className="muted" style={{ fontSize: "0.85rem" }}>
                          {methodId === LEGACY_POOL
                            ? "Unassigned trucks"
                            : methodNames.get(methodId) ?? "Retired method"}
                          : {u}/{cap}
                        </span>
                      );
                    })}
                  </div>
                )}
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
