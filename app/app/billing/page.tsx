import { requireYardUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { PLANS, stripeEnabled } from "@/lib/billing";
import { formatCents } from "@/lib/money";
import { startCheckout, cancelPlan } from "@/app/actions/billing";

export const metadata = { title: "Billing" };

export default async function BillingPage(props: {
  searchParams: Promise<{ success?: string; canceled?: string; error?: string }>;
}) {
  const ctx = await requireYardUser();
  const { success, canceled, error } = await props.searchParams;
  const { yard } = ctx;
  const invoices = await db.invoice.findMany({
    where: { yardId: yard.id },
    orderBy: { createdAt: "desc" },
    take: 12,
  });
  const testMode = !stripeEnabled();
  const trialDaysLeft = yard.trialEndsAt
    ? Math.max(0, Math.ceil((yard.trialEndsAt.getTime() - Date.now()) / 864e5))
    : null;

  return (
    <div className="stack" style={{ maxWidth: 860 }}>
      <h1>Billing</h1>
      {testMode && (
        <div className="alert info">
          <strong>Test mode:</strong> payments are simulated — activating a plan records a test
          invoice and no card is charged. Stripe is wired up and switches on automatically once
          API keys are configured.
        </div>
      )}
      {success && <div className="alert ok">Plan updated. You&apos;re all set!</div>}
      {canceled && <div className="alert error">Checkout canceled — no changes made.</div>}
      {error && (
        <div className="alert error">
          We couldn&apos;t {error === "cancel" ? "cancel your plan" : "change your plan"} just now —
          no charge was made. Please try again in a moment, or contact support if it keeps happening.
        </div>
      )}

      <div className="card">
        <h3>Current plan</h3>
        <p>
          <strong>{PLANS[yard.plan]?.name ?? yard.plan}</strong> — status:{" "}
          <span className={`badge ${yard.planStatus === "ACTIVE" ? "delivered" : "neutral"}`}>
            {yard.planStatus}
          </span>
          {yard.planStatus === "TRIALING" && trialDaysLeft !== null && (
            <> · {trialDaysLeft} trial day{trialDaysLeft === 1 ? "" : "s"} left</>
          )}
        </p>
        {yard.planStatus === "ACTIVE" && yard.stripeCancelAtPeriodEnd && (
          <p className="muted" style={{ marginTop: 8 }}>
            Your plan is set to cancel at the end of the current billing period. You keep full
            access until then; pick a plan below to stay subscribed.
          </p>
        )}
        {yard.planStatus === "ACTIVE" && !yard.stripeCancelAtPeriodEnd && (
          <form action={cancelPlan}>
            <button className="btn danger small">Cancel subscription</button>
          </form>
        )}
      </div>

      <div className="grid3">
        {Object.entries(PLANS).map(([key, plan]) => (
          <div className="card" key={key} style={key === "PRO" ? { borderColor: "var(--brand)" } : undefined}>
            <h3>{plan.name}</h3>
            <p style={{ fontSize: "1.6rem", fontWeight: 800, margin: "4px 0" }}>
              {formatCents(plan.priceCents)}
              <span className="muted" style={{ fontSize: "0.9rem", fontWeight: 400 }}>/mo</span>
            </p>
            <p className="muted">{plan.blurb}</p>
            <ul style={{ paddingLeft: 18, margin: "0 0 16px" }}>
              {plan.features.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
            <form action={startCheckout}>
              <input type="hidden" name="plan" value={key} />
              <button
                className={`btn ${key === "PRO" ? "" : "secondary"}`}
                disabled={yard.plan === key && yard.planStatus === "ACTIVE"}
                style={{ width: "100%" }}
              >
                {yard.plan === key && yard.planStatus === "ACTIVE"
                  ? "Current plan"
                  : testMode
                    ? "Activate (test)"
                    : yard.planStatus === "ACTIVE"
                      ? `Switch to ${plan.name}`
                      : "Subscribe"}
              </button>
            </form>
          </div>
        ))}
      </div>

      <div className="card">
        <h3>Invoices</h3>
        {invoices.length === 0 ? (
          <p className="muted">No invoices yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Plan</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  <td>{inv.createdAt.toLocaleDateString("en-US")}</td>
                  <td>{PLANS[inv.plan]?.name ?? inv.plan}</td>
                  <td>{formatCents(inv.amountCents)}</td>
                  <td>
                    {inv.status === "TEST_PAID" ? (
                      <span className="badge neutral">Test</span>
                    ) : (
                      <span className="badge delivered">{inv.status}</span>
                    )}
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
