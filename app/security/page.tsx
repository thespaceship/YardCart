import MarketingShell from "@/components/MarketingShell";

export const metadata = { title: "Security" };

export default function SecurityPage() {
  return (
    <MarketingShell>
      <div className="container" style={{ maxWidth: 720, paddingTop: 32 }}>
        <h1>Security</h1>
        <p className="muted">How YardCart protects your business data.</p>
        <ul style={{ lineHeight: 1.9 }}>
          <li>All traffic encrypted in transit (HTTPS/TLS).</li>
          <li>Passwords hashed with bcrypt — never stored or logged in plain text.</li>
          <li>Sessions use signed, HttpOnly, SameSite cookies.</li>
          <li>Every yard&apos;s data is isolated; all queries are scoped to your yard.</li>
          <li>Card payments handled by Stripe (PCI DSS Level 1); no card data on our servers.</li>
          <li>Rate limiting on login, signup, and public order endpoints.</li>
          <li>Daily database backups in production.</li>
        </ul>
        <p>
          Found a vulnerability? Email security@yardcart.example — we respond within 48 hours.
        </p>
      </div>
    </MarketingShell>
  );
}
