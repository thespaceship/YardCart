import { describe, it, expect } from "vitest";
import {
  categorySlug,
  humanizeSlug,
  groupByCategory,
  defaultCategoryRows,
  type CategoryView,
} from "@/lib/categories";

const cats: CategoryView[] = [
  { slug: "mulch", label: "Mulch", sortOrder: 0 },
  { slug: "stone", label: "Stone & Gravel", sortOrder: 30 },
  { slug: "sand", label: "Sand", sortOrder: 15 },
];

const p = (name: string, category: string) => ({ name, category });

describe("categorySlug", () => {
  it("slugifies a label", () => {
    expect(categorySlug("Construction Material")).toBe("construction-material");
  });

  it("spells out ampersands rather than dropping them", () => {
    // "Stone & Gravel" and "Stone Gravel" must not collide on the same slug
    expect(categorySlug("Stone & Gravel")).toBe("stone-and-gravel");
  });

  it("trims punctuation to a clean slug", () => {
    expect(categorySlug("  Boulders!! ")).toBe("boulders");
    expect(categorySlug("#$%")).toBe("");
  });

  it("caps length so the slug stays a sane key", () => {
    expect(categorySlug("x".repeat(80)).length).toBe(48);
  });
});

describe("humanizeSlug", () => {
  it("title-cases a slug for display", () => {
    expect(humanizeSlug("construction-material")).toBe("Construction Material");
  });
});

describe("defaultCategoryRows", () => {
  it("gives the six built-ins spaced for insertion", () => {
    const rows = defaultCategoryRows();
    expect(rows.map((r) => r.slug)).toEqual([
      "mulch",
      "soil",
      "compost",
      "stone",
      "firewood",
      "other",
    ]);
    // gaps of 10 let an owner slot a new category between two existing ones
    expect(rows.map((r) => r.sortOrder)).toEqual([0, 10, 20, 30, 40, 50]);
  });
});

describe("groupByCategory", () => {
  it("orders sections by sortOrder, not product order", () => {
    const out = groupByCategory(
      [p("Gravel", "stone"), p("Bark", "mulch"), p("Play Sand", "sand")],
      cats
    );
    expect(out.map((s) => s.slug)).toEqual(["mulch", "sand", "stone"]);
  });

  it("labels each section from the category row", () => {
    const out = groupByCategory([p("Gravel", "stone")], cats);
    expect(out[0].label).toBe("Stone & Gravel");
  });

  it("keeps every product in its section", () => {
    const out = groupByCategory([p("Bark", "mulch"), p("Cedar", "mulch")], cats);
    expect(out).toHaveLength(1);
    expect(out[0].products.map((x) => x.name)).toEqual(["Bark", "Cedar"]);
  });

  it("still shows products whose category row is missing, sorted last", () => {
    // a category deleted straight out of the DB must not silently hide live inventory
    const out = groupByCategory([p("Rebar", "construction-material"), p("Bark", "mulch")], cats);
    expect(out.map((s) => s.slug)).toEqual(["mulch", "construction-material"]);
    expect(out[1].label).toBe("Construction Material");
  });

  it("breaks sortOrder ties by label", () => {
    const tied: CategoryView[] = [
      { slug: "b", label: "Bravo", sortOrder: 5 },
      { slug: "a", label: "Alpha", sortOrder: 5 },
    ];
    const out = groupByCategory([p("x", "b"), p("y", "a")], tied);
    expect(out.map((s) => s.label)).toEqual(["Alpha", "Bravo"]);
  });

  it("returns nothing for an empty catalog", () => {
    expect(groupByCategory([], cats)).toEqual([]);
  });
});
