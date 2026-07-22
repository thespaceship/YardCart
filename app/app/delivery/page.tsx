import Link from "next/link";
import { requireYardUser } from "@/lib/auth";
import { meetsPlan } from "@/lib/entitlements";
import { db } from "@/lib/db";
import { formatCents } from "@/lib/money";
import {
  upsertDeliveryMethod,
  deleteDeliveryMethod,
  upsertDeliveryAddOn,
  deleteDeliveryAddOn,
  saveDeliveryRates,
} from "@/app/actions/catalog";

export const metadata = { title: "Delivery" };

type MethodRow = {
  id: string; name: string; description: string;
  maxYards: number; maxWeightLbs: number; maxPallets: number;
  allowMultipleTrips: boolean; quoteOnly: boolean; sortOrder: number; active: boolean;
};

type AddOnRow = {
  id: string; name: string; feeCents: number; perTrip: boolean; sortOrder: number; active: boolean;
};

function limitSummary(m: MethodRow): string {
  const parts: string[] = [];
  if (m.maxYards > 0) parts.push(`${m.maxYards} yd`);
  if (m.maxWeightLbs > 0) parts.push(`${(m.maxWeightLbs / 2000).toLocaleString()} ton`);
  if (m.maxPallets > 0) parts.push(`${m.maxPallets} pallet`);
  return parts.length ? `${parts.join(" / ")} per trip` : "no limits set";
}

function MethodForm({ method }: { method?: MethodRow }) {
  return (
    <form action={upsertDeliveryMethod}>
      {method && <input type="hidden" name="id" value={method.id} />}
      <div className="field-row">
        <div style={{ flex: 2 }}>
          <label>Name</label>
          <input name="name" required defaultValue={method?.name} placeholder="Medium dump truck" />
        </div>
        <div style={{ width: 90 }}>
          <label>Sort</label>
          <input name="sortOrder" inputMode="numeric" defaultValue={method?.sortOrder ?? 0} />
        </div>
      </div>
      <label>Description (shown to customers)</label>
      <input
        name="description"
        defaultValue={method?.description}
        placeholder="10 ton gravel / 18 yards mulch and soils"
      />
      <div className="field-row">
        <div>
          <label>Max cubic yards</label>
          <input name="maxYards" inputMode="decimal" defaultValue={method?.maxYards ?? 0} />
        </div>
        <div>
          <label>Max weight (lbs)</label>
          <input name="maxWeightLbs" inputMode="decimal" defaultValue={method?.maxWeightLbs ?? 0} />
        </div>
        <div>
          <label>Max pallets</label>
          <input name="maxPallets" inputMode="decimal" defaultValue={method?.maxPallets ?? 0} />
        </div>
      </div>
      <p className="muted" style={{ margin: "4px 0 12px", maxWidth: 640 }}>
        Leave a limit at <strong>0</strong> to not enforce it. That is how you say &ldquo;cap gravel
        by weight, but let mulch go by volume&rdquo; — a load is charged for as many trips as the
        tightest limit requires.
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 20, marginBottom: 8 }}>
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="checkbox"
            name="allowMultipleTrips"
            defaultChecked={method?.allowMultipleTrips ?? true}
            style={{ width: "auto" }}
          />
          Can make multiple trips
        </label>
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="checkbox"
            name="quoteOnly"
            defaultChecked={method?.quoteOnly ?? false}
            style={{ width: "auto" }}
          />
          Quote only (customer must call)
        </label>
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type="checkbox" name="active" defaultChecked={method?.active ?? true} style={{ width: "auto" }} />
          Offered
        </label>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button className="btn">{method ? "Save method" : "Add delivery method"}</button>
        {method?.active && (
          <button className="btn danger small" formAction={deleteDeliveryMethod}>
            Retire
          </button>
        )}
      </div>
    </form>
  );
}

function AddOnForm({ addOn }: { addOn?: AddOnRow }) {
  return (
    <form action={upsertDeliveryAddOn} className="field-row" style={{ alignItems: "flex-end" }}>
      {addOn && <input type="hidden" name="id" value={addOn.id} />}
      <div style={{ flex: 2 }}>
        {!addOn && <label>Name</label>}
        <input name="name" required defaultValue={addOn?.name} placeholder="Forklift" aria-label="Add-on name" />
      </div>
      <div style={{ width: 110 }}>
        {!addOn && <label>Fee ($)</label>}
        <input
          name="fee"
          inputMode="decimal"
          defaultValue={addOn ? (addOn.feeCents / 100).toFixed(2) : ""}
          placeholder="75.00"
          aria-label="Add-on fee"
        />
      </div>
      <div style={{ width: 80 }}>
        {!addOn && <label>Sort</label>}
        <input name="sortOrder" inputMode="numeric" defaultValue={addOn?.sortOrder ?? 0} aria-label="Add-on sort order" />
      </div>
      <div>
        <label style={{ display: "flex", gap: 6, alignItems: "center", whiteSpace: "nowrap" }}>
          <input type="checkbox" name="perTrip" defaultChecked={addOn?.perTrip ?? true} style={{ width: "auto" }} />
          Per trip
        </label>
      </div>
      <div>
        <label style={{ display: "flex", gap: 6, alignItems: "center", whiteSpace: "nowrap" }}>
          <input type="checkbox" name="active" defaultChecked={addOn?.active ?? true} style={{ width: "auto" }} />
          Active
        </label>
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <button className="btn secondary small">{addOn ? "Save" : "Add"}</button>
        {addOn?.active && (
          <button className="btn danger small" formAction={deleteDeliveryAddOn}>
            Remove
          </button>
        )}
      </div>
    </form>
  );
}

export default async function DeliveryPage(props: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const ctx = await requireYardUser();
  const { saved } = await props.searchParams;

  const [methods, addOns, zones, rates, trucks] = await Promise.all([
    db.deliveryMethod.findMany({
      where: { yardId: ctx.yard.id },
      orderBy: [{ active: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
    }),
    db.deliveryAddOn.findMany({
      where: { yardId: ctx.yard.id },
      orderBy: [{ active: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
    }),
    db.zone.findMany({
      where: { yardId: ctx.yard.id, active: true },
      orderBy: [{ deliveryFeeCents: "asc" }, { name: "asc" }],
    }),
    db.deliveryRate.findMany({ where: { zone: { yardId: ctx.yard.id } } }),
    db.truck.findMany({
      where: { yardId: ctx.yard.id, active: true },
      select: { deliveryMethodId: true, maxTripsPerDay: true },
    }),
  ]);

  const activeMethods = methods.filter((m) => m.active);
  // Capacity is only enforced where the yard has declared it (lib/capacity.ts), so a method with
  // no trucks takes unlimited bookings. That's the safe default, but it has to be visible or an
  // owner will trust a limit that isn't running. Only surfaced to plans that can assign trucks.
  const methodsWithTrucks = new Set(trucks.map((t) => t.deliveryMethodId).filter(Boolean));
  // Trucks per method, so each row shows the fleet standing behind the service it sells.
  const fleetByMethod = new Map<string, { trucks: number; trips: number }>();
  for (const t of trucks) {
    if (!t.deliveryMethodId) continue;
    const cur = fleetByMethod.get(t.deliveryMethodId) ?? { trucks: 0, trips: 0 };
    cur.trucks += 1;
    cur.trips += t.maxTripsPerDay;
    fleetByMethod.set(t.deliveryMethodId, cur);
  }
  const uncapped = meetsPlan(ctx.yard, "PRO")
    ? activeMethods.filter((m) => !methodsWithTrucks.has(m.id))
    : [];
  const rateOf = (zoneId: string, methodId: string) =>
    rates.find((r) => r.zoneId === zoneId && r.methodId === methodId);

  return (
    <div className="stack">
      <h1>Delivery</h1>
      {saved && <div className="alert ok">Delivery pricing saved.</div>}
      <div className="alert info" style={{ maxWidth: 760 }}>
        <strong>This page is what you sell. <Link href="/app/trucks">Trucks</Link> is what you
        own.</strong>
        <p style={{ margin: "6px 0 0" }}>
          A delivery method is a <em>service</em> — &ldquo;dump truck delivery&rdquo; — not one
          vehicle. Own three identical dump trucks and customers still see a single option. Set
          what fits in one load and what it costs here; then on Trucks, say which of your vehicles
          performs it and how many runs a day they make. That second part is what stops a day from
          being overbooked.
        </p>
        <p style={{ margin: "6px 0 0" }}>
          Customers never choose a truck. YardCart reads their cart, works out what it needs, and
          picks the cheapest method that can carry it.
        </p>
      </div>

      <h2 style={{ marginBottom: 0 }}>Methods</h2>
      {uncapped.length > 0 && (
        <div className="alert info">
          No trucks are assigned to {uncapped.map((m) => m.name).join(", ")}, so{" "}
          {uncapped.length === 1 ? "it takes" : "they take"} unlimited bookings per day — the
          per-trip limits above still apply to pricing, but nothing caps how many of those
          deliveries land on one date. <Link href="/app/trucks">Assign trucks</Link> to enforce
          daily capacity.
        </div>
      )}
      {methods.map((m) => (
        <details className="card" key={m.id}>
          <summary style={{ cursor: "pointer" }}>
            <strong>{m.name}</strong> <span className="muted">{limitSummary(m)}</span>{" "}
            <span className="muted">
              ·{" "}
              {fleetByMethod.has(m.id)
                ? `${fleetByMethod.get(m.id)!.trucks} truck${fleetByMethod.get(m.id)!.trucks === 1 ? "" : "s"}, ${fleetByMethod.get(m.id)!.trips} deliveries/day`
                : "no trucks assigned"}
            </span>{" "}
            {m.quoteOnly && <span className="badge neutral">Quote only</span>}{" "}
            {!m.active && <span className="badge neutral">Retired</span>}
          </summary>
          <div style={{ marginTop: 12 }}>
            <MethodForm method={m} />
          </div>
        </details>
      ))}
      <div className="card">
        <h3>Add a delivery method</h3>
        <MethodForm />
      </div>

      <h2 style={{ marginBottom: 0 }}>Equipment &amp; add-ons</h2>
      <div className="card">
        <p className="muted" style={{ maxWidth: 700, marginTop: 0 }}>
          Charged automatically when the cart contains a product that needs them — a forklift to
          get pallets off the truck, say. Mark which products require what on the{" "}
          <Link href="/app/products">Products</Link> page.
        </p>
        {addOns.map((a) => (
          <AddOnForm key={a.id} addOn={a} />
        ))}
        <hr style={{ margin: "16px 0", border: 0, borderTop: "1px solid var(--line)" }} />
        <AddOnForm />
      </div>

      <h2 style={{ marginBottom: 0 }}>Pricing by zone</h2>
      <div className="card">
        {zones.length === 0 ? (
          <p className="muted">
            Add a <Link href="/app/zones">delivery zone</Link> first — zones are the distance bands
            your prices are built on.
          </p>
        ) : activeMethods.length === 0 ? (
          <p className="muted">Add at least one delivery method above to price it by zone.</p>
        ) : (
          <>
            <p className="muted" style={{ maxWidth: 700, marginTop: 0 }}>
              One price per zone and method, per trip. Leave a cell blank to fall back to the
              zone&apos;s own delivery fee. Name your zones for the distance bands you quote —
              &ldquo;0–3 miles&rdquo;, &ldquo;3–6 miles&rdquo; — and list the ZIPs in each.
            </p>
            <form action={saveDeliveryRates}>
              <div style={{ overflowX: "auto" }}>
                <table>
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left" }}>Zone</th>
                      {activeMethods.map((m) => (
                        <th key={m.id} style={{ textAlign: "left" }}>
                          {m.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {zones.map((z) => (
                      <tr key={z.id}>
                        <td style={{ whiteSpace: "nowrap" }}>
                          <strong>{z.name}</strong>
                          <div className="muted">base {formatCents(z.deliveryFeeCents)}</div>
                        </td>
                        {activeMethods.map((m) => {
                          const rate = rateOf(z.id, m.id);
                          return (
                            <td key={m.id}>
                              <input
                                name={`rate_${z.id}_${m.id}`}
                                inputMode="decimal"
                                style={{ width: 110 }}
                                defaultValue={rate ? (rate.feeCents / 100).toFixed(2) : ""}
                                placeholder={(z.deliveryFeeCents / 100).toFixed(2)}
                                aria-label={`${m.name} price for ${z.name}`}
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ marginTop: 16 }}>
                <button className="btn">Save pricing</button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
