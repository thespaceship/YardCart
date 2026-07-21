import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  hasLiveStripeSubscription,
  cancelStripeSubscription,
  switchStripeSubscriptionPlan,
  getStripeSubscription,
  getActiveSubscriptionId,
  PLANS,
} from "@/lib/billing";

// Stripe REST calls are exercised with a mocked global fetch — no network, no real key needed.
type Call = { url: string; method: string; body: URLSearchParams };

function mockFetch(handler: (url: string, init?: RequestInit) => unknown) {
  const calls: Call[] = [];
  const fn = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({
      url,
      method: (init?.method ?? "GET").toUpperCase(),
      body: new URLSearchParams((init?.body as string) ?? ""),
    });
    const payload = handler(url, init);
    return {
      ok: true,
      status: 200,
      json: async () => payload,
      text: async () => JSON.stringify(payload),
    } as unknown as Response;
  });
  vi.stubGlobal("fetch", fn);
  return calls;
}

beforeEach(() => {
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_fake");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("hasLiveStripeSubscription", () => {
  it("is true only when a subscription id exists AND the plan is ACTIVE or PAST_DUE", () => {
    expect(hasLiveStripeSubscription({ planStatus: "ACTIVE", stripeSubscriptionId: "sub_1" })).toBe(true);
    expect(hasLiveStripeSubscription({ planStatus: "PAST_DUE", stripeSubscriptionId: "sub_1" })).toBe(true);
    // no subscription id → must go through Checkout (first-time subscribe)
    expect(hasLiveStripeSubscription({ planStatus: "ACTIVE", stripeSubscriptionId: null })).toBe(false);
    // canceled/trialing yards resubscribe via Checkout, not an in-place switch
    expect(hasLiveStripeSubscription({ planStatus: "CANCELED", stripeSubscriptionId: "sub_1" })).toBe(false);
    expect(hasLiveStripeSubscription({ planStatus: "TRIALING", stripeSubscriptionId: null })).toBe(false);
  });
});

describe("cancelStripeSubscription", () => {
  it("tells Stripe to cancel at period end via POST /v1/subscriptions/:id", async () => {
    const calls = mockFetch(() => ({ id: "sub_123" }));
    await cancelStripeSubscription("sub_123");
    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe("POST");
    expect(calls[0].url).toBe("https://api.stripe.com/v1/subscriptions/sub_123");
    expect(calls[0].body.get("cancel_at_period_end")).toBe("true");
  });
});

describe("switchStripeSubscriptionPlan", () => {
  it("swaps the price on the existing subscription instead of creating a second one", async () => {
    const calls = mockFetch((url, init) => {
      if ((init?.method ?? "GET").toUpperCase() === "GET") {
        // GET returns the sub with its single line item and the item's Stripe product id
        return { id: "sub_123", status: "active", items: { data: [{ id: "si_abc", price: { product: "prod_x" } }] } };
      }
      return { id: "sub_123" };
    });

    await switchStripeSubscriptionPlan("sub_123", "PRO");

    // NO second subscription / checkout session is ever created
    expect(calls.some((c) => c.url.includes("/checkout/sessions"))).toBe(false);

    // the tier change is a POST to the SAME subscription
    const post = calls.find((c) => c.method === "POST" && c.url === "https://api.stripe.com/v1/subscriptions/sub_123")!;
    expect(post).toBeTruthy();
    expect(post.body.get("items[0][id]")).toBe("si_abc");
    expect(post.body.get("items[0][price_data][unit_amount]")).toBe(String(PLANS.PRO.priceCents));
    expect(post.body.get("items[0][price_data][recurring][interval]")).toBe("month");
    // Subscriptions API needs a product id (not inline product_data): reuse the existing product
    expect(post.body.get("items[0][price_data][product]")).toBe("prod_x");
    expect(post.body.has("items[0][price_data][product_data][name]")).toBe(false);
    // a founding-customer coupon lives on the subscription/customer and is left untouched
    expect(post.body.has("coupon")).toBe(false);
  });

  it("throws if the subscription has no line item to switch", async () => {
    mockFetch(() => ({ id: "sub_123", status: "active", items: { data: [] } }));
    await expect(switchStripeSubscriptionPlan("sub_123", "PRO")).rejects.toThrow(/no line item/);
  });
});

describe("getActiveSubscriptionId (heals pre-existing customers)", () => {
  it("returns the first live subscription, ignoring canceled ones", async () => {
    mockFetch(() => ({
      data: [
        { id: "sub_dead", status: "canceled" },
        { id: "sub_live", status: "active" },
      ],
    }));
    expect(await getActiveSubscriptionId("cus_1")).toBe("sub_live");
  });
  it("returns null when the customer has no live subscription", async () => {
    mockFetch(() => ({ data: [{ id: "sub_dead", status: "canceled" }] }));
    expect(await getActiveSubscriptionId("cus_1")).toBeNull();
  });
  it("queries by customer id", async () => {
    const calls = mockFetch(() => ({ data: [] }));
    await getActiveSubscriptionId("cus_42");
    expect(calls[0].url).toContain("/subscriptions?customer=cus_42");
  });
});

describe("getStripeSubscription", () => {
  it("extracts the first line-item id", async () => {
    mockFetch(() => ({ id: "sub_9", status: "active", items: { data: [{ id: "si_9" }] } }));
    const sub = await getStripeSubscription("sub_9");
    expect(sub).toEqual({ id: "sub_9", status: "active", itemId: "si_9" });
  });
});
