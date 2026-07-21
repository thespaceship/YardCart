import { db } from "./db";
import { meetsPlan, type YardTier } from "./entitlements";
import type { Yard } from "@prisma/client";

/** Multi-yard plan cap: "up to 5 locations". */
export const MAX_YARDS_PER_ACCOUNT = 5;

/** Billing fields mirrored across every yard an owner holds, so per-yard read paths
 *  (yardActive / meetsPlan / the billing page) keep working from whichever yard is active. */
export const BILLING_MIRROR_FIELDS = [
  "plan",
  "planStatus",
  "trialEndsAt",
  "stripeCustomerId",
  "stripeSubscriptionId",
  "stripeCancelAtPeriodEnd",
] as const;

export function billingMirror(src: Yard) {
  return {
    plan: src.plan,
    planStatus: src.planStatus,
    trialEndsAt: src.trialEndsAt,
    stripeCustomerId: src.stripeCustomerId,
    stripeSubscriptionId: src.stripeSubscriptionId,
    stripeCancelAtPeriodEnd: src.stripeCancelAtPeriodEnd,
  };
}

/** Can this account add another location? Multi plan (or active trial) AND under the cap. */
export function canAddLocation(yard: YardTier, ownedCount: number): boolean {
  return meetsPlan(yard, "MULTI") && ownedCount < MAX_YARDS_PER_ACCOUNT;
}

/** Idempotently record that `userId` owns `yardId` (heals yards created before the join table). */
export async function ensureOwnerMembership(userId: string, yardId: string): Promise<void> {
  await db.yardMember.upsert({
    where: { userId_yardId: { userId, yardId } },
    create: { userId, yardId, role: "OWNER" },
    update: {},
  });
}

/** Yards this user owns, oldest first (the first is the original onboarding yard). */
export async function getOwnedYards(userId: string): Promise<Yard[]> {
  const members = await db.yardMember.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    include: { yard: true },
  });
  return members.map((m) => m.yard);
}

export async function isYardMember(userId: string, yardId: string): Promise<boolean> {
  const m = await db.yardMember.findUnique({ where: { userId_yardId: { userId, yardId } } });
  return Boolean(m);
}

type BillingUpdate = {
  plan?: string;
  planStatus?: string;
  trialEndsAt?: Date | null;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  stripeCancelAtPeriodEnd?: boolean;
};

/** Apply a billing change to every yard this user owns (keeps the mirror in sync). For a
 *  single-yard owner this updates exactly their one yard, so it's a no-op change in behavior. */
export async function propagateOwnedYardsBilling(userId: string, data: BillingUpdate): Promise<void> {
  const rows = await db.yardMember.findMany({ where: { userId }, select: { yardId: true } });
  const ids = rows.map((r) => r.yardId);
  if (ids.length) await db.yard.updateMany({ where: { id: { in: ids } }, data });
}

/** Owner's yard ids for a given yard (for propagating billing changes from the webhook, which
 *  has no session). Falls back to [yardId] when there's no membership row yet. */
export async function ownedYardIdsForYard(yardId: string): Promise<string[]> {
  const owner = await db.yardMember.findFirst({
    where: { yardId, role: "OWNER" },
    select: { userId: true },
  });
  if (!owner) return [yardId];
  const rows = await db.yardMember.findMany({
    where: { userId: owner.userId },
    select: { yardId: true },
  });
  return rows.length ? rows.map((r) => r.yardId) : [yardId];
}
