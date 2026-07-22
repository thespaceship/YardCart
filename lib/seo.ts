/**
 * Canonical site metadata used for SEO: metadataBase, sitemap, robots, JSON-LD.
 *
 * SITE_URL is the production origin (no trailing slash). Override with
 * NEXT_PUBLIC_SITE_URL in the environment; falls back to the live domain.
 */
// Canonical host is www — the apex getyardcart.com 308-redirects to www.getyardcart.com,
// so URLs in the sitemap/canonicals/JSON-LD must use www to avoid redirect chains.
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  "https://www.getyardcart.com"
).replace(/\/$/, "");

export const SITE_NAME = "YardCart";

export const SITE_TAGLINE =
  "Online ordering & dispatch for landscape supply yards";

export const SITE_DESCRIPTION =
  "Take bulk mulch, topsoil, and firewood orders online 24/7. Zone-based delivery pricing, a dispatch board your drivers actually use, and no per-order fees.";

/** Absolute URL for a site-relative path. */
export function absoluteUrl(path = "/"): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Organization + SoftwareApplication JSON-LD for the marketing site.
 * Rendered on the homepage so search engines and AI agents can identify
 * what YardCart is, who it's for, and how it's priced.
 */
export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    alternateName: ["YardCart", "Yard Cart", "getyardcart", "getyardcart.com"],
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    slogan: SITE_TAGLINE,
    logo: absoluteUrl("/icon.png"),
    sameAs: [] as string[], // add social/profile URLs here as they go live
  };
}

/**
 * WebSite JSON-LD — helps Google resolve the site's display name in results
 * ("YardCart" rather than the bare domain) and is a prerequisite signal for
 * the site-name / sitelinks treatment.
 */
export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    alternateName: "Yard Cart",
    url: SITE_URL,
  };
}

export function softwareApplicationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: SITE_NAME,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    offers: {
      "@type": "Offer",
      price: "99",
      priceCurrency: "USD",
      priceSpecification: {
        "@type": "UnitPriceSpecification",
        price: "99",
        priceCurrency: "USD",
        unitText: "MONTH",
      },
    },
    audience: {
      "@type": "BusinessAudience",
      audienceType:
        "Landscape supply yards, garden centers, mulch and topsoil yards, firewood sellers",
    },
    featureList: [
      "24/7 online ordering for bulk landscape materials",
      "Delivery pricing by ZIP code / zone",
      "Truck capacity-aware delivery scheduling",
      "Dispatch board and printable delivery tickets",
      "Flat monthly price with no per-order fees",
    ],
  };
}
