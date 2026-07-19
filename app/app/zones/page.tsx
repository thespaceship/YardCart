import { redirect } from "next/navigation";
import { requireYardUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatCents } from "@/lib/money";
import { zoneZips } from "@/lib/zones";
import { upsertZone, deleteZone } from "@/app/actions/catalog";

export const metadata = { title: "Delivery zones" };

function ZoneForm({ zone }: { zone?: {
  id: string; name: string; zipCodes: string; deliveryFeeCents: number; minOrderCents: number; active: boolean;
} }) {
  return (
    <form action={upsertZone}>
      {zone && <input type="hidden" name="id" value={zone.id} />}
      <div className="field-row">
        <div>
          <label>Zone name</label>
          <input name="name" required defaultValue={zone?.name} placeholder="Local (within 10 mi)" />
        </div>
        <div>
          <label>Delivery fee ($)</label>
          <input name="deliveryFee" required inputMode="decimal" defaultValue={zone ? (zone.deliveryFeeCents / 100).toFixed(2) : ""} />
        </div>
        <div>
          <label>Minimum material order ($)</label>
          <input name="minOrder" inputMode="decimal" defaultValue={zone ? (zone.minOrderCents / 100).toFixed(2) : "0"} />
        </div>
      </div>
      <label>ZIP codes served (comma or space separated)</label>
      <textarea name="zipCodes" rows={2} required defaultValue={zone ? zoneZips(zone).join(", ") : ""} placeholder="43004, 43230, 43068" />
      <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input type="checkbox" name="active" defaultChecked={zone?.active ?? true} style={{ width: "auto" }} />
        Active
      </label>
      <div style={{ marginTop: 12 }}>
        <button className="btn">{zone ? "Save zone" : "Add zone"}</button>
      </div>
    </form>
  );
}

export default async function ZonesPage() {
  const ctx = await requireYardUser();
  if (!ctx) redirect("/login");
  const zones = await db.zone.findMany({
    where: { yardId: ctx.yard.id },
    orderBy: [{ active: "desc" }, { deliveryFeeCents: "asc" }],
  });

  return (
    <div className="stack">
      <h1>Delivery zones</h1>
      <p className="muted" style={{ maxWidth: 640 }}>
        Customers enter their ZIP at checkout; the matching zone sets their delivery fee and
        minimum order. If a ZIP is in two zones, the cheaper fee wins.
      </p>
      {zones.map((z) => (
        <details className="card" key={z.id}>
          <summary style={{ cursor: "pointer" }}>
            <strong>{z.name}</strong>{" "}
            <span className="muted">
              {formatCents(z.deliveryFeeCents)} fee · min {formatCents(z.minOrderCents)} ·{" "}
              {zoneZips(z).length} ZIPs
            </span>{" "}
            {!z.active && <span className="badge neutral">Inactive</span>}
          </summary>
          <div style={{ marginTop: 12 }}>
            <ZoneForm zone={z} />
            {z.active && (
              <form action={deleteZone} style={{ marginTop: 8 }}>
                <input type="hidden" name="id" value={z.id} />
                <button className="btn danger small">Deactivate</button>
              </form>
            )}
          </div>
        </details>
      ))}
      <div className="card">
        <h3>Add a zone</h3>
        <ZoneForm />
      </div>
    </div>
  );
}
