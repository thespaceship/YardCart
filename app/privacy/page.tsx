import MarketingShell from "@/components/MarketingShell";

export const metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <MarketingShell>
      <div className="container" style={{ maxWidth: 720, paddingTop: 32 }}>
        <h1>Privacy Policy</h1>
        <p className="muted">Last updated: July 2026 · Draft — to be reviewed before public launch.</p>
        <h3>What we collect</h3>
        <p>
          Account data (your name, email, business details), catalog and order data you and your
          customers enter, and basic product analytics (page views, feature usage). Your customers&apos;
          order details (name, phone, delivery address) are collected solely to fulfill their
          delivery and are visible only to their yard.
        </p>
        <h3>What we don&apos;t do</h3>
        <p>
          We don&apos;t sell personal data. We don&apos;t use your customers&apos; contact details for
          marketing. We don&apos;t share data across yards.
        </p>
        <h3>Payments</h3>
        <p>
          Card payments are processed by Stripe; card numbers never touch YardCart servers.
        </p>
        <h3>Data access &amp; deletion</h3>
        <p>
          Export your data anytime (Reports → CSV). Email support to delete your account and all
          associated data.
        </p>
        <h3>Contact</h3>
        <p>privacy@yardcart.example — replace with the production support address at launch.</p>
      </div>
    </MarketingShell>
  );
}
