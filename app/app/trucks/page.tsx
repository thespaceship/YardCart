import Link from "next/link";
import { requireYardUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { meetsPlan } from "@/lib/entitlements";
import UpgradePrompt from "@/components/UpgradePrompt";
import { upsertTruck } from "@/app/actions/catalog";

export const metadata = { title: "Trucks" };

function TruckForm({
  truck,
  methods,
}: {
  truck?: {
    id: string; name: string; maxTripsPerDay: number;
    active: boolean; deliveryMethodId: string | null;
  };
  methods: { id: string; name: string }[];
}) {
  return (
    <form action={upsertTruck}>
      {truck && <input type="hidden" name="id" value={truck.id} />}
      <div className="field-row">
        <div style={{ flex: 2 }}>
          <label>Truck name</label>
          <input name="name" required defaultValue={truck?.name} placeholder="F-550 Dump" />
        </div>
        <div>
          <label>Deliveries per day</label>
          <input name="maxTripsPerDay" inputMode="numeric" defaultValue={truck?.maxTripsPerDay ?? 6} />
        </div>
        <div>
          <label>Performs</label>
          <select name="deliveryMethodId" defaultValue={truck?.deliveryMethodId ?? ""}>
            <option value="">— unassigned —</option>
            {methods.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>
      </div>
      <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input type="checkbox" name="active" defaultChecked={truck?.active ?? true} style={{ width: "auto" }} />
        In service
      </label>
      <div style={{ marginTop: 12 }}>
        <button className="btn">{truck ? "Save truck" : "Add truck"}</button>
      </div>
    </form>
  );
}

export default async function TrucksPage() {
  const ctx = await requireYardUser();
  if (!meetsPlan(ctx.yard, "PRO")) return <UpgradePrompt feature="Trucks & fleet" required="PRO" />;
  const [trucks, methods] = await Promise.all([
    db.truck.findMany({
      where: { yardId: ctx.yard.id },
      orderBy: [{ active: "desc" }, { name: "asc" }],
      include: { deliveryMethod: { select: { name: true } } },
    }),
    db.deliveryMethod.findMany({
      where: { yardId: ctx.yard.id, active: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
  ]);
  const active = trucks.filter((t) => t.active);
  const assigned = active.filter((t) => t.deliveryMethodId);
  const dailyTrips = assigned.reduce((sum, t) => sum + t.maxTripsPerDay, 0);

  return (
    <div className="stack">
      <h1>Trucks</h1>
      <div className="alert info" style={{ maxWidth: 760 }}>
        <strong>This page is what you own. <Link href="/app/delivery">Delivery</Link> is what you
        sell.</strong>
        <p style={{ margin: "6px 0 0" }}>
          List your actual vehicles here and say which delivery service each one performs, plus how
          many runs it makes in a day. That total is what decides which dates customers can still
          book — a fully booked dump truck closes those dates for dump-truck orders only, leaving
          your flatbed free.
        </p>
        <p style={{ margin: "6px 0 0" }}>
          A truck with no service assigned isn&apos;t counted, so its deliveries are never capped.
        </p>
        <p style={{ margin: "6px 0 0" }}>
          Right now: <strong>{assigned.length} of {active.length}</strong> trucks assigned,{" "}
          <strong>{dailyTrips}</strong> deliveries a day.
        </p>
      </div>
      {trucks.map((t) => (
        <details className="card" key={t.id}>
          <summary style={{ cursor: "pointer" }}>
            <strong>{t.name}</strong>{" "}
            <span className="muted">
              {t.maxTripsPerDay} deliveries/day
              {t.deliveryMethod ? ` · ${t.deliveryMethod.name}` : " · no service assigned"}
            </span>{" "}
            {!t.active && <span className="badge neutral">Out of service</span>}
          </summary>
          <div style={{ marginTop: 12 }}>
            <TruckForm truck={t} methods={methods} />
          </div>
        </details>
      ))}
      <div className="card">
        <h3>Add a truck</h3>
        <TruckForm methods={methods} />
      </div>
    </div>
  );
}
