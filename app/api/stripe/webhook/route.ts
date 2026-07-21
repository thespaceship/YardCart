import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";
import { PLANS } from "@/lib/billing";
import { ownedYardIdsForYard } from "@/lib/yards";
import { sendEmail, emailShell } from "@/lib/mailer";
import { formatCents } from "@/lib/money";
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
        // idempotency: Stripe redelivers events; skip if this session already recorded
        const existing = await db.invoice.findFirst({
          where: { externalId: String(session.id ?? "") },
        });
        if (!existing) {
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
                stripeSubscriptionId: session.subscription ?? undefined,
                stripeCancelAtPeriodEnd: false,
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
                provider: session.livemode ? "STRIPE" : "STRIPE_TEST",
                externalId: String(session.id ?? ""),
              },
            }),
          ]);
          // Multi-yard: mirror the (re)subscription onto the owner's other yards, if any.
          const siblings = (await ownedYardIdsForYard(yardId)).filter((id) => id !== yardId);
          if (siblings.length) {
            await db.yard.updateMany({
              where: { id: { in: siblings } },
              data: {
                plan,
                planStatus: "ACTIVE",
                stripeCustomerId: session.customer ?? undefined,
                stripeSubscriptionId: session.subscription ?? undefined,
                stripeCancelAtPeriodEnd: false,
              },
            });
          }
          // Payment confirmation / receipt (Stripe also emails its own receipt if enabled in the
          // Dashboard; this is the branded YardCart confirmation and always lands in /app/mailbox).
          const yard = await db.yard.findUnique({ where: { id: yardId }, select: { email: true } });
          const to = session.customer_details?.email ?? session.customer_email ?? yard?.email;
          if (to) {
            const amount = formatCents(PLANS[plan].priceCents);
            await sendEmail({
              yardId,
              to,
              kind: "billing",
              subject: `Your YardCart ${PLANS[plan].name} plan is active — ${amount}/mo`,
              html: emailShell(
                `You're subscribed to ${PLANS[plan].name}`,
                `<p>Thanks! Your <strong>${PLANS[plan].name}</strong> plan is active at <strong>${amount}/mo</strong>.</p>
                 <p>You can view invoices and manage your plan anytime under <a href="${process.env.APP_URL ?? "https://www.getyardcart.com"}/app/billing">Billing</a>.</p>`
              ),
            });
          }
        }
      }
    } else if (event.type === "customer.subscription.deleted") {
      // Fired when the subscription actually ends (immediately, or at period end after a
      // cancel_at_period_end cancellation). Clear the stored subscription id so a later
      // resubscribe goes through Checkout instead of trying to modify a dead subscription.
      const sub = event.data.object;
      const yardId = sub.metadata?.yardId;
      const canceled = { planStatus: "CANCELED", stripeSubscriptionId: null, stripeCancelAtPeriodEnd: false };
      if (yardId) {
        await db.yard.update({ where: { id: yardId }, data: canceled });
      } else if (sub.id) {
        // fall back to the stored subscription id if metadata is missing
        await db.yard.updateMany({ where: { stripeSubscriptionId: String(sub.id) }, data: canceled });
      }
    } else if (event.type === "invoice.payment_failed") {
      const customer = event.data.object?.customer;
      if (customer) {
        await db.yard.updateMany({
          where: { stripeCustomerId: String(customer) },
          data: { planStatus: "PAST_DUE" },
        });
      }
    }
    return NextResponse.json({ received: true });
  } catch (e) {
    await logError("stripe.webhook", e instanceof Error ? e.message : String(e));
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
