import { describe, it, expect } from "vitest";
import {
  categorySlug,
  humanizeSlug,
  groupByCategory,
  defaultCategoryRows,
  moveInList,
  sortOrdersFor,
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

describe("moveInList", () => {
  const list = ["a", "b", "c", "d"];

  it("moves an item up one position", () => {
    expect(moveInList(list, 2, "up")).toEqual(["a", "c", "b", "d"]);
  });

  it("moves an item down one position", () => {
    expect(moveInList(list, 1, "down")).toEqual(["a", "c", "b", "d"]);
  });

  it("returns the original array when already at the top", () => {
    // identity, not a copy — the caller uses that to skip a pointless database write
    expect(moveInList(list, 0, "up")).toBe(list);
  });

  it("returns the original array when already at the bottom", () => {
    expect(moveInList(list, 3, "down")).toBe(list);
  });

  it("returns the original array for an index that isn't in the list", () => {
    expect(moveInList(list, -1, "down")).toBe(list);
    expect(moveInList(list, 99, "up")).toBe(list);
  });

  it("does not mutate the input", () => {
    const original = [...list];
    moveInList(list, 2, "up");
    expect(list).toEqual(original);
  });

  it("handles a single-item list", () => {
    expect(moveInList(["only"], 0, "up")).toEqual(["only"]);
    expect(moveInList(["only"], 0, "down")).toEqual(["only"]);
  });

  it("round-trips: down then up returns to the start", () => {
    expect(moveInList(moveInList(list, 1, "down"), 2, "up")).toEqual(list);
  });
});

describe("sortOrdersFor", () => {
  it("spaces orders so a category can be slotted between two others", () => {
    expect(sortOrdersFor(4)).toEqual([0, 10, 20, 30]);
  });

  it("handles an empty list", () => {
    expect(sortOrdersFor(0)).toEqual([]);
  });

  it("renumbering repairs ties that a plain swap could never reorder", () => {
    // two categories sharing sortOrder 20 can't be swapped — swapping equal values is a no-op
    const tied: CategoryView[] = [
      { slug: "a", label: "Alpha", sortOrder: 20 },
      { slug: "b", label: "Bravo", sortOrder: 20 },
      { slug: "c", label: "Charlie", sortOrder: 20 },
    ];
    const moved = moveInList(tied, 2, "up");
    const orders = sortOrdersFor(moved.length);
    const renumbered = moved.map((c, i) => ({ ...c, sortOrder: orders[i] }));
    expect(renumbered.map((c) => c.slug)).toEqual(["a", "c", "b"]);
    expect(renumbered.map((c) => c.sortOrder)).toEqual([0, 10, 20]);
    // and the new order actually survives a re-sort, which the tied version would not have
    expect(groupByCategory([p("x", "a"), p("y", "b"), p("z", "c")], renumbered).map((s) => s.slug))
      .toEqual(["a", "c", "b"]);
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
