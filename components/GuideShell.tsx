import Link from "next/link";
import MarketingShell from "@/components/MarketingShell";
import { GUIDES, getGuide } from "@/lib/guides";
import { SITE_NAME, SITE_URL, absoluteUrl } from "@/lib/seo";

function formatUpdated(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export default function GuideShell({
  slug,
  children,
}: {
  slug: string;
  children: React.ReactNode;
}) {
  const guide = getGuide(slug);
  if (!guide) return <MarketingShell>{children}</MarketingShell>;

  const url = absoluteUrl(`/guides/${slug}`);
  const related = GUIDES.filter((g) => g.slug !== slug);

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: guide.title,
    description: guide.description,
    image: absoluteUrl("/og.png"),
    datePublished: guide.updated,
    dateModified: guide.updated,
    mainEntityOfPage: url,
    author: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      logo: { "@type": "ImageObject", url: absoluteUrl("/icon.png") },
    },
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Guides", item: absoluteUrl("/guides") },
      { "@type": "ListItem", position: 2, name: guide.title, item: url },
    ],
  };

  return (
    <MarketingShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      <article className="container" style={{ paddingTop: 32, maxWidth: 760 }}>
        <p className="muted" style={{ fontSize: "0.85rem", marginBottom: 8 }}>
          <Link href="/guides">← All guides</Link>
        </p>
        <h1 style={{ marginBottom: 6 }}>{guide.title}</h1>
        <p className="muted" style={{ marginTop: 0, fontSize: "0.85rem" }}>
          Updated {formatUpdated(guide.updated)}
        </p>

        <div className="guide-body" style={{ lineHeight: 1.7 }}>
          {children}
        </div>
      </article>

      {/* Calculator nudge */}
      <section className="container" style={{ paddingTop: 24, maxWidth: 760 }}>
        <div className="card" style={{ padding: 20, background: "var(--brand-soft)" }}>
          <strong>Need a number?</strong> Use the free{" "}
          <Link href="/calculator">yardage calculator</Link> to get the exact cubic yards, bags, and
          weight for your project.
        </div>
      </section>

      {/* Related guides */}
      <section className="container" style={{ paddingTop: 40, maxWidth: 760 }}>
        <h2 style={{ fontSize: "1.2rem" }}>Related guides</h2>
        <div style={{ display: "grid", gap: 12 }}>
          {related.map((g) => (
            <Link
              key={g.slug}
              href={`/guides/${g.slug}`}
              className="card"
              style={{ padding: 16, textDecoration: "none" }}
            >
              <strong>
                {g.emoji} {g.title}
              </strong>
              <p className="muted" style={{ margin: "4px 0 0", fontSize: "0.9rem" }}>
                {g.excerpt}
              </p>
            </Link>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="container" style={{ padding: "40px 20px", maxWidth: 760 }}>
        <div className="card" style={{ padding: 28, textAlign: "center" }}>
          <h2 style={{ marginTop: 0 }}>Ready to order for delivery?</h2>
          <p className="muted" style={{ maxWidth: 520, margin: "0 auto 18px" }}>
            See how bulk ordering works on a real YardCart page — pick your material, enter a ZIP,
            and get instant delivery pricing. No phone tag.
          </p>
          <Link href="/s/cedar-ridge-demo" className="btn big">
            Try the live demo →
          </Link>
        </div>
      </section>
    </MarketingShell>
  );
}
