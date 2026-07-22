import Link from "next/link";
import type { Metadata } from "next";
import MarketingShell from "@/components/MarketingShell";
import { GUIDES } from "@/lib/guides";
import { absoluteUrl } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Guides: Buying Mulch, Topsoil & Firewood by the Yard",
  description:
    "Practical guides to buying bulk landscape material — how much to order, what it weighs, when to order mulch, and firewood cord measurements. Plus a free yardage calculator.",
  alternates: { canonical: "/guides" },
  openGraph: {
    title: "YardCart Guides — buying bulk landscape material",
    description:
      "How much to order, what it weighs, and how to avoid overpaying — plus a free yardage calculator.",
    url: absoluteUrl("/guides"),
    type: "website",
  },
};

export default function GuidesHub() {
  return (
    <MarketingShell>
      <section className="container" style={{ paddingTop: 40, maxWidth: 820 }}>
        <h1 style={{ marginBottom: 8 }}>Bulk material guides</h1>
        <p className="muted" style={{ marginTop: 0 }}>
          Straight answers for buying mulch, topsoil, gravel, and firewood by the yard — how much you
          need, what it weighs, when to order, and how to avoid overpaying. No fluff, no sales pitch.
        </p>
      </section>

      {/* Featured: calculator */}
      <section className="container" style={{ paddingTop: 20, maxWidth: 820 }}>
        <Link
          href="/calculator"
          className="card"
          style={{
            display: "block",
            padding: 24,
            textDecoration: "none",
            background: "var(--brand-soft)",
            borderColor: "var(--brand)",
          }}
        >
          <strong style={{ fontSize: "1.15rem" }}>🧮 Free Yardage Calculator</strong>
          <p className="muted" style={{ margin: "6px 0 0" }}>
            Enter your bed size and depth to get the exact cubic yards to order — plus bags, weight,
            and coverage. The fastest way to size any project. →
          </p>
        </Link>
      </section>

      {/* Guide list */}
      <section className="container" style={{ paddingTop: 32, maxWidth: 820 }}>
        <div className="grid2" style={{ gap: 16 }}>
          {GUIDES.map((g) => (
            <Link
              key={g.slug}
              href={`/guides/${g.slug}`}
              className="card"
              style={{ padding: 20, textDecoration: "none" }}
            >
              <strong style={{ fontSize: "1.05rem" }}>
                {g.emoji} {g.title}
              </strong>
              <p className="muted" style={{ margin: "8px 0 0", fontSize: "0.92rem" }}>
                {g.excerpt}
              </p>
            </Link>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="container" style={{ padding: "48px 20px", maxWidth: 820 }}>
        <div className="card" style={{ padding: 28, textAlign: "center" }}>
          <h2 style={{ marginTop: 0 }}>Order bulk material for delivery</h2>
          <p className="muted" style={{ maxWidth: 540, margin: "0 auto 18px" }}>
            See how it works on a real YardCart ordering page — pick your material, enter a ZIP, and
            get instant delivery pricing.
          </p>
          <Link href="/s/cedar-ridge-demo" className="btn big">
            Try the live demo →
          </Link>
        </div>
      </section>
    </MarketingShell>
  );
}
