import MarketingShell from "@/components/MarketingShell";

export const metadata = { title: "Terms of Service" };

export default function TermsPage() {
  return (
    <MarketingShell>
      <div className="container" style={{ maxWidth: 720, paddingTop: 32 }}>
        <h1>Terms of Service</h1>
        <p className="muted">Last updated: July 19, 2026</p>
        <p>
          These terms are an agreement between you (the business subscribing to YardCart) and
          YardCart. By creating an account or using the service, you agree to them.
        </p>

        <h3>The service</h3>
        <p>
          YardCart provides online ordering pages, delivery-quote pricing, and dispatch tools for
          bulk-material supply yards. We host the software; you run your business. You are
          responsible for the products, prices, delivery areas, and fulfillment promises you
          publish through your storefront, and for the orders you accept.
        </p>

        <h3>Your account</h3>
        <p>
          You must provide accurate business information and keep your login credentials secure.
          You are responsible for activity under your account, including staff users you add. Let
          us know right away if you suspect unauthorized access.
        </p>

        <h3>Subscriptions, billing &amp; cancellation</h3>
        <p>
          YardCart starts with a 14-day free trial — no card required. After the trial, the
          service is billed as a flat monthly subscription at the plan prices shown on our pricing
          page, processed by Stripe. Plans renew automatically each month until canceled. You can
          cancel anytime from your billing settings; cancellation takes effect at the end of the
          current billing period, and we don&apos;t offer refunds for partial months. If a payment
          fails and isn&apos;t resolved, we may pause your storefront until billing is brought
          current. We&apos;ll give you at least 30 days&apos; notice before any price change.
        </p>

        <h3>Your data &amp; your customers&apos; data</h3>
        <p>
          Your catalog, orders, and customer records belong to you. We process your customers&apos;
          order details (name, phone, delivery address) solely to provide the service to you, as
          described in our privacy policy. You can export your data at any time (Reports → CSV).
          You are responsible for handling your customers&apos; information lawfully — for example,
          only using their contact details to fulfill their orders.
        </p>

        <h3>Acceptable use</h3>
        <p>
          Use YardCart only for lawful business purposes. Don&apos;t misuse the service — including
          attempting to access other yards&apos; data, probing or disrupting the service, sending
          spam through it, placing fraudulent orders, scraping, or reselling access. We may suspend
          or terminate accounts that violate these terms or put other customers at risk.
        </p>

        <h3>Service availability</h3>
        <p>
          We work hard to keep YardCart fast and reliable, but the service is provided{" "}
          <strong>&quot;as is&quot;</strong> without warranties of any kind, and we don&apos;t
          guarantee uninterrupted or error-free operation. Maintenance, outages at our
          infrastructure providers, or events beyond our control may cause downtime. Keep your own
          records of anything business-critical.
        </p>

        <h3>Limitation of liability</h3>
        <p>
          To the maximum extent permitted by law, YardCart is not liable for indirect, incidental,
          or consequential damages — including lost profits, lost orders, or lost data. Our total
          liability for any claim arising from the service is limited to the subscription fees you
          paid us in the 12 months before the claim.
        </p>

        <h3>Termination</h3>
        <p>
          You may stop using YardCart at any time. We may suspend or terminate accounts for
          violation of these terms, non-payment, or if we discontinue the service (with reasonable
          notice and time to export your data).
        </p>

        <h3>Changes to these terms</h3>
        <p>
          We may update these terms as the service evolves. For material changes we&apos;ll notify
          you by email or in the app before they take effect; continued use after that means you
          accept the updated terms.
        </p>

        <h3>Contact</h3>
        <p>
          Questions about these terms? Email{" "}
          <a href="mailto:support@getyardcart.com">support@getyardcart.com</a>.
        </p>
      </div>
    </MarketingShell>
  );
}
