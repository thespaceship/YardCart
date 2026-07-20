/**
 * The public demo storefront ("Cedar Ridge Landscape Supply", a fictional yard).
 *
 * In production the demo yard exists only as a storefront: it is seeded by
 * `prisma/seed-demo-prod.ts` with no login user and no yard email. Checkout on it is
 * simulated — the order API returns a fake success without creating an order or sending
 * any email, and the storefront shows a "no real order was placed" confirmation.
 */
export const DEMO_YARD_SLUG = "cedar-ridge-demo";

/** ZIP codes the demo yard delivers to — surfaced in the demo banner so visitors know what to type. */
export const DEMO_SAMPLE_ZIP = "43004";

export function isDemoSlug(slug: string): boolean {
  return slug === DEMO_YARD_SLUG;
}
