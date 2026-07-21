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
    allow_promotion_codes: "true",
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

const STRIPE_API = "https://api.stripe.com/v1";

function stripeHeaders(): HeadersInit {
  return {
    Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY!}`,
    "Content-Type": "application/x-www-form-urlencoded",
  };
}

/**
 * Does this yard have a live Stripe subscription we can modify in place (switch tier
 * or cancel), as opposed to needing a brand-new Checkout Session? A subscription that
 * was truly canceled clears stripeSubscriptionId (see webhook), so its presence — for a
 * yard that is ACTIVE or merely PAST_DUE — means "modify the existing sub."
 */
export function hasLiveStripeSubscription(yard: {
  planStatus: string;
  stripeSubscriptionId: string | null;
}): boolean {
  return (
    Boolean(yard.stripeSubscriptionId) &&
    (yard.planStatus === "ACTIVE" || yard.planStatus === "PAST_DUE")
  );
}

const LIVE_SUB_STATUSES = ["active", "trialing", "past_due", "unpaid"];

/**
 * Find a customer's current (non-canceled) subscription id. Used to heal yards that were
 * subscribed before we started persisting stripeSubscriptionId — without this, an existing
 * customer's cancel would miss Stripe and a tier switch would spawn a second subscription.
 */
export async function getActiveSubscriptionId(customerId: string): Promise<string | null> {
  const res = await fetch(
    `${STRIPE_API}/subscriptions?customer=${encodeURIComponent(customerId)}&status=all&limit=100`,
    { headers: stripeHeaders() }
  );
  if (!res.ok) throw new Error(`Stripe subscription list failed: ${res.status} ${await res.text()}`);
  const body = (await res.json()) as { data: Array<{ id: string; status: string }> };
  const live = body.data.find((s) => LIVE_SUB_STATUSES.includes(s.status));
  return live?.id ?? null;
}

/**
 * Fetch a subscription and its (single) line item's id + Stripe product id. Both are needed to
 * swap the price on a tier switch: the Subscriptions API's inline price_data requires a `product`
 * id (unlike Checkout's price_data, which accepts inline product_data).
 */
export async function getStripeSubscription(
  subscriptionId: string
): Promise<{ id: string; status: string; itemId: string; productId?: string } | null> {
  const res = await fetch(`${STRIPE_API}/subscriptions/${encodeURIComponent(subscriptionId)}`, {
    headers: stripeHeaders(),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Stripe subscription fetch failed: ${res.status} ${await res.text()}`);
  const sub = (await res.json()) as {
    id: string;
    status: string;
    items: { data: Array<{ id: string; price?: { product?: string | { id?: string } } }> };
  };
  const item = sub.items.data[0];
  // price.product is normally a string id, but tolerate an expanded object just in case
  const rawProduct = item?.price?.product;
  const productId = typeof rawProduct === "string" ? rawProduct : rawProduct?.id;
  return { id: sub.id, status: sub.status, itemId: item?.id, productId };
}

/** Create a Stripe Product and return its id (fallback when a subscription item has no product). */
async function createStripeProduct(name: string): Promise<string> {
  const res = await fetch(`${STRIPE_API}/products`, {
    method: "POST",
    headers: stripeHeaders(),
    body: new URLSearchParams({ name }).toString(),
  });
  if (!res.ok) throw new Error(`Stripe product create failed: ${res.status} ${await res.text()}`);
  return ((await res.json()) as { id: string }).id;
}

/**
 * Switch an existing subscription to a different tier by swapping the price on its single line
 * item. This preserves the subscription — and therefore any founding-customer coupon attached to
 * it — instead of creating a second parallel subscription that would double-charge the customer.
 * The subscription's existing Stripe product is reused (its name kept in sync, best-effort) since
 * the Subscriptions API's price_data needs a product id, not inline product_data.
 * proration_behavior=create_prorations charges/credits the difference for the current period, the
 * Stripe default for a self-serve tier change.
 */
export async function switchStripeSubscriptionPlan(subscriptionId: string, plan: string): Promise<void> {
  const p = PLANS[plan];
  if (!p) throw new Error(`Unknown plan ${plan}`);
  const sub = await getStripeSubscription(subscriptionId);
  if (!sub || !sub.itemId) throw new Error(`Subscription ${subscriptionId} has no line item to switch`);

  let productId = sub.productId;
  if (productId) {
    // keep the product name aligned with the new tier; cosmetic, so don't block the switch on it
    try {
      await fetch(`${STRIPE_API}/products/${encodeURIComponent(productId)}`, {
        method: "POST",
        headers: stripeHeaders(),
        body: new URLSearchParams({ name: `YardCart ${p.name}` }).toString(),
      });
    } catch {
      /* non-fatal: the tier switch below is what matters */
    }
  } else {
    productId = await createStripeProduct(`YardCart ${p.name}`);
  }

  const params = new URLSearchParams({
    "items[0][id]": sub.itemId,
    "items[0][price_data][currency]": "usd",
    "items[0][price_data][unit_amount]": String(p.priceCents),
    "items[0][price_data][recurring][interval]": "month",
    "items[0][price_data][product]": productId,
    proration_behavior: "create_prorations",
    "metadata[plan]": plan,
    cancel_at_period_end: "false", // switching tiers also un-schedules any pending cancellation
  });
  const res = await fetch(`${STRIPE_API}/subscriptions/${encodeURIComponent(subscriptionId)}`, {
    method: "POST",
    headers: stripeHeaders(),
    body: params.toString(),
  });
  if (!res.ok) throw new Error(`Stripe subscription switch failed: ${res.status} ${await res.text()}`);
}

/**
 * Cancel a subscription at the end of the current billing period (cancel_at_period_end=true).
 * Chosen over an immediate DELETE because it is the standard self-serve SaaS default (it matches
 * Stripe's own customer portal): the customer keeps the access they have already paid for through
 * the current period, so there is no surprise service cut-off and no refund/proration to handle.
 * Stripe emits customer.subscription.deleted when the period actually ends, which the webhook maps
 * to planStatus=CANCELED.
 */
export async function cancelStripeSubscription(subscriptionId: string): Promise<void> {
  const params = new URLSearchParams({ cancel_at_period_end: "true" });
  const res = await fetch(`${STRIPE_API}/subscriptions/${encodeURIComponent(subscriptionId)}`, {
    method: "POST",
    headers: stripeHeaders(),
    body: params.toString(),
  });
  if (!res.ok) throw new Error(`Stripe cancel failed: ${res.status} ${await res.text()}`);
}
