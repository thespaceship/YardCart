import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import {
  MAX_YARDS_PER_ACCOUNT,
  canAddLocation,
  ensureOwnerMembership,
  getOwnedYards,
  isYardMember,
  propagateOwnedYardsBilling,
  ownedYardIdsForYard,
} from "@/lib/yards";

const multi = (over = {}) => ({ plan: "MULTI", planStatus: "ACTIVE", trialEndsAt: null, ...over });

describe("canAddLocation", () => {
  it("allows a Multi account under the cap", () => {
    expect(canAddLocation(multi(), 0)).toBe(true);
    expect(canAddLocation(multi(), MAX_YARDS_PER_ACCOUNT - 1)).toBe(true);
  });
  it("blocks at the cap", () => {
    expect(canAddLocation(multi(), MAX_YARDS_PER_ACCOUNT)).toBe(false);
  });
  it("blocks non-Multi plans (Pro can't add locations)", () => {
    expect(canAddLocation({ plan: "PRO", planStatus: "ACTIVE", trialEndsAt: null }, 0)).toBe(false);
  });
  it("lets a Multi trial evaluate multi-yard, but not a lower-tier trial", () => {
    const future = new Date(Date.now() + 7 * 864e5);
    expect(canAddLocation({ plan: "MULTI", planStatus: "TRIALING", trialEndsAt: future }, 0)).toBe(true);
    // a Starter/legacy trial is scoped below Multi, so it can't add locations
    expect(canAddLocation({ plan: "STARTER", planStatus: "TRIALING", trialEndsAt: future }, 0)).toBe(false);
    expect(canAddLocation({ plan: "TRIAL", planStatus: "TRIALING", trialEndsAt: future }, 0)).toBe(false);
  });
});

describe("ownership + mirroring (DB)", () => {
  const stamp = Date.now();
  let userId: string;
  const yardIds: string[] = [];

  beforeAll(async () => {
    const user = await db.user.create({
      data: { email: `owner-${stamp}@test.example.com`, passwordHash: "x", name: "Owner", role: "OWNER" },
    });
    userId = user.id;
    // three owned yards, all on MULTI/ACTIVE (mirrored)
    for (let i = 0; i < 3; i++) {
      const y = await db.yard.create({
        data: { name: `Loc ${i}`, slug: `loc-${stamp}-${i}`, plan: "MULTI", planStatus: "ACTIVE" },
      });
      yardIds.push(y.id);
      await db.yardMember.create({ data: { userId, yardId: y.id, role: "OWNER" } });
    }
    await db.user.update({ where: { id: userId }, data: { yardId: yardIds[0] } });
  });

  afterAll(async () => {
    await db.yardMember.deleteMany({ where: { userId } });
    await db.yard.deleteMany({ where: { id: { in: yardIds } } });
    await db.user.delete({ where: { id: userId } });
  });

  it("lists all owned yards oldest-first", async () => {
    const owned = await getOwnedYards(userId);
    expect(owned.map((y) => y.id)).toEqual(yardIds);
  });

  it("ensureOwnerMembership is idempotent", async () => {
    await ensureOwnerMembership(userId, yardIds[0]);
    await ensureOwnerMembership(userId, yardIds[0]);
    expect(await db.yardMember.count({ where: { userId, yardId: yardIds[0] } })).toBe(1);
  });

  it("authorizes only owned yards for switching", async () => {
    expect(await isYardMember(userId, yardIds[1])).toBe(true);
    const stranger = await db.yard.create({
      data: { name: "Stranger", slug: `stranger-${stamp}` },
    });
    expect(await isYardMember(userId, stranger.id)).toBe(false);
    await db.yard.delete({ where: { id: stranger.id } });
  });

  it("propagates a billing change to every owned yard", async () => {
    await propagateOwnedYardsBilling(userId, { planStatus: "CANCELED", stripeCancelAtPeriodEnd: true });
    const yards = await db.yard.findMany({ where: { id: { in: yardIds } } });
    expect(yards.every((y) => y.planStatus === "CANCELED")).toBe(true);
    expect(yards.every((y) => y.stripeCancelAtPeriodEnd === true)).toBe(true);
    // restore for any later assertions
    await propagateOwnedYardsBilling(userId, { planStatus: "ACTIVE", stripeCancelAtPeriodEnd: false });
  });

  it("resolves the owner's whole yard set from any one yard (webhook path)", async () => {
    const ids = await ownedYardIdsForYard(yardIds[2]);
    expect([...ids].sort()).toEqual([...yardIds].sort());
  });
});
