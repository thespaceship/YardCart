import { describe, it, expect, afterAll } from "vitest";
import { db } from "@/lib/db";
import { ensureDefaultCategories } from "@/lib/categories.server";
import { DEFAULT_CATEGORIES } from "@/lib/categories";

/**
 * Reproduces the gap that let a yard exist with no categories: the database was migrated (and its
 * one-shot backfill spent) before the deploy that shipped category-aware onboarding, so any yard
 * signing up in that window got none. The Products page repairs it on read.
 */

const created: string[] = [];

async function makeYard(withCategories: boolean) {
  const yard = await db.yard.create({
    data: {
      name: "Ensure Test Yard",
      slug: `ensure-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      ...(withCategories
        ? { categories: { create: [{ slug: "mulch", label: "Mulch", sortOrder: 0 }] } }
        : {}),
    },
  });
  created.push(yard.id);
  return yard.id;
}

afterAll(async () => {
  for (const id of created) await db.yard.delete({ where: { id } }).catch(() => {});
});

describe("ensureDefaultCategories", () => {
  it("seeds the built-ins for a yard that has none", async () => {
    const yardId = await makeYard(false);
    expect(await db.category.count({ where: { yardId } })).toBe(0);

    await ensureDefaultCategories(yardId);

    const rows = await db.category.findMany({ where: { yardId }, orderBy: { sortOrder: "asc" } });
    expect(rows.map((r) => r.slug)).toEqual(DEFAULT_CATEGORIES.map((c) => c.slug));
    expect(rows.every((r) => r.active)).toBe(true);
  });

  it("leaves an existing set alone rather than topping it up", async () => {
    // a yard that deliberately hid or deleted categories must not have them silently restored
    const yardId = await makeYard(true);
    await ensureDefaultCategories(yardId);

    const rows = await db.category.findMany({ where: { yardId } });
    expect(rows).toHaveLength(1);
    expect(rows[0].slug).toBe("mulch");
  });

  it("is safe to call repeatedly", async () => {
    const yardId = await makeYard(false);
    await ensureDefaultCategories(yardId);
    await ensureDefaultCategories(yardId);
    await ensureDefaultCategories(yardId);
    expect(await db.category.count({ where: { yardId } })).toBe(DEFAULT_CATEGORIES.length);
  });

  it("survives concurrent first loads without a unique-constraint crash", async () => {
    // two browser tabs hitting Products at once must not race each other onto (yardId, slug)
    const yardId = await makeYard(false);
    await Promise.all([
      ensureDefaultCategories(yardId),
      ensureDefaultCategories(yardId),
      ensureDefaultCategories(yardId),
    ]);
    expect(await db.category.count({ where: { yardId } })).toBe(DEFAULT_CATEGORIES.length);
  });
});
