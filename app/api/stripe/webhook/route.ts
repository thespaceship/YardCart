import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";
import { PLANS } from "@/lib/billing";
import { logError } from "@/lib/observability";

/**
 * Stripe webhook (checkout.session.completed → activate plan).
 * Verifies the Stripe-Signature header manually (HMAC-SHA256 per Stripe docs) so no
 * SDK dependency is needed. Inactive unless STRIPE_WEBHOOK_SECRET is set.
 */
function verifyStripeSignature(payload: string, header: string, secret: string): boolean {
  const parts = Object.fromEntries(
    header.split(",").map((kv) => kv.split("=") as [string, string])
  );
  const timestamp = parts["t"];
  const sig = parts["v1"];
  if (!timestamp || !sig) return false;
  // reject events older than 5 minutes (replay protection)
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${payload}`)
    .digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "webhook_disabled" }, { status: 503 });

  const payload = await req.text();
  const sigHeader = req.headers.get("stripe-signature") ?? "";
  if (!verifyStripeSignature(payload, sigHeader, secret)) {
    return NextResponse.json({ error: "bad_signature" }, { status: 400 });
  }

  try {
    const event = JSON.parse(payload);
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const yardId = session.metadata?.yardId;
      const plan = session.metadata?.plan;
      if (yardId && plan && PLANS[plan]) {
        const now = new Date();
        const periodEnd = new Date(now);
        periodEnd.setMonth(periodEnd.getMonth() + 1);
        await db.$transaction([
          db.yard.update({
            where: { id: yardId },
            data: {
              plan,
              planStatus: "ACTIVE",
              stripeCustomerId: session.customer ?? undefined,
            },
          }),
          db.invoice.create({
            data: {
              yardId,
              amountCents: PLANS[plan].priceCents,
              plan,
              periodStart: now,
              periodEnd,
              status: session.livemode ? "PAID" : "TEST_PAID",
              provider: "STRIPE_TEST",
              externalId: String(session.id ?? ""),
            },
          }),
        ]);
      }
    }
    return NextResponse.json({ received: true });
  } catch (e) {
    await logError("stripe.webhook", e instanceof Error ? e.message : String(e));
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
