// Server-only: touches the database. Kept out of lib/categories.ts because that module holds the
// pure helpers and is imported by components/Storefront.tsx, a client component — a `db` import
// there would try to bundle Prisma for the browser.
import { db } from "./db";
import { defaultCategoryRows } from "./categories";

/**
 * Guarantee a yard has categories to file products under.
 *
 * Categories arrive two ways: onboarding creates them for new yards, and a migration backfilled
 * every yard that existed when it ran. Neither covers a yard created *after* that migration by
 * code that predates the feature — which is exactly what happens when the database is migrated
 * ahead of the deploy that ships the matching code.
 *
 * Rather than depend on those two paths having lined up, the app repairs itself on read. Cheap
 * (one COUNT on a page that already makes several queries), idempotent, and it means a yard can
 * never reach the Products page with an empty category picker and an unusable product form.
 */
export async function ensureDefaultCategories(yardId: string): Promise<void> {
  const existing = await db.category.count({ where: { yardId } });
  if (existing > 0) return;
  await db.category.createMany({
    data: defaultCategoryRows().map((c) => ({ ...c, yardId })),
    skipDuplicates: true, // concurrent first loads must not collide on (yardId, slug)
  });
}
