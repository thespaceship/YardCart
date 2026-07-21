/**
 * Plan entitlements. Tiers are additive (Pro = Starter + more, Multi = Pro + more), so we
 * model them as a rank, not a per-feature boolean matrix. Used both to render nav links and
 * to guard pages/routes/actions server-side — never rely on hiding a nav link alone, since a
 * yard could hit a gated URL directly.
 */
const RANK: Record<string, number> = { TRIAL: 0, STARTER: 1, PRO: 2, MULTI: 3 };

export function planRank(plan: string): number {
  return RANK[plan] ?? 0;
}

export type YardTier = { plan: string; planStatus: string; trialEndsAt: Date | null };

/** On a trial that hasn't expired yet? (mirrors billing.yardActive's trial check) */
function onActiveTrial(yard: YardTier): boolean {
  return (
    yard.planStatus === "TRIALING" &&
    (!yard.trialEndsAt || yard.trialEndsAt.getTime() > Date.now())
  );
}

/**
 * Does the yard's plan meet or exceed `required`?
 *
 * A yard that is still TRIALING has never paid, so its `plan` records which tier the owner chose to
 * try, not an entitlement they've bought. While the trial is live they get access up to that tier
 * (a Starter trial doesn't see Pro/Multi features); once it expires the account is frozen — every
 * gated feature locks until they pick a paid plan. Legacy trials created before tier selection carry
 * plan="TRIAL"; treat those as Starter so they keep the base app while the trial runs.
 *
 * For a converted (paid) plan the tier rank applies directly, as before.
 */
export function meetsPlan(yard: YardTier, required: string): boolean {
  if (yard.planStatus === "TRIALING") {
    if (!onActiveTrial(yard)) return false; // expired trial → frozen until they subscribe
    const trialTier = yard.plan === "TRIAL" ? "STARTER" : yard.plan;
    return planRank(trialTier) >= planRank(required);
  }
  return planRank(yard.plan) >= planRank(required);
}

/** Throw if the yard is below `required` — for guarding server actions / API routes on direct hits. */
export function assertPlan(yard: YardTier, required: string): void {
  if (!meetsPlan(yard, required)) {
    throw new Error(`This feature requires the ${required} plan or higher — upgrade at /app/billing.`);
  }
}
