import Link from "next/link";
import MarketingShell from "@/components/MarketingShell";
import { PLANS } from "@/lib/billing";
import { formatCents } from "@/lib/money";
import { SITE_NAME, absoluteUrl } from "@/lib/seo";

export const metadata = {
  title: "Pricing",
  description:
    "Flat monthly pricing for YardCart — from $99/mo with no per-order fees and no percentage of your sales. Starter, Pro, and Multi-yard plans. Free 14-day trial.",
  alternates: { canonical: "/pricing" },
  openGraph: {
    title: "YardCart Pricing — flat monthly, no per-order fees",
    description:
      "From $99/mo. No per-order fees, no percentage of sales. Free 14-day trial.",
    url: absoluteUrl("/pricing"),
  },
};

// SoftwareApplication (not Product) — YardCart is SaaS, not a shopping item, so
// this avoids Google's Merchant-listing evaluation while still conveying the
// plan price range and per-tier offers.
const planPrices = Object.values(PLANS).map((p) => p.priceCents);
const pricingJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: SITE_NAME,
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description:
    "Online ordering and delivery dispatch software for landscape supply yards, garden centers, and firewood sellers.",
  url: absoluteUrl("/pricing"),
  offers: {
    "@type": "AggregateOffer",
    priceCurrency: "USD",
    lowPrice: (Math.min(...planPrices) / 100).toFixed(2),
    highPrice: (Math.max(...planPrices) / 100).toFixed(2),
    offerCount: planPrices.length,
    offers: Object.values(PLANS).map((plan) => ({
      "@type": "Offer",
      name: plan.name,
      description: plan.blurb,
      price: (plan.priceCents / 100).toFixed(2),
      priceCurrency: "USD",
      url: absoluteUrl("/pricing"),
    })),
  },
};

export default function PricingPage() {
  return (
    <MarketingShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(pricingJsonLd) }}
      />
      <section className="container" style={{ paddingTop: 48, textAlign: "center" }}>
        <h1>Simple flat pricing</h1>
        <p className="muted" style={{ maxWidth: 560, margin: "0 auto 32px" }}>
          No per-order fees. No percentage of your sales. A yard doing $10,000/month in online
          orders pays a percentage-based competitor $250+ every month, forever — on YardCart it&apos;s
          the same flat price whether you take 5 orders or 500.
        </p>
        <div className="grid3" style={{ textAlign: "left" }}>
          {Object.entries(PLANS).map(([key, plan]) => (
            <div
              className="card"
              key={key}
              style={key === "PRO" ? { borderColor: "var(--brand)", borderWidth: 2 } : undefined}
            >
              {key === "PRO" && <span className="badge scheduled">Most popular</span>}
              <h3 style={{ marginTop: 8 }}>{plan.name}</h3>
              <p style={{ fontSize: "2rem", fontWeight: 800, margin: "4px 0" }}>
                {formatCents(plan.priceCents)}
                <span className="muted" style={{ fontSize: "1rem", fontWeight: 400 }}>/mo</span>
              </p>
              <p className="muted">{plan.blurb}</p>
              <ul style={{ paddingLeft: 18 }}>
                {plan.features.map((f) => (
                  <li key={f} style={{ marginBottom: 6 }}>
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href={`/signup?plan=${key}`}
                className="btn"
                style={{ width: "100%", textAlign: "center" }}
              >
                Start {plan.name} trial
              </Link>
            </div>
          ))}
        </div>
        <p className="muted" style={{ marginTop: 24 }}>
          All plans: 14-day free trial · no credit card to start · cancel anytime · annual billing
          gets 2 months free (contact us).
        </p>
      </section>
    </MarketingShell>
  );
}
