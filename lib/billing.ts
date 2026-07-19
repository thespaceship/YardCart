/**
 * Billing. Two modes:
 * - MOCK (default, no STRIPE_SECRET_KEY): "test checkout" flips the plan and records
 *   a TEST invoice. Clearly watermarked in the UI. No money moves anywhere.
 * - STRIPE TEST/LIVE: when STRIPE_SECRET_KEY is set, checkout creates a real Stripe
 *   Checkout Session via REST (no SDK dependency) and the webhook activates the plan.
 */
export const PLANS: Record<
  string,
  { name: string; priceCents: number; blurb: string; features: string[] }
> = {
  STARTER: {
    name: "Starter",
    priceCents: 9900,
    blurb: "Online storefront + order inbox",
    features: ["Online ordering page", "ZIP delivery zones", "Order inbox & confirmations", "Email support"],
  },
  PRO: {
    name: "Pro",
    priceCents: 14900,
    blurb: "Everything in Starter + dispatch",
    features: [
      "Everything in Starter",
      "Dispatch board & truck capacity",
      "Printable delivery tickets",
      "Reports & QuickBooks export",
    ],
  },
  MULTI: {
    name: "Multi-yard",
    priceCents: 24900,
    blurb: "Up to 5 locations",
    features: ["Everything in Pro", "Up to 5 yards", "Priority support"],
  },
};

/** Is this yard's subscription (or trial) currently good for online ordering? */
export function yardActive(yard: { planStatus: string; trialEndsAt: Date | null }): boolean {
  if (yard.planStatus === "ACTIVE") return true;
  if (yard.planStatus === "TRIALING") {
    return !yard.trialEndsAt || yard.trialEndsAt.getTime() > Date.now();
  }
  return false;
}

export function stripeEnabled(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

/** Create a Stripe Checkout Session via REST. Returns the redirect URL. */
export async function createStripeCheckout(opts: {
  plan: string;
  yardId: string;
  customerEmail: string;
}): Promise<string> {
  const key = process.env.STRIPE_SECRET_KEY!;
  const plan = PLANS[opts.plan];
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const params = new URLSearchParams({
    mode: "subscription",
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][unit_amount]": String(plan.priceCents),
    "line_items[0][price_data][recurring][interval]": "month",
    "line_items[0][price_data][product_data][name]": `YardCart ${plan.name}`,
    success_url: `${appUrl}/app/billing?success=1`,
    cancel_url: `${appUrl}/app/billing?canceled=1`,
    customer_email: opts.customerEmail,
    "metadata[yardId]": opts.yardId,
    "metadata[plan]": opts.plan,
    "subscription_data[metadata][yardId]": opts.yardId,
    "subscription_data[metadata][plan]": opts.plan,
  });
  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });
  if (!res.ok) throw new Error(`Stripe checkout failed: ${res.status} ${await res.text()}`);
  const session = (await res.json()) as { url: string };
  return session.url;
}
