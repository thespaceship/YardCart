import Link from "next/link";
import { requireYardUser } from "@/lib/auth";
import { updateSettings } from "@/app/actions/catalog";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const ctx = await requireYardUser();
  const { yard } = ctx;
  const storefrontUrl = `${process.env.APP_URL ?? ""}/s/${yard.slug}`;

  return (
    <div className="stack" style={{ maxWidth: 760 }}>
      <h1>Settings</h1>

      <div className="card">
        <h3>Your storefront</h3>
        <p>
          Customers order at: <a href={`/s/${yard.slug}`} target="_blank">{storefrontUrl}</a>
        </p>
        <p className="muted">
          Link it from your website (&quot;Order online&quot; button), Google Business Profile, and
          Facebook page. Plan: <strong>{yard.plan}</strong> ({yard.planStatus}) —{" "}
          <Link href="/app/billing">manage billing</Link>.
        </p>
      </div>

      <form action={updateSettings} className="card">
        <h3>Business info</h3>
        <label>Yard name</label>
        <input name="name" defaultValue={yard.name} required />
        <div className="field-row">
          <div>
            <label>Phone</label>
            <input name="phone" defaultValue={yard.phone} />
          </div>
          <div>
            <label>Notification email (new orders)</label>
            <input name="email" type="email" defaultValue={yard.email} />
          </div>
        </div>
        <div className="field-row">
          <div style={{ flex: 2 }}>
            <label>Street address</label>
            <input name="addressLine" defaultValue={yard.addressLine} />
          </div>
          <div>
            <label>City</label>
            <input name="city" defaultValue={yard.city} />
          </div>
          <div style={{ maxWidth: 90 }}>
            <label>State</label>
            <input name="state" defaultValue={yard.state} />
          </div>
          <div style={{ maxWidth: 110 }}>
            <label>ZIP</label>
            <input name="zip" defaultValue={yard.zip} />
          </div>
        </div>
        <label>About text (shown on storefront)</label>
        <textarea name="aboutText" rows={3} defaultValue={yard.aboutText} />

        <h3 style={{ marginTop: 24 }}>Online ordering rules</h3>
        <div className="field-row">
          <div>
            <label>Lead time (days)</label>
            <input name="minLeadDays" inputMode="numeric" defaultValue={yard.minLeadDays} />
          </div>
          <div>
            <label>Booking window (days)</label>
            <input name="maxAdvanceDays" inputMode="numeric" defaultValue={yard.maxAdvanceDays} />
          </div>
          <div>
            <label>Same-lead cutoff hour (0–23)</label>
            <input name="orderCutoffHour" inputMode="numeric" defaultValue={yard.orderCutoffHour} />
          </div>
        </div>
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type="checkbox" name="acceptOnlineOrders" defaultChecked={yard.acceptOnlineOrders} style={{ width: "auto" }} />
          Accept online orders (uncheck to pause during rush)
        </label>
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type="checkbox" name="paymentOnDelivery" defaultChecked={yard.paymentOnDelivery} style={{ width: "auto" }} />
          Collect payment on delivery
        </label>
        <div style={{ marginTop: 16 }}>
          <button className="btn">Save settings</button>
        </div>
      </form>
    </div>
  );
}
