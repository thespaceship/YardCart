import Link from "next/link";
import GuideShell from "@/components/GuideShell";
import { guideMetadata } from "@/lib/guides";

const SLUG = "how-much-does-a-yard-weigh";
export const metadata = guideMetadata(SLUG);

const ROWS = [
  { material: "Wood mulch", weight: "600–1,000 lbs", note: "Lighter when dry; soaks up water and gets heavier after rain." },
  { material: "Compost", weight: "1,000–1,600 lbs", note: "Varies with moisture and how finished it is." },
  { material: "Topsoil", weight: "1,800–2,200 lbs", note: "Screened topsoil; wet or clay-heavy soil runs higher." },
  { material: "Sand", weight: "2,400–2,800 lbs", note: "Dense and heavy even when dry." },
  { material: "Gravel / crushed stone", weight: "2,600–3,000 lbs", note: "The heaviest common material — plan your load carefully." },
];

const FAQ = [
  {
    q: "How much does a yard of mulch weigh?",
    a: "A cubic yard of wood mulch weighs roughly 600–1,000 lbs depending on how wet it is. Dry mulch is on the lighter end; after rain it can gain hundreds of pounds as it absorbs water.",
  },
  {
    q: "How much does a yard of topsoil weigh?",
    a: "A cubic yard of screened topsoil weighs about 1,800–2,200 lbs — roughly a ton. Wet or clay-heavy soil can weigh more, so treat a full yard as at least one ton when planning delivery and hauling.",
  },
  {
    q: "How many yards fit in a pickup truck?",
    a: "By volume most pickup beds hold 2–3 cubic yards, but weight is the real limit. A half-ton pickup should carry only about one cubic yard of soil or gravel, while a heavier ¾- or 1-ton truck can handle roughly two. You can fit more mulch because it's lighter.",
  },
  {
    q: "Why does the weight of a cubic yard matter?",
    a: "Weight determines whether your vehicle can safely haul it, whether your driveway can take a delivery truck, and how the material is priced and moved. Overloading a pickup with a single yard of gravel is a common and dangerous mistake.",
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
        Bulk material is sold by <strong>volume</strong> (the cubic yard), but it&apos;s moved by{" "}
        <strong>weight</strong> — and the two vary wildly by material. A yard of mulch is under half a
        ton; a yard of gravel is closer to a ton and a half. Knowing the difference tells you whether
        your truck can haul it, whether to schedule a delivery, and how to plan the job.
      </p>

      <h2>Approximate weight per cubic yard</h2>
      <div className="card" style={{ padding: 0, overflowX: "auto", margin: "16px 0" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th>Material</th>
              <th>Weight per cubic yard</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r.material}>
                <td style={{ padding: "10px 12px", fontWeight: 600 }}>{r.material}</td>
                <td style={{ padding: "10px 12px" }}>{r.weight}</td>
                <td style={{ padding: "10px 12px" }} className="muted">
                  {r.note}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted" style={{ fontSize: "0.85rem" }}>
        These are typical ranges — actual weight depends heavily on moisture. Assume the higher end
        after rain.
      </p>

      <h2>Wet vs. dry: moisture changes everything</h2>
      <p>
        Organic materials like mulch and compost act like sponges. The same yard of mulch that
        weighs 700 lbs dry can push past 1,000 lbs after a soaking rain. If you&apos;re hauling it
        yourself, weigh your plan against the <em>wet</em> number, not the dry one.
      </p>

      <h2>Can your truck (or driveway) handle it?</h2>
      <p>
        Volume fools people — a pickup bed might <em>hold</em> two or three yards, but the{" "}
        <strong>weight</strong> is what matters. A half-ton pickup should really only carry about one
        cubic yard of soil or gravel; a ¾- or 1-ton truck can handle roughly two. Overloading is a
        common, genuinely dangerous mistake. For anything more than a yard of heavy material,
        delivery is usually the safer and easier call — just make sure the truck has clear access to
        where you want it dropped.
      </p>

      <h2>Figure your project in one step</h2>
      <p>
        Not sure how many yards you need in the first place? The{" "}
        <Link href="/calculator">yardage calculator</Link> takes your bed size and depth and returns
        the cubic yards, bag equivalent, and an estimated weight — so you can plan hauling and
        delivery before you order.
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
