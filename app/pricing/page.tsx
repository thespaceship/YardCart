import Link from "next/link";
import MarketingShell from "@/components/MarketingShell";
import { PLANS } from "@/lib/billing";
import { formatCents } from "@/lib/money";

export const metadata = { title: "Pricing" };

export default function PricingPage() {
  return (
    <MarketingShell>
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
