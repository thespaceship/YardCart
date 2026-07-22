import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { yardActive } from "@/lib/billing";
import { isDemoSlug, DEMO_SAMPLE_ZIP } from "@/lib/demo";
import { trackEvent } from "@/lib/observability";
import { absoluteUrl } from "@/lib/seo";
import { toView } from "@/lib/categories";
import Storefront from "@/components/Storefront";

export async function generateMetadata(props: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await props.params;
  const yard = await db.yard.findUnique({ where: { slug }, select: { name: true, city: true, state: true } });
  if (!yard) return { title: "Not found" };
  const canonical = absoluteUrl(`/s/${slug}`);
  if (isDemoSlug(slug)) {
    return {
      title: `YardCart live demo — ${yard.name} (fictional yard)`,
      description:
        "Interactive demo of a YardCart ordering page. Cedar Ridge is a fictional yard — browse, get delivery quotes, and place a simulated order.",
      alternates: { canonical },
    };
  }
  const title = `${yard.name} — Bulk delivery, order online`;
  const description = `Order bulk mulch, topsoil, and more from ${yard.name}${yard.city ? ` in ${yard.city}, ${yard.state}` : ""}. Instant delivery pricing by ZIP code.`;
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, url: canonical, type: "website" },
  };
}

export default async function StorefrontPage(props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params;
  const yard = await db.yard.findUnique({
    where: { slug },
    include: {
      products: { where: { active: true }, orderBy: { sortOrder: "asc" } },
      categories: { orderBy: [{ sortOrder: "asc" }, { label: "asc" }] },
    },
  });
  if (!yard) notFound();
  const demo = isDemoSlug(slug);
  await trackEvent("storefront_view", { yardId: yard.id });

  const products = yard.products.map((p) => ({
    id: p.id,
    name: p.name,
    category: p.category,
    description: p.description,
    unit: p.unit,
    priceCents: p.priceCents,
    minQty: p.minQty,
    maxQty: p.maxQty,
    qtyStep: p.qtyStep,
  }));
  const categories = yard.categories.map(toView);

  // LocalBusiness structured data for real, active storefronts — makes the yard
  // eligible for local/AI results and gives its products as an offer catalog.
  const showJsonLd = !demo && yard.acceptOnlineOrders && yardActive(yard);
  const localBusinessJsonLd = showJsonLd
    ? {
        "@context": "https://schema.org",
        "@type": "LocalBusiness",
        name: yard.name,
        url: absoluteUrl(`/s/${yard.slug}`),
        ...(yard.aboutText ? { description: yard.aboutText } : {}),
        ...(yard.phone ? { telephone: yard.phone } : {}),
        ...(yard.addressLine || yard.city
          ? {
              address: {
                "@type": "PostalAddress",
                ...(yard.addressLine ? { streetAddress: yard.addressLine } : {}),
                ...(yard.city ? { addressLocality: yard.city } : {}),
                ...(yard.state ? { addressRegion: yard.state } : {}),
                ...(yard.zip ? { postalCode: yard.zip } : {}),
                addressCountry: "US",
              },
            }
          : {}),
        makesOffer: products.map((p) => ({
          "@type": "Offer",
          priceCurrency: "USD",
          price: (p.priceCents / 100).toFixed(2),
          availability: "https://schema.org/InStock",
          itemOffered: {
            "@type": "Product",
            name: p.name,
            ...(p.description ? { description: p.description } : {}),
          },
        })),
      }
    : null;

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
      {localBusinessJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessJsonLd) }}
        />
      )}
      {demo && (
        <div style={{ background: "var(--warn-soft)", color: "var(--warn)", borderBottom: "1px solid var(--line)", padding: "10px 0" }}>
          <div className="container" style={{ fontSize: "0.92rem" }}>
            <strong>Live demo</strong> — Cedar Ridge is a fictional yard. Explore everything, even
            checkout: orders here are simulated, so nothing real is placed and no emails are sent.
            Use ZIP <strong>{DEMO_SAMPLE_ZIP}</strong> to see delivery pricing.{" "}
            <Link href="/signup" style={{ fontWeight: 700 }}>
              Want this for your yard? Start a free trial →
            </Link>
          </div>
        </div>
      )}
      <header style={{ background: "var(--brand)", color: "#fff", padding: "28px 0" }}>
        <div className="container">
          <h1 style={{ margin: 0 }}>{yard.name}</h1>
          <p style={{ margin: "6px 0 0", opacity: 0.9 }}>
            {yard.addressLine && `${yard.addressLine}, `}
            {yard.city && `${yard.city}, ${yard.state} `}
            {yard.phone && (
              <>
                · <a style={{ color: "#fff", textDecoration: "underline" }} href={`tel:${yard.phone}`}>{yard.phone}</a>
              </>
            )}
          </p>
        </div>
      </header>
      <main className="container" style={{ padding: "28px 20px 60px", maxWidth: 860 }}>
        {yard.aboutText && <p className="muted" style={{ maxWidth: 640 }}>{yard.aboutText}</p>}
        {!yard.acceptOnlineOrders || !yardActive(yard) ? (
          <div className="alert info">
            Online ordering is paused right now — please call {yard.phone || "the yard"} to place an
            order.
          </div>
        ) : (
          <Storefront
            slug={yard.slug}
            yardName={yard.name}
            yardPhone={yard.phone}
            products={products}
            categories={categories}
            isDemo={demo}
          />
        )}
        <footer className="mfooter" style={{ marginTop: 48 }}>
          Online ordering powered by <Link href="/">YardCart</Link>
        </footer>
      </main>
    </div>
  );
}
