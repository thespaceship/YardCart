import { requireYardUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatCents } from "@/lib/money";
import { zoneZips } from "@/lib/zones";
import { upsertZone, deleteZone } from "@/app/actions/catalog";
import SaveButton from "@/components/SaveButton";
import ZoneAreaFields from "@/components/ZoneAreaFields";

export const metadata = { title: "Delivery zones" };

type ZoneRow = {
  id: string; name: string; radiusMiles: number; centerZip: string; zipCodes: string;
  deliveryFeeCents: number; minOrderCents: number; active: boolean;
};

/** One-line description of who a zone serves, for the collapsed summary. */
function areaSummary(zone: ZoneRow): string {
  if (zone.radiusMiles > 0) {
    const center = zone.centerZip ? ` of ${zone.centerZip}` : "";
    return `within ${zone.radiusMiles} mi${center}`;
  }
  const n = zoneZips(zone).length;
  return `${n} ZIP${n === 1 ? "" : "s"}`;
}

function ZoneForm({ zone, yardZip }: { zone?: ZoneRow; yardZip: string }) {
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
      <ZoneAreaFields
        yardZip={yardZip}
        defaultMode={!zone || zone.radiusMiles > 0 ? "radius" : "list"}
        radiusMiles={zone?.radiusMiles}
        centerZip={zone?.centerZip}
        zipCodesText={zone ? zoneZips(zone).join(", ") : ""}
      />
      <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 14 }}>
        <input type="checkbox" name="active" defaultChecked={zone?.active ?? true} style={{ width: "auto" }} />
        Active
      </label>
      <div style={{ marginTop: 12 }}>
        <SaveButton className="btn">{zone ? "Save zone" : "Add zone"}</SaveButton>
      </div>
    </form>
  );
}

export default async function ZonesPage() {
  const ctx = await requireYardUser();
  const zones = await db.zone.findMany({
    where: { yardId: ctx.yard.id },
    orderBy: [{ active: "desc" }, { deliveryFeeCents: "asc" }],
  });
  const yardZip = ctx.yard.zip;

  return (
    <div className="stack">
      <h1>Delivery zones</h1>
      <p className="muted" style={{ maxWidth: 640 }}>
        Set how far you deliver and what it costs. Customers enter their ZIP at checkout; the
        matching zone sets their delivery fee and minimum order. Most yards just set a distance —
        add a second, wider zone if farther deliveries cost more. If a ZIP falls in two zones, the
        cheaper fee wins.
      </p>
      {!yardZip && (
        <div className="alert info" style={{ maxWidth: 640 }}>
          Add your yard&apos;s ZIP code in{" "}
          <a href="/app/settings">Settings</a> so distance zones know where to measure from — or
          set a center ZIP on each zone below.
        </div>
      )}
      {zones.map((z) => (
        <details className="card" key={z.id}>
          <summary style={{ cursor: "pointer" }}>
            <strong>{z.name}</strong>{" "}
            <span className="muted">
              {formatCents(z.deliveryFeeCents)} fee · min {formatCents(z.minOrderCents)} ·{" "}
              {areaSummary(z)}
            </span>{" "}
            {!z.active && <span className="badge neutral">Inactive</span>}
          </summary>
          <div style={{ marginTop: 12 }}>
            <ZoneForm zone={z} yardZip={yardZip} />
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
        <ZoneForm yardZip={yardZip} />
      </div>
    </div>
  );
}
