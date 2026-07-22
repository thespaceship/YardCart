import type { Category } from "@prisma/client";

/**
 * The categories every new yard starts with. These are seeded rows, not hardcoded behavior —
 * a yard can rename, reorder, hide, or add to them. `slug` is what Product.category stores.
 */
export const DEFAULT_CATEGORIES: { slug: string; label: string }[] = [
  { slug: "mulch", label: "Mulch" },
  { slug: "soil", label: "Topsoil & Soil" },
  { slug: "compost", label: "Compost" },
  { slug: "stone", label: "Stone & Gravel" },
  { slug: "firewood", label: "Firewood" },
  { slug: "other", label: "More" },
];

export function defaultCategoryRows(): { slug: string; label: string; sortOrder: number }[] {
  return DEFAULT_CATEGORIES.map((c, i) => ({ ...c, sortOrder: i * 10 }));
}

/** Slug for a new category. Derived from the label once, then frozen — see model Category. */
export function categorySlug(label: string): string {
  return label
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

/** Title-case fallback for a slug with no Category row (legacy data, or a row since deleted). */
export function humanizeSlug(slug: string): string {
  return slug
    .split(/[-_]/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export type CategoryView = { slug: string; label: string; sortOrder: number };

/**
 * Order a yard's products into storefront sections.
 *
 * Sections follow Category.sortOrder. Products whose category has no matching row (or whose
 * category row is hidden) still get a section — dropping them would silently hide inventory the
 * owner believes is live — but those sections sort last.
 */
export function groupByCategory<T extends { category: string }>(
  products: T[],
  categories: CategoryView[]
): { slug: string; label: string; products: T[] }[] {
  const byslug = new Map(categories.map((c) => [c.slug, c]));
  const groups = new Map<string, T[]>();
  for (const p of products) {
    if (!groups.has(p.category)) groups.set(p.category, []);
    groups.get(p.category)!.push(p);
  }
  const ORPHAN_SORT = Number.MAX_SAFE_INTEGER;
  return [...groups.entries()]
    .map(([slug, items]) => {
      const cat = byslug.get(slug);
      return {
        slug,
        label: cat?.label ?? humanizeSlug(slug),
        sortOrder: cat?.sortOrder ?? ORPHAN_SORT,
        products: items,
      };
    })
    .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label))
    .map(({ slug, label, products }) => ({ slug, label, products }));
}

export function toView(c: Pick<Category, "slug" | "label" | "sortOrder">): CategoryView {
  return { slug: c.slug, label: c.label, sortOrder: c.sortOrder };
}

/** Spacing between sort orders, leaving room to slot a category in without renumbering. */
export const SORT_STEP = 10;

/**
 * Move one item a single position within a list. Returns a new array, or the same one unchanged
 * when the item is already at that end — callers treat "no move possible" as a no-op, not an error.
 */
export function moveInList<T>(items: T[], index: number, direction: "up" | "down"): T[] {
  const target = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || index >= items.length || target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

/**
 * Sort orders for a list already in its intended order.
 *
 * Renumbering the whole list on every move (rather than swapping two values) keeps the even
 * spacing intact and quietly repairs ties — two categories sharing a sort order can't be
 * reordered by swapping, since swapping equal values changes nothing.
 */
export function sortOrdersFor(count: number): number[] {
  return Array.from({ length: count }, (_, i) => i * SORT_STEP);
}
