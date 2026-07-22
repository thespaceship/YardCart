import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { SITE_URL } from "@/lib/seo";
import { yardActive } from "@/lib/billing";
import { GUIDES } from "@/lib/guides";

export const revalidate = 3600; // regenerate hourly

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/pricing`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${SITE_URL}/calculator`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/guides`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    ...GUIDES.map((g) => ({
      url: `${SITE_URL}/guides/${g.slug}`,
      lastModified: new Date(g.updated),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    { url: `${SITE_URL}/security`, lastModified: now, changeFrequency: "yearly", priority: 0.4 },
    { url: `${SITE_URL}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    // Live demo storefront — a public showcase of the product.
    { url: `${SITE_URL}/s/cedar-ridge-demo`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
  ];

  // Public storefronts for real, active yards that accept online orders.
  let storefronts: MetadataRoute.Sitemap = [];
  try {
    const yards = await db.yard.findMany({
      where: {
        acceptOnlineOrders: true,
        slug: { not: "cedar-ridge-demo" },
      },
      select: { slug: true, updatedAt: true, planStatus: true, trialEndsAt: true },
    });
    storefronts = yards
      .filter((y) => yardActive(y))
      .map((y) => ({
        url: `${SITE_URL}/s/${y.slug}`,
        lastModified: y.updatedAt,
        changeFrequency: "weekly" as const,
        priority: 0.7,
      }));
  } catch {
    // If the DB is unreachable at build/request time, still serve static pages.
    storefronts = [];
  }

  return [...staticPages, ...storefronts];
}
