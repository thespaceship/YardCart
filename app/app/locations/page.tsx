import Link from "next/link";
import { requireYardUser } from "@/lib/auth";
import { meetsPlan } from "@/lib/entitlements";
import { MAX_YARDS_PER_ACCOUNT, ensureOwnerMembership, getOwnedYards } from "@/lib/yards";
import { createLocation, switchYard } from "@/app/actions/yards";
import UpgradePrompt from "@/components/UpgradePrompt";
import SaveButton from "@/components/SaveButton";

export const metadata = { title: "Locations" };

export default async function LocationsPage(props: {
  searchParams: Promise<{ new_location?: string }>;
}) {
  const ctx = await requireYardUser();
  if (!meetsPlan(ctx.yard, "MULTI")) {
    return <UpgradePrompt feature="Multiple locations" required="MULTI" />;
  }
  const { new_location } = await props.searchParams;

  // heal pre-join-table yards so the current one shows up in the list/count
  await ensureOwnerMembership(ctx.user.id, ctx.yard.id);
  const yards = await getOwnedYards(ctx.user.id);
  const atCap = yards.length >= MAX_YARDS_PER_ACCOUNT;

  return (
    <div className="stack" style={{ maxWidth: 760 }}>
      <h1>Locations</h1>
      {new_location && (
        <div className="alert ok">
          Location created — you&apos;re now managing it. Set up its products, zones, and trucks below.
        </div>
      )}
      <p className="muted">
        Your Multi-yard plan covers up to {MAX_YARDS_PER_ACCOUNT} locations ({yards.length} used).
        Switch between them anytime; each has its own storefront, orders, products, and zones.
      </p>

      <div className="card">
        <h3>Your locations</h3>
        <table>
          <thead>
            <tr>
              <th>Location</th>
              <th>Storefront</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {yards.map((y) => {
              const active = y.id === ctx.yard.id;
              return (
                <tr key={y.id}>
                  <td>
                    <strong>{y.name}</strong>
                    {active && <span className="badge delivered" style={{ marginLeft: 8 }}>Active</span>}
                  </td>
                  <td>
                    <a href={`/s/${y.slug}`} target="_blank" rel="noreferrer">
                      /s/{y.slug} ↗
                    </a>
                  </td>
                  <td className="right">
                    {!active && (
                      <form action={switchYard}>
                        <input type="hidden" name="yardId" value={y.id} />
                        <button className="btn secondary small">Switch to this</button>
                      </form>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3>Add a location</h3>
        {atCap ? (
          <p className="muted">
            You&apos;ve reached the {MAX_YARDS_PER_ACCOUNT}-location limit for the Multi-yard plan.
          </p>
        ) : (
          <form action={createLocation} className="field-row" style={{ alignItems: "flex-end" }}>
            <div style={{ flex: 2 }}>
              <label>Location name</label>
              <input name="name" required placeholder="North Yard" />
            </div>
            <div>
              <SaveButton className="btn">Create location</SaveButton>
            </div>
          </form>
        )}
        <p className="muted" style={{ marginTop: 8 }}>
          A new location starts empty — after creating it you&apos;ll switch into it to add products,
          delivery zones, and trucks. Billing stays on your single Multi-yard subscription.
        </p>
      </div>

      <p className="muted">
        Need to close a location or change your plan? Head to <Link href="/app/billing">Billing</Link>.
      </p>
    </div>
  );
}
