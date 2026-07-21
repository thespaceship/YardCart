import Link from "next/link";
import type { Metadata } from "next";
import MarketingShell from "@/components/MarketingShell";
import YardageCalculator from "@/components/YardageCalculator";
import { absoluteUrl } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Mulch & Topsoil Calculator — How Many Cubic Yards Do You Need?",
  description:
    "Free yardage calculator for mulch, topsoil, compost, gravel, and sand. Enter your bed size and depth to get the exact cubic yards to order — plus bags, weight, and coverage.",
  alternates: { canonical: "/calculator" },
  openGraph: {
    title: "Mulch & Topsoil Yardage Calculator",
    description:
      "How many cubic yards of mulch or topsoil do you need? Enter length, width, and depth for an instant answer.",
    url: absoluteUrl("/calculator"),
    type: "website",
  },
};

const FAQ: { q: string; a: string }[] = [
  {
    q: "How many cubic yards of mulch do I need?",
    a: "Multiply the bed's length by its width in feet to get square feet, multiply by the depth in feet (inches ÷ 12), then divide by 27. For example, a 20 ft × 10 ft bed at 3 inches deep is 200 × 0.25 ÷ 27 ≈ 1.85 cubic yards, so you'd order 2 cubic yards.",
  },
  {
    q: "How do I calculate cubic yards?",
    a: "Cubic yards = (square feet × depth in inches ÷ 12) ÷ 27. One cubic yard equals 27 cubic feet. The calculator above does this automatically and rounds up to the nearest half yard, which is how supply yards sell bulk material.",
  },
  {
    q: "How many bags of mulch are in a cubic yard?",
    a: "One cubic yard is 27 cubic feet, so it equals about 13.5 bags of the common 2-cubic-foot size (or roughly 20 bags of 1.5 cubic feet). Buying in bulk by the yard is almost always cheaper than bagged once you need more than about 8–10 bags.",
  },
  {
    q: "How much does a cubic yard of mulch or topsoil weigh?",
    a: "A cubic yard of wood mulch weighs roughly 600–1,000 lbs depending on moisture. Topsoil is heavier at about 1,800–2,200 lbs, compost a bit less, and gravel or stone around 2,600–3,000 lbs per cubic yard. Check that your vehicle and the delivery access can handle the load.",
  },
  {
    q: "How deep should mulch be?",
    a: "Apply mulch 2–3 inches deep to refresh existing beds and 3–4 inches for new beds or strong weed suppression. Avoid piling it against plant stems or tree trunks. For topsoil, 1–2 inches top-dresses a lawn while 4–6 inches suits new garden beds.",
  },
  {
    q: "How many square feet does a cubic yard cover?",
    a: "It depends on depth: coverage (sq ft) = 324 ÷ depth in inches. One cubic yard covers about 108 sq ft at 3 inches deep, 162 sq ft at 2 inches, or 324 sq ft spread just 1 inch thick.",
  },
];

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ.map((item) => ({
    "@type": "Question",
    name: item.q,
    acceptedAnswer: { "@type": "Answer", text: item.a },
  })),
};

const DEPTH_GUIDE: { material: string; depth: string; use: string }[] = [
  { material: "Mulch (beds)", depth: "2–3 in", use: "Refreshing established landscape beds" },
  { material: "Mulch (weed control)", depth: "3–4 in", use: "New beds, moisture retention" },
  { material: "Topsoil (lawn)", depth: "1–2 in", use: "Top-dressing or leveling a lawn" },
  { material: "Topsoil (garden)", depth: "4–6 in", use: "Building up new planting beds" },
  { material: "Gravel (path)", depth: "2–3 in", use: "Walkways, decorative stone" },
  { material: "Gravel (driveway)", depth: "4 in", use: "Driveways and heavy traffic" },
];

export default function CalculatorPage() {
  return (
    <MarketingShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <section className="container" style={{ paddingTop: 40 }}>
        <h1 style={{ marginBottom: 8 }}>Mulch &amp; Topsoil Yardage Calculator</h1>
        <p className="muted" style={{ maxWidth: 680, marginTop: 0 }}>
          Figure out exactly how many cubic yards of mulch, topsoil, compost, gravel, or sand you
          need. Enter your bed size and depth — you&apos;ll get the amount to order, plus the bag
          equivalent, approximate weight, and coverage.
        </p>
      </section>

      <section className="container" style={{ paddingTop: 16 }}>
        <div className="grid2" style={{ alignItems: "start", gap: 32 }}>
          <YardageCalculator />

          <div>
            <h2 style={{ marginTop: 0 }}>How the math works</h2>
            <p className="muted">
              Bulk material is sold by the <strong>cubic yard</strong> (27 cubic feet). To convert a
              flat area into a volume, you just account for how deep you&apos;re spreading it:
            </p>
            <div
              className="card"
              style={{ padding: 16, textAlign: "center", fontWeight: 600, background: "var(--accent-soft)" }}
            >
              cubic yards = (length&nbsp;×&nbsp;width&nbsp;×&nbsp;depth&nbsp;in&nbsp;inches&nbsp;÷&nbsp;12)&nbsp;÷&nbsp;27
            </div>
            <p className="muted" style={{ marginTop: 16 }}>
              Yards deliver in half-yard increments, so it&apos;s normal to round up. A little extra
              beats a second delivery fee for the half-yard you came up short.
            </p>
          </div>
        </div>
      </section>

      <section className="container" style={{ paddingTop: 48 }}>
        <h2>Recommended depth by material</h2>
        <div className="card" style={{ padding: 0, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th>Material &amp; use</th>
                <th>Depth</th>
                <th>Best for</th>
              </tr>
            </thead>
            <tbody>
              {DEPTH_GUIDE.map((row) => (
                <tr key={row.material}>
                  <td style={{ padding: "10px 12px", fontWeight: 600 }}>{row.material}</td>
                  <td style={{ padding: "10px 12px" }}>{row.depth}</td>
                  <td style={{ padding: "10px 12px" }} className="muted">
                    {row.use}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="container" style={{ paddingTop: 48 }}>
        <h2>Frequently asked questions</h2>
        <div style={{ maxWidth: 760 }}>
          {FAQ.map((item) => (
            <div key={item.q} style={{ marginBottom: 20 }}>
              <h3 style={{ marginBottom: 6 }}>{item.q}</h3>
              <p className="muted" style={{ marginTop: 0 }}>
                {item.a}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Homeowner CTA */}
      <section className="container" style={{ paddingTop: 40 }}>
        <div className="card" style={{ padding: 28, textAlign: "center", background: "var(--brand-soft)" }}>
          <h2 style={{ marginTop: 0 }}>Know your number? Get it delivered.</h2>
          <p className="muted" style={{ maxWidth: 560, margin: "0 auto 18px" }}>
            See how ordering works on a real YardCart page — pick your material, enter a ZIP, and get
            instant delivery pricing. No calls, no &quot;we&apos;ll get back to you.&quot;
          </p>
          <Link href="/s/cedar-ridge-demo" className="btn big">
            Try the live demo →
          </Link>
        </div>
      </section>

      {/* Yard-owner CTA */}
      <section className="container" style={{ paddingTop: 24, paddingBottom: 24 }}>
        <div className="card" style={{ padding: 28 }}>
          <h2 style={{ marginTop: 0 }}>Run a supply yard? Put this calculator on your own site — free.</h2>
          <p className="muted" style={{ maxWidth: 640 }}>
            Every YardCart ordering page includes this yardage calculator built in, wired straight to
            your real products and delivery pricing. Your customers size the job and order the exact
            amount in one place — 24/7, with no per-order fees to you.
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link href="/pricing" className="btn">
              Start free 14-day trial
            </Link>
            <Link href="/pricing" className="btn secondary">
              See pricing
            </Link>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
