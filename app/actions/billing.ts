"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireYardUser } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  PLANS,
  stripeEnabled,
  createStripeCheckout,
  hasLiveStripeSubscription,
  switchStripeSubscriptionPlan,
  cancelStripeSubscription,
  getActiveSubscriptionId,
} from "@/lib/billing";
import { sendEmail, emailShell } from "@/lib/mailer";
import { trackEvent, logError } from "@/lib/observability";
import { formatCents } from "@/lib/money";
import { ensureOwnerMembership, propagateOwnedYardsBilling } from "@/lib/yards";

/** Build a redirect target that shows a friendly billing error (plus a short technical detail). */
function billingErrorRedirect(kind: "switch" | "cancel", err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  return `/app/billing?error=${kind}&detail=${encodeURIComponent(msg.slice(0, 300))}`;
}

/**
 * Return the yard's Stripe subscription id, healing it from the customer id if it was never
 * stored (customer subscribed before the stripeSubscriptionId column existed). When found,
 * persist it across the owner's yards so later billing actions resolve instantly.
 */
async function resolveSubscriptionId(
  userId: string,
  yard: { id: string; stripeSubscriptionId: string | null; stripeCustomerId: string | null }
): Promise<string | null> {
  if (yard.stripeSubscriptionId) return yard.stripeSubscriptionId;
  if (!yard.stripeCustomerId) return null;
  const subId = await getActiveSubscriptionId(yard.stripeCustomerId);
  if (subId) {
    await ensureOwnerMembership(userId, yard.id);
    await propagateOwnedYardsBilling(userId, { stripeSubscriptionId: subId });
  }
  return subId;
}

export async function startCheckout(formData: FormData): Promise<void> {
  const ctx = await requireYardUser();
  const plan = String(formData.get("plan"));
  if (!PLANS[plan]) throw new Error("Unknown plan");

  if (stripeEnabled()) {
    // Heal a missing subscription id (customer subscribed before we stored it) so existing
    // customers still switch in place instead of getting a second parallel subscription.
    const subscriptionId = await resolveSubscriptionId(ctx.user.id, ctx.yard);
    const yard = { ...ctx.yard, stripeSubscriptionId: subscriptionId };
    // If the yard already has a live subscription, switch its tier in place (preserving any
    // founding-customer coupon) rather than opening a second Checkout Session — which would
    // create a second parallel subscription and double-charge the customer.
    if (hasLiveStripeSubscription(yard)) {
      if (ctx.yard.plan !== plan) {
        let failure: string | null = null;
        try {
          await switchStripeSubscriptionPlan(subscriptionId!, plan);
          // one subscription covers the account → mirror the new plan onto every owned yard
          await ensureOwnerMembership(ctx.user.id, ctx.yard.id);
          await propagateOwnedYardsBilling(ctx.user.id, {
            plan,
            planStatus: "ACTIVE",
            stripeCancelAtPeriodEnd: false,
          });
          await trackEvent("plan_switched", { yardId: ctx.yard.id, meta: { plan, mode: "stripe" } });
          const amount = formatCents(PLANS[plan].priceCents);
          await sendEmail({
            yardId: ctx.yard.id,
            to: ctx.user.email,
            kind: "billing",
            subject: `Your YardCart plan is now ${PLANS[plan].name} — ${amount}/mo`,
            html: emailShell(
              `Plan changed to ${PLANS[plan].name}`,
              `<p>Your plan is now <strong>${PLANS[plan].name}</strong> at <strong>${amount}/mo</strong>. The
                prorated difference for the rest of this billing period has been charged to your card on file.</p>
               <p>See details under <a href="${process.env.APP_URL ?? "https://www.getyardcart.com"}/app/billing">Billing</a>.</p>`
            ),
          });
        } catch (e) {
          // never crash the page on a Stripe/DB hiccup — log it and show a friendly message
          await logError("billing.switch", e instanceof Error ? e.message : String(e));
          failure = billingErrorRedirect("switch", e);
        }
        revalidatePath("/app/billing");
        redirect(failure ?? "/app/billing?success=1");
      }
      revalidatePath("/app/billing");
      redirect("/app/billing?success=1");
    }
    // First-time subscribe (or resubscribe after a real cancellation): go through Checkout.
    const url = await createStripeCheckout({
      plan,
      yardId: ctx.yard.id,
      customerEmail: ctx.user.email,
    });
    redirect(url);
  }

  // MOCK mode: flip plan, record TEST invoice. Disabled in production unless the
  // owner explicitly opts in (prevents free self-activation if Stripe keys are missing).
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_MOCK_BILLING !== "1") {
    throw new Error("Billing is not configured yet — contact support.");
  }
  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setMonth(periodEnd.getMonth() + 1);
  await ensureOwnerMembership(ctx.user.id, ctx.yard.id);
  await propagateOwnedYardsBilling(ctx.user.id, { plan, planStatus: "ACTIVE" });
  await db.invoice.create({
    data: {
      yardId: ctx.yard.id,
      amountCents: PLANS[plan].priceCents,
      plan,
      periodStart: now,
      periodEnd,
      status: "TEST_PAID",
      provider: "MOCK",
    },
  });
  await trackEvent("plan_activated", { yardId: ctx.yard.id, meta: { plan, mode: "mock" } });
  await sendEmail({
    yardId: ctx.yard.id,
    to: ctx.user.email,
    kind: "billing",
    subject: `[TEST] YardCart ${PLANS[plan].name} activated — ${formatCents(PLANS[plan].priceCents)}/mo`,
    html: emailShell(
      "Subscription activated (test mode)",
      `<p>Your <strong>${PLANS[plan].name}</strong> plan is active. This is a <strong>test-mode</strong> receipt — no payment was collected.</p>`
    ),
  });
  revalidatePath("/app/billing");
  redirect("/app/billing?success=1");
}

export async function cancelPlan(): Promise<void> {
  const ctx = await requireYardUser();

  await ensureOwnerMembership(ctx.user.id, ctx.yard.id);

  // Heal a missing subscription id so an existing customer's cancel actually reaches Stripe.
  const subscriptionId = stripeEnabled()
    ? await resolveSubscriptionId(ctx.user.id, ctx.yard)
    : null;

  if (stripeEnabled() && subscriptionId) {
    // Tell Stripe to stop billing at period end. The yard keeps access (planStatus stays as-is)
    // until Stripe emits customer.subscription.deleted, which the webhook maps to CANCELED.
    let failure: string | null = null;
    try {
      await cancelStripeSubscription(subscriptionId);
      await propagateOwnedYardsBilling(ctx.user.id, { stripeCancelAtPeriodEnd: true });
      await trackEvent("plan_canceled", { yardId: ctx.yard.id, meta: { mode: "stripe" } });
    } catch (e) {
      await logError("billing.cancel", e instanceof Error ? e.message : String(e));
      failure = billingErrorRedirect("cancel", e);
    }
    revalidatePath("/app/billing");
    if (failure) redirect(failure);
    return;
  }

  // Mock/dev mode (no Stripe): keep today's local-only behavior — cancel immediately.
  await propagateOwnedYardsBilling(ctx.user.id, { planStatus: "CANCELED" });
  await trackEvent("plan_canceled", { yardId: ctx.yard.id, meta: { mode: "mock" } });
  revalidatePath("/app/billing");
}
