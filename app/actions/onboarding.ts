"use server";

import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { dollarsToCents } from "@/lib/money";
import { normalizeZip, isValidZip } from "@/lib/zones";
import { zipCoords } from "@/lib/zipgeo";
import { PRODUCT_TEMPLATES } from "@/lib/templates";
import { defaultCategoryRows } from "@/lib/categories";
import { normalizeTrialPlan } from "@/lib/billing";
import { trackEvent } from "@/lib/observability";

export type OnboardingState = { error?: string };

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export async function completeOnboarding(
  _prev: OnboardingState,
  formData: FormData
): Promise<OnboardingState> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.yardId) redirect("/app");

  const yardName = String(formData.get("yardName") ?? "").trim().slice(0, 160);
  const phone = String(formData.get("phone") ?? "").trim().slice(0, 40);
  const email = String(formData.get("email") ?? "").trim().slice(0, 200);
  const city = String(formData.get("city") ?? "").trim().slice(0, 120);
  const state = String(formData.get("state") ?? "").trim().slice(0, 40);
  if (!yardName) return { error: "Yard name is required." };

  const zip = normalizeZip(String(formData.get("zip") ?? ""));
  if (!isValidZip(zip)) return { error: "Enter your yard's 5-digit ZIP code." };
  if (!zipCoords(zip)) return { error: "We don't recognize that ZIP code — please double-check it." };

  const zoneName =
    String(formData.get("zoneName") ?? "").trim().slice(0, 120) || "Local delivery";
  const radiusMiles = Math.min(
    200,
    Math.max(0, parseFloat(String(formData.get("radiusMiles") ?? "")) || 0)
  );
  if (radiusMiles <= 0) return { error: "Enter how many miles you deliver (for example, 25)." };
  const deliveryFeeCents = dollarsToCents(String(formData.get("deliveryFee") ?? "0"));
  if (deliveryFeeCents <= 0) return { error: "Set a delivery fee (you can add more zones later)." };
  const minOrderCents = dollarsToCents(String(formData.get("minOrder") ?? "0"));

  const truckName = String(formData.get("truckName") ?? "Truck 1").trim().slice(0, 120);
  const maxTripsPerDay = Math.max(1, parseInt(String(formData.get("maxTripsPerDay") ?? "6")) || 6);

  const selected: { name: string; category: string; unit: string; priceCents: number; description: string }[] = [];
  PRODUCT_TEMPLATES.forEach((t, idx) => {
    if (formData.get(`tpl_${idx}`) === "on") {
      const priceOverride = String(formData.get(`tpl_price_${idx}`) ?? "").trim();
      selected.push({
        name: t.name,
        category: t.category,
        unit: t.unit,
        priceCents: priceOverride ? dollarsToCents(priceOverride) : t.priceCents,
        description: t.description,
      });
    }
  });
  if (selected.length === 0) return { error: "Pick at least one product to sell (you can edit everything later)." };

  // unique slug
  let slug = slugify(yardName) || "yard";
  for (let i = 0; ; i++) {
    const candidate = i === 0 ? slug : `${slug}-${i + 1}`;
    const taken = await db.yard.findUnique({ where: { slug: candidate } });
    if (!taken) {
      slug = candidate;
      break;
    }
  }

  const trialEndsAt = new Date(Date.now() + 14 * 864e5);
  const yard = await db.yard.create({
    data: {
      name: yardName,
      slug,
      phone,
      email: email || user.email,
      city,
      state,
      zip,
      // Trial is scoped to the tier the owner picked on the pricing page (defaults to Starter);
      // planStatus stays TRIALING so it's still a free 14-day trial, no card required.
      plan: normalizeTrialPlan(formData.get("plan")),
      trialEndsAt,
      onboardedAt: new Date(),
      products: {
        create: selected.map((p, i) => ({ ...p, sortOrder: i })),
      },
      categories: {
        create: defaultCategoryRows(),
      },
      zones: {
        create: [{ name: zoneName, radiusMiles, centerZip: "", zipCodes: "[]", deliveryFeeCents, minOrderCents }],
      },
      trucks: {
        create: [{ name: truckName, maxTripsPerDay }],
      },
    },
  });
  await db.user.update({ where: { id: user.id }, data: { yardId: yard.id } });
  await db.yardMember.create({ data: { userId: user.id, yardId: yard.id, role: "OWNER" } });
  await trackEvent("onboarded", { yardId: yard.id });
  redirect("/app?welcome=1");
}
