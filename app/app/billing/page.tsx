import { requireYardUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { PLANS, stripeEnabled } from "@/lib/billing";
import { formatCents } from "@/lib/money";
import { startCheckout, cancelPlan } from "@/app/actions/billing";
import ConfirmSubmit from "@/components/ConfirmSubmit";

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
            <ConfirmSubmit
              label="Cancel subscription"
              title={`Cancel your ${PLANS[yard.plan]?.name ?? yard.plan} subscription?`}
              message={
                testMode
                  ? `This cancels your ${PLANS[yard.plan]?.name ?? yard.plan} subscription now (test mode).`
                  : `Your ${PLANS[yard.plan]?.name ?? yard.plan} subscription will stop renewing and cancel at the end of the current billing period.\n\nYou keep full access until then, and can resubscribe anytime.`
              }
              confirmLabel="Cancel subscription"
              cancelLabel="Keep my subscription"
              className="btn danger small"
              confirmClassName="btn danger"
            />
          </form>
        )}
      </div>

      <div className="grid3">
        {Object.entries(PLANS).map(([key, plan]) => {
          const isCurrent = yard.plan === key && yard.planStatus === "ACTIVE";
          const price = formatCents(plan.priceCents);
          const isSwitch = !testMode && yard.planStatus === "ACTIVE";
          const label = testMode ? "Activate (test)" : isSwitch ? `Switch to ${plan.name}` : "Subscribe";
          const title = testMode
            ? `Activate ${plan.name}?`
            : isSwitch
              ? `Switch to ${plan.name}?`
              : `Start the ${plan.name} plan?`;
          const message = testMode
            ? `This activates the ${plan.name} plan at ${price}/mo.\n\nTest mode — no card is charged and a test invoice is recorded.`
            : isSwitch
              ? `You'll move to the ${plan.name} plan at ${price}/mo.\n\nThe prorated difference for the rest of this billing period is charged to your card on file right away.`
              : `You'll continue to secure Stripe checkout to subscribe to ${plan.name} at ${price}/mo.\n\nYou won't be charged until you finish checkout.`;
          const confirmLabel = testMode ? "Activate" : isSwitch ? `Switch to ${plan.name}` : "Continue to checkout";
          return (
            <div className="card" key={key} style={key === "PRO" ? { borderColor: "var(--brand)" } : undefined}>
              <h3>{plan.name}</h3>
              <p style={{ fontSize: "1.6rem", fontWeight: 800, margin: "4px 0" }}>
                {price}
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
                <ConfirmSubmit
                  label={label}
                  disabled={isCurrent}
                  disabledLabel="Current plan"
                  title={title}
                  message={message}
                  confirmLabel={confirmLabel}
                  className={`btn ${key === "PRO" ? "" : "secondary"}`}
                  style={{ width: "100%" }}
                />
              </form>
            </div>
          );
        })}
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
