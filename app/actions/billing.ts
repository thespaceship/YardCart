"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireYardUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { PLANS, stripeEnabled, createStripeCheckout } from "@/lib/billing";
import { sendEmail, emailShell } from "@/lib/mailer";
import { trackEvent } from "@/lib/observability";
import { formatCents } from "@/lib/money";

export async function startCheckout(formData: FormData): Promise<void> {
  const ctx = await requireYardUser();
  const plan = String(formData.get("plan"));
  if (!PLANS[plan]) throw new Error("Unknown plan");

  if (stripeEnabled()) {
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
  await db.$transaction([
    db.yard.update({
      where: { id: ctx.yard.id },
      data: { plan, planStatus: "ACTIVE" },
    }),
    db.invoice.create({
      data: {
        yardId: ctx.yard.id,
        amountCents: PLANS[plan].priceCents,
        plan,
        periodStart: now,
        periodEnd,
        status: "TEST_PAID",
        provider: "MOCK",
      },
    }),
  ]);
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
  await db.yard.update({
    where: { id: ctx.yard.id },
    data: { planStatus: "CANCELED" },
  });
  await trackEvent("plan_canceled", { yardId: ctx.yard.id });
  revalidatePath("/app/billing");
}
