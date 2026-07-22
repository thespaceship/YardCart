import GuideShell from "@/components/GuideShell";
import { guideMetadata } from "@/lib/guides";

const SLUG = "face-cord-vs-full-cord";
export const metadata = guideMetadata(SLUG);

const ROWS = [
  { term: "Full cord", dims: "4 ft × 4 ft × 8 ft", vol: "128 cu ft", note: "The only legally standard unit in most U.S. states." },
  { term: "Face cord / rick", dims: "4 ft × 8 ft × log length", vol: "~⅓ of a cord (varies)", note: "Depth equals the log length — often 16 in, so ~43 cu ft." },
  { term: "Half cord", dims: "4 ft × 4 ft × 4 ft", vol: "64 cu ft", note: "Exactly half a full cord." },
  { term: "Quarter cord", dims: "4 ft × 2 ft × 4 ft", vol: "32 cu ft", note: "A quarter of a full cord." },
];

const FAQ = [
  {
    q: "How much is a face cord of firewood?",
    a: "A face cord is a stack 4 feet high by 8 feet long, with a depth equal to the length of the logs. With common 16-inch logs that's about 43 cubic feet — roughly one-third of a full cord. Because the log length varies, so does the amount of wood, which is why the term is imprecise.",
  },
  {
    q: "Is a rick the same as a face cord?",
    a: "Usually, yes — 'rick' and 'face cord' are used interchangeably to mean a 4 ft × 8 ft stack of whatever length the logs are cut to. Neither is a standardized volume, so always confirm the log length before you buy.",
  },
  {
    q: "How many face cords are in a full cord?",
    a: "With 16-inch logs, three face cords make up one full cord (3 × 16 in = 48 in = the 4-foot depth of a full cord). With longer 24-inch logs, only two face cords equal a full cord.",
  },
  {
    q: "Why shouldn't I buy firewood by the 'rick' or 'truckload'?",
    a: "Because those terms have no fixed volume, two sellers can quote a 'rick' or 'truckload' that differ by 50% or more in actual wood. Buy by the full, half, or quarter cord — standardized units — or pin down the exact stacked dimensions in writing.",
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
        Firewood is one of the few things people still buy in units nobody agrees on. A
        &quot;cord&quot; is a real, legally defined measurement — but &quot;face cord,&quot;
        &quot;rick,&quot; and &quot;truckload&quot; are not, and that gap is exactly where buyers
        overpay. Here&apos;s what each term actually means.
      </p>

      <h2>What is a full cord?</h2>
      <p>
        A <strong>full cord</strong> is a stack of wood measuring <strong>4 feet high × 4 feet deep ×
        8 feet long = 128 cubic feet</strong>. In most U.S. states this is the only firewood unit
        with a legal definition, which means when you buy &quot;a cord,&quot; you have a standard to
        hold the seller to.
      </p>

      <h2>What is a face cord (or rick)?</h2>
      <p>
        A <strong>face cord</strong> — also called a <strong>rick</strong> — is 4 feet high and 8
        feet long, but only <strong>one log deep</strong>. So its volume depends entirely on how long
        the logs are cut. With common 16-inch logs, a face cord is about <strong>43 cubic feet</strong>,
        roughly a third of a full cord. Cut to 24 inches, that same &quot;face cord&quot; holds far
        more wood. Same name, very different amount.
      </p>

      <h2>Firewood measurements at a glance</h2>
      <div className="card" style={{ padding: 0, overflowX: "auto", margin: "16px 0" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th>Term</th>
              <th>Stacked size</th>
              <th>Volume</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r.term}>
                <td style={{ padding: "10px 12px", fontWeight: 600 }}>{r.term}</td>
                <td style={{ padding: "10px 12px" }}>{r.dims}</td>
                <td style={{ padding: "10px 12px" }}>{r.vol}</td>
                <td style={{ padding: "10px 12px" }} className="muted">
                  {r.note}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>How to avoid overpaying</h2>
      <p>
        Two rules keep you safe: <strong>buy by the cord</strong> (full, half, or quarter) whenever
        you can, and if a seller quotes a face cord or rick, <strong>ask for the log length</strong>{" "}
        and the stacked height and width in writing. A $150 &quot;rick&quot; of 16-inch logs and a
        $150 &quot;rick&quot; of 20-inch logs are not the same purchase — the second gives you 25%
        more wood for the same money.
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
