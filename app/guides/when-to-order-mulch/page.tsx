import Link from "next/link";
import GuideShell from "@/components/GuideShell";
import { guideMetadata } from "@/lib/guides";

const SLUG = "when-to-order-mulch";
export const metadata = guideMetadata(SLUG);

const FAQ = [
  {
    q: "When is the best time to mulch?",
    a: "Mid-to-late spring is ideal — wait until the soil has warmed and you've done your spring weeding, usually April to May in most of the U.S. A second, lighter application in late fall helps insulate roots over winter.",
  },
  {
    q: "Can you put mulch down in the fall?",
    a: "Yes. Fall mulching (October–November) insulates plant roots against freeze-thaw cycles and suppresses early spring weeds. Apply a thinner layer than in spring, and keep it pulled back from stems and trunks.",
  },
  {
    q: "How often should mulch be replaced?",
    a: "Refresh mulch once a year, typically in spring. Organic mulch breaks down and thins out, so top it up to maintain a 2–3 inch depth rather than piling new mulch on top of old every season.",
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
        Mulch does two jobs that are all about timing: it locks moisture into the soil and it blocks
        weeds before they start. Put it down at the right moment and you get the full season of
        benefit. Order it at the wrong moment and you either miss the window — or wait a week for a
        delivery slot because every other homeowner had the same idea.
      </p>

      <h2>The best time to spread mulch</h2>
      <p>
        In most regions, <strong>mid-to-late spring</strong> is prime time — generally April into
        May, once the soil has warmed and you&apos;ve cleared out early weeds. Mulching too early,
        while the ground is still cold and wet, can trap moisture and slow the soil from warming.
        Mulching after you&apos;ve weeded means you&apos;re sealing in a clean bed rather than
        burying weeds that will push right back through.
      </p>
      <p>
        A lighter <strong>fall application</strong> (October–November) is worth it too: it insulates
        roots through winter freeze-thaw swings and gets ahead of next spring&apos;s weeds.
      </p>

      <h2>Why you should order earlier than you spread</h2>
      <p>
        Here&apos;s the part people learn the hard way. Spring is a supply yard&apos;s busiest stretch
        of the entire year. The first warm weekend triggers a rush, delivery calendars fill, and the
        wait for a truck can jump from &quot;tomorrow&quot; to &quot;next week.&quot; If you want
        mulch down for a specific weekend or before guests arrive, <strong>order 1–2 weeks
        ahead</strong> during peak season rather than the day you plan to spread.
      </p>
      <p>
        Yards that take orders online make this easier — you can see real delivery dates and lock in
        a slot instead of playing phone tag. (That&apos;s exactly what YardCart is built to do for
        the yards that use it.)
      </p>

      <h2>How much mulch should you order?</h2>
      <p>
        Measure your beds and aim for a <strong>2–3 inch depth</strong> to refresh, or 3–4 inches for
        new beds and stronger weed suppression. One cubic yard covers about 108 square feet at 3
        inches deep. Rather than eyeball it, drop your bed size into the{" "}
        <Link href="/calculator">yardage calculator</Link> — it&apos;ll tell you the exact cubic
        yards to order (and rounds up to the half-yard that yards actually deliver in).
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
