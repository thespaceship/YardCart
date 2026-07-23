import Link from "next/link";
import { requireYardUser } from "@/lib/auth";
import { updateSettings, sendSupportMessage } from "@/app/actions/catalog";
import { deleteAccount } from "@/app/actions/account";
import ConfirmSubmit from "@/components/ConfirmSubmit";
import AccountSecurity from "@/components/AccountSecurity";

export const metadata = { title: "Settings" };

const DAYS: { value: number; label: string }[] = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
];

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export default async function SettingsPage(props: {
  searchParams: Promise<{ saved?: string; supportSent?: string }>;
}) {
  const ctx = await requireYardUser();
  const { yard, user } = ctx;
  const { saved, supportSent } = await props.searchParams;
  const storefrontUrl = `${process.env.APP_URL ?? ""}/s/${yard.slug}`;
  const deliveryDays = new Set(yard.deliveryDays);

  return (
    <div className="stack" style={{ maxWidth: 760 }}>
      <h1>Settings</h1>

      {saved && <div className="alert ok">✓ Settings saved.</div>}
      {supportSent && <div className="alert ok">✓ Message sent — support@getyardcart.com will follow up by email.</div>}

      <div className="card">
        <h3>Your storefront</h3>
        <p>
          Customers order at: <a href={`/s/${yard.slug}`} target="_blank">{storefrontUrl}</a>
        </p>
        <p className="muted">
          Link it from your website (&quot;Order online&quot; button), Google Business Profile, and
          Facebook page. Plan: <strong>{yard.plan}</strong> ({yard.planStatus}) —{" "}
          <Link href="/app/billing" style={{ fontWeight: 700, textDecoration: "underline" }}>
            manage billing
          </Link>
          .
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
            <p className="muted" style={{ marginTop: 4 }}>
              Earliest a customer can schedule delivery — e.g. 1 means the soonest is tomorrow, never today.
            </p>
          </div>
          <div>
            <label>Booking window (days)</label>
            <input name="maxAdvanceDays" inputMode="numeric" defaultValue={yard.maxAdvanceDays} />
            <p className="muted" style={{ marginTop: 4 }}>
              How far ahead customers can book — e.g. 30 means they can&apos;t schedule more than a month out.
            </p>
          </div>
          <div>
            <label>Same-lead cutoff hour (0–23)</label>
            <input name="orderCutoffHour" inputMode="numeric" defaultValue={yard.orderCutoffHour} />
            <p className="muted" style={{ marginTop: 4 }}>
              Orders placed after this hour (your local time) push the earliest available date out by one
              extra day.
            </p>
          </div>
        </div>

        <label style={{ marginTop: 12 }}>Delivery days</label>
        <div className="field-row" style={{ flexWrap: "wrap" }}>
          {DAYS.map((d) => (
            <label
              key={d.value}
              style={{ display: "flex", gap: 6, alignItems: "center", flex: "0 0 auto" }}
            >
              <input
                type="checkbox"
                name="deliveryDays"
                value={d.value}
                defaultChecked={deliveryDays.has(d.value)}
                style={{ width: "auto" }}
              />
              {d.label}
            </label>
          ))}
        </div>
        <p className="muted" style={{ marginTop: 4 }}>
          Days customers can pick for delivery — uncheck a day you&apos;re closed and it disappears from
          the storefront date picker.
        </p>

        <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 16 }}>
          <input type="checkbox" name="acceptOnlineOrders" defaultChecked={yard.acceptOnlineOrders} style={{ width: "auto" }} />
          Accept online orders (uncheck to pause during rush)
        </label>
        <p className="muted" style={{ marginTop: 4 }}>
          Uncheck to temporarily pause the storefront without deleting anything — customers see
          &quot;not accepting orders right now.&quot;
        </p>

        <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 12 }}>
          <input type="checkbox" name="paymentOnDelivery" defaultChecked={yard.paymentOnDelivery} style={{ width: "auto" }} />
          Collect payment on delivery
        </label>
        <p className="muted" style={{ marginTop: 4 }}>
          Marks new orders as &quot;pay on delivery&quot; by default so your team knows to collect in
          person — there&apos;s no online prepayment yet, this is just an internal label you&apos;ll see
          on the order and the printed ticket.
        </p>

        <div style={{ marginTop: 16 }}>
          <button className="btn">Save settings</button>
        </div>
      </form>

      <AccountSecurity currentEmail={user.email} />

      <form action={sendSupportMessage} className="card">
        <h3>Contact support</h3>
        <p className="muted">Send a message to our team at support@getyardcart.com.</p>
        <label>Subject</label>
        <input name="subject" maxLength={160} required />
        <label>Message</label>
        <textarea name="message" rows={4} maxLength={5000} required />
        <div style={{ marginTop: 16 }}>
          <button className="btn secondary">Send message</button>
        </div>
      </form>

      <div className="card" style={{ borderColor: "var(--danger)" }}>
        <h3>Danger zone</h3>
        <p className="muted">
          Permanently deletes your yard, storefront, products, orders, and all associated data. This
          cannot be undone.
        </p>
        <form action={deleteAccount}>
          <label>
            Type <strong>{yard.name}</strong> to confirm
          </label>
          <input
            name="confirmName"
            required
            autoComplete="off"
            pattern={escapeRegExp(yard.name)}
            title={`Type "${yard.name}" exactly to confirm`}
          />
          <div style={{ marginTop: 12 }}>
            <ConfirmSubmit
              label="Delete account"
              title={`Delete ${yard.name}?`}
              message={"This permanently deletes your yard, storefront, products, orders, and all associated data.\n\nThis cannot be undone."}
              confirmLabel="Delete account"
              cancelLabel="Keep my account"
              className="btn danger"
              confirmClassName="btn danger"
            />
          </div>
        </form>
      </div>
    </div>
  );
}
