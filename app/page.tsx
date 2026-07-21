import Link from "next/link";
import MarketingShell from "@/components/MarketingShell";
import HeroBackground from "@/components/HeroBackground";

export default function Home() {
  return (
    <MarketingShell>
      <section className="hero container">
        <HeroBackground />
        <div className="hero-content">
          <h1>Your yard closes at 5. Your orders don&apos;t have to.</h1>
          <p className="sub">
            YardCart puts a bulk-material ordering page on your website — mulch, topsoil, compost,
            firewood — with delivery pricing by ZIP code, and a dispatch board that keeps your
            trucks full. Flat monthly price. <strong>No per-order fees.</strong>
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/signup" className="btn big">
              Start free 14-day trial
            </Link>
            <Link href="/s/cedar-ridge-demo" className="btn big secondary">
              Try the live demo →
            </Link>
          </div>
          <p className="muted" style={{ marginTop: 12 }}>
            Set up in ~10 minutes. No credit card. Cancel anytime.
          </p>
        </div>
      </section>

      <section className="container" style={{ paddingTop: 24 }}>
        <div className="grid3">
          <div className="card">
            <h3>📱 Take orders 24/7</h3>
            <p className="muted">
              Homeowners buy mulch on Sunday morning. A yardage calculator, your real prices, and
              instant delivery quotes by ZIP — no more &quot;call for delivery.&quot;
            </p>
          </div>
          <div className="card">
            <h3>🚚 Keep trucks full, not overbooked</h3>
            <p className="muted">
              Customers only see dates you actually have capacity for, based on your trucks and
              trip limits. Schedule, assign, and print delivery tickets in two clicks.
            </p>
          </div>
          <div className="card">
            <h3>💵 Flat price, not a toll booth</h3>
            <p className="muted">
              Other tools take a percentage of every order — the better you do, the more they
              take. YardCart is a flat monthly price from $99. Sell more, keep more.
            </p>
          </div>
        </div>
      </section>

      <section className="container" style={{ paddingTop: 48 }}>
        <div className="card" style={{ padding: 32 }}>
          <h2>How it works</h2>
          <ol style={{ lineHeight: 2, margin: 0, paddingLeft: 20 }}>
            <li>
              <strong>Set up your yard</strong> — pick your products from templates, set prices,
              delivery ZIPs and fees, and your trucks. (~10 minutes)
            </li>
            <li>
              <strong>Link your ordering page</strong> — add the &quot;Order online&quot; button to
              your website, Google Business Profile, and Facebook page.
            </li>
            <li>
              <strong>Orders roll in</strong> — customers get instant pricing and pick a delivery
              date; you confirm, dispatch, and drop the load. Pay on delivery or by card.
            </li>
          </ol>
        </div>
      </section>

      <section className="container" style={{ paddingTop: 48, textAlign: "center" }}>
        <h2>Built for yards like yours</h2>
        <p className="muted" style={{ maxWidth: 620, margin: "0 auto 24px" }}>
          Landscape supply yards · garden centers with delivery trucks · mulch &amp; topsoil
          operations · firewood sellers. If you deliver bulk material by the yard, YardCart fits.
        </p>
        <Link href="/signup" className="btn big">
          Start your free trial
        </Link>
      </section>
    </MarketingShell>
  );
}
