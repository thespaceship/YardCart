import { describe, it, expect } from "vitest";
import { planRank, meetsPlan, assertPlan } from "@/lib/entitlements";

const yard = (over: Partial<{ plan: string; planStatus: string; trialEndsAt: Date | null }> = {}) => ({
  plan: "STARTER",
  planStatus: "ACTIVE",
  trialEndsAt: null,
  ...over,
});

describe("planRank", () => {
  it("orders the additive tiers", () => {
    expect(planRank("TRIAL")).toBeLessThan(planRank("STARTER"));
    expect(planRank("STARTER")).toBeLessThan(planRank("PRO"));
    expect(planRank("PRO")).toBeLessThan(planRank("MULTI"));
    expect(planRank("bogus")).toBe(0);
  });
});

describe("meetsPlan — paid tiers", () => {
  it("allows at-or-above the required tier", () => {
    expect(meetsPlan(yard({ plan: "PRO" }), "PRO")).toBe(true);
    expect(meetsPlan(yard({ plan: "MULTI" }), "PRO")).toBe(true);
  });
  it("rejects under the required tier", () => {
    expect(meetsPlan(yard({ plan: "STARTER" }), "PRO")).toBe(false);
    expect(meetsPlan(yard({ plan: "STARTER" }), "MULTI")).toBe(false);
  });
});

describe("meetsPlan — trials", () => {
  const future = new Date(Date.now() + 7 * 864e5);
  const past = new Date(Date.now() - 864e5);
  it("gives an active trial full access to evaluate Pro features", () => {
    expect(meetsPlan(yard({ plan: "TRIAL", planStatus: "TRIALING", trialEndsAt: future }), "PRO")).toBe(true);
    expect(meetsPlan(yard({ plan: "TRIAL", planStatus: "TRIALING", trialEndsAt: null }), "MULTI")).toBe(true);
  });
  it("blocks Pro features once the trial has expired", () => {
    expect(meetsPlan(yard({ plan: "TRIAL", planStatus: "TRIALING", trialEndsAt: past }), "PRO")).toBe(false);
  });
});

describe("assertPlan", () => {
  it("throws for an under-tier yard and passes for an at-tier yard", () => {
    expect(() => assertPlan(yard({ plan: "STARTER" }), "PRO")).toThrow(/PRO plan/);
    expect(() => assertPlan(yard({ plan: "PRO" }), "PRO")).not.toThrow();
  });
});
