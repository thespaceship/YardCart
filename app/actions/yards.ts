"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSessionUser, requireYardUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { assertPlan } from "@/lib/entitlements";
import {
  MAX_YARDS_PER_ACCOUNT,
  billingMirror,
  ensureOwnerMembership,
  getOwnedYards,
  isYardMember,
} from "@/lib/yards";
import { trackEvent } from "@/lib/observability";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

async function uniqueSlug(name: string): Promise<string> {
  const base = slugify(name) || "yard";
  for (let i = 0; ; i++) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`;
    const taken = await db.yard.findUnique({ where: { slug: candidate } });
    if (!taken) return candidate;
  }
}

/** Create an additional location for a Multi-plan owner, capped at 5. The new yard mirrors the
 *  current yard's billing (one subscription covers the account) and becomes the active yard. */
export async function createLocation(formData: FormData): Promise<void> {
  const ctx = await requireYardUser();
  assertPlan(ctx.yard, "MULTI"); // multi-location is a Multi-plan feature

  // make sure the current yard is recorded as owned before we count/cap
  await ensureOwnerMembership(ctx.user.id, ctx.yard.id);
  const owned = await getOwnedYards(ctx.user.id);
  if (owned.length >= MAX_YARDS_PER_ACCOUNT) {
    throw new Error(`You've reached the ${MAX_YARDS_PER_ACCOUNT}-location limit for the Multi-yard plan.`);
  }

  const name = String(formData.get("name") ?? "").trim().slice(0, 160);
  if (!name) throw new Error("Location name is required.");
  const slug = await uniqueSlug(name);

  const yard = await db.yard.create({
    data: {
      name,
      slug,
      timezone: ctx.yard.timezone,
      email: ctx.yard.email,
      onboardedAt: new Date(),
      ...billingMirror(ctx.yard),
    },
  });
  await db.yardMember.create({ data: { userId: ctx.user.id, yardId: yard.id, role: "OWNER" } });
  // switch the owner into the new location so they can set up its products/zones/trucks
  await db.user.update({ where: { id: ctx.user.id }, data: { yardId: yard.id } });
  await trackEvent("location_created", { yardId: yard.id, meta: { count: owned.length + 1 } });
  revalidatePath("/app/locations");
  redirect("/app/settings?new_location=1");
}

/** Switch the active yard. Only yards the user owns are selectable. */
export async function switchYard(formData: FormData): Promise<void> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const yardId = String(formData.get("yardId") ?? "");
  if (!yardId || yardId === user.yardId) redirect("/app");
  if (!(await isYardMember(user.id, yardId))) throw new Error("That location isn't on your account.");
  await db.user.update({ where: { id: user.id }, data: { yardId } });
  redirect("/app");
}
