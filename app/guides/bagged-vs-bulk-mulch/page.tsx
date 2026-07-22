import Link from "next/link";
import GuideShell from "@/components/GuideShell";
import { guideMetadata } from "@/lib/guides";

const SLUG = "bagged-vs-bulk-mulch";
export const metadata = guideMetadata(SLUG);

const BAGS = [
  { size: "2 cu ft bag", perYard: "≈ 13.5 bags", note: "The most common bag size at big-box stores." },
  { size: "3 cu ft bag", perYard: "9 bags", note: "Larger bags, fewer to haul." },
  { size: "1.5 cu ft bag", perYard: "18 bags", note: "Smaller bags — it adds up fast." },
];

const FAQ = [
  {
    q: "How many bags of mulch are in a cubic yard?",
    a: "One cubic yard is 27 cubic feet, so it equals about 13.5 bags of the common 2-cubic-foot size, 9 bags of 3 cubic feet, or 18 bags of 1.5 cubic feet.",
  },
  {
    q: "Is bulk mulch cheaper than bagged?",
    a: "Almost always, once you need a meaningful amount. Bagged mulch commonly runs $3–5 for 2 cubic feet, which works out to $40–65 per cubic yard, while bulk mulch is often $30–45 per yard delivered. Bulk usually wins once you pass roughly 8–10 bags.",
  },
  {
    q: "When does bagged mulch make more sense?",
    a: "For small jobs — a few containers or one tiny bed — or when you have no way to receive a bulk delivery and no place to dump a pile. Bags are also easier to store and move a little at a time.",
  },
  {
    q: "How much area does a cubic yard of mulch cover?",
    a: "About 108 square feet at 3 inches deep, or 162 square feet at 2 inches. That's the same coverage as roughly 13–14 of the standard 2-cubic-foot bags.",
  },
];

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ.map((i) => ({
    "@type": "Question",
    name: i.q,
    acceptedAnswer: { "@type": "Answer", text: i.a },
  })),
};

export default function Page() {
  return (
    <GuideShell slug={SLUG}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <p>
        The bagged-versus-bulk question comes down to one conversion and one break-even point. Get
        those right and you&apos;ll know instantly which way to buy — and usually save real money
        doing it.
      </p>

      <h2>How many bags equal a cubic yard?</h2>
      <p>
        A cubic yard is <strong>27 cubic feet</strong>. Divide by the bag size to get the count:
      </p>
      <div className="card" style={{ padding: 0, overflowX: "auto", margin: "16px 0" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th>Bag size</th>
              <th>Bags per cubic yard</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {BAGS.map((b) => (
              <tr key={b.size}>
                <td style={{ padding: "10px 12px", fontWeight: 600 }}>{b.size}</td>
                <td style={{ padding: "10px 12px" }}>{b.perYard}</td>
                <td style={{ padding: "10px 12px" }} className="muted">
                  {b.note}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        So the standard 2-cubic-foot bag: <strong>27 ÷ 2 ≈ 13.5 bags per yard</strong>.
      </p>

      <h2>The cost comparison</h2>
      <p>
        Bagged mulch typically runs <strong>$3–5 for a 2-cubic-foot bag</strong>. At 13.5 bags per
        yard, that&apos;s roughly <strong>$40–65 per cubic yard</strong> — before you&apos;ve loaded,
        hauled, and split open every bag. Bulk mulch is often <strong>$30–45 per yard delivered</strong>.
        Once your project needs more than about <strong>8–10 bags</strong>, bulk is usually both
        cheaper and far less work.
      </p>

      <h2>When bags still make sense</h2>
      <p>
        Bagged isn&apos;t always wrong. For a single small bed, a few planters, or a spot touch-up,
        bags are convenient — no delivery to schedule, nothing to shovel off the driveway, and easy
        to store what you don&apos;t use. Bags also win if you simply have nowhere to receive a bulk
        drop.
      </p>

      <h2>Know your number before you choose</h2>
      <p>
        The decision is easy once you know how much material the job actually needs. Enter your bed
        size in the <Link href="/calculator">yardage calculator</Link> — it shows the cubic yards
        <em> and</em> the bag equivalent side by side, so you can compare bagged and bulk pricing at a
        glance.
      </p>

      <h2>Frequently asked questions</h2>
      {FAQ.map((i) => (
        <div key={i.q} style={{ marginBottom: 16 }}>
          <h3 style={{ marginBottom: 4 }}>{i.q}</h3>
          <p className="muted" style={{ marginTop: 0 }}>
            {i.a}
          </p>
        </div>
      ))}
    </GuideShell>
  );
}
