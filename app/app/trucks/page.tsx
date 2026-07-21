import { requireYardUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { meetsPlan } from "@/lib/entitlements";
import UpgradePrompt from "@/components/UpgradePrompt";
import { upsertTruck } from "@/app/actions/catalog";

export const metadata = { title: "Trucks" };

function TruckForm({ truck }: { truck?: {
  id: string; name: string; capacityYards: number; maxTripsPerDay: number; active: boolean;
} }) {
  return (
    <form action={upsertTruck}>
      {truck && <input type="hidden" name="id" value={truck.id} />}
      <div className="field-row">
        <div style={{ flex: 2 }}>
          <label>Truck name</label>
          <input name="name" required defaultValue={truck?.name} placeholder="F-550 Dump" />
        </div>
        <div>
          <label>Capacity (yds/trip)</label>
          <input name="capacityYards" inputMode="decimal" defaultValue={truck?.capacityYards ?? 10} />
        </div>
        <div>
          <label>Max trips/day</label>
          <input name="maxTripsPerDay" inputMode="numeric" defaultValue={truck?.maxTripsPerDay ?? 6} />
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
  const trucks = await db.truck.findMany({
    where: { yardId: ctx.yard.id },
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });
  const daily = trucks.filter((t) => t.active).reduce((s, t) => s + t.capacityYards * t.maxTripsPerDay, 0);

  return (
    <div className="stack">
      <h1>Trucks</h1>
      <p className="muted">
        Truck capacity drives the delivery-date availability your customers see online. Current
        daily capacity: <strong>{daily} yards</strong>.
      </p>
      {trucks.map((t) => (
        <details className="card" key={t.id}>
          <summary style={{ cursor: "pointer" }}>
            <strong>{t.name}</strong>{" "}
            <span className="muted">
              {t.capacityYards} yds × {t.maxTripsPerDay} trips/day
            </span>{" "}
            {!t.active && <span className="badge neutral">Out of service</span>}
          </summary>
          <div style={{ marginTop: 12 }}>
            <TruckForm truck={t} />
          </div>
        </details>
      ))}
      <div className="card">
        <h3>Add a truck</h3>
        <TruckForm />
      </div>
    </div>
  );
}
