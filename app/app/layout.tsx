import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { logout } from "@/app/actions/auth";
import { yardActive } from "@/lib/billing";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const yard = user.yardId ? await db.yard.findUnique({ where: { id: user.yardId } }) : null;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <nav className="appnav no-print">
        <span className="logo">YardCart</span>
        {yard && (
          <>
            <Link href="/app">Today</Link>
            <Link href="/app/orders">Orders</Link>
            <Link href="/app/dispatch">Dispatch</Link>
            <Link href="/app/products">Products</Link>
            <Link href="/app/zones">Zones</Link>
            <Link href="/app/trucks">Trucks</Link>
            <Link href="/app/reports">Reports</Link>
            <Link href="/app/mailbox">Mailbox</Link>
            <Link href="/app/settings">Settings</Link>
          </>
        )}
        <span className="spacer" />
        {yard && (
          <a href={`/s/${yard.slug}`} target="_blank" rel="noreferrer">
            View storefront ↗
          </a>
        )}
        <form action={logout} style={{ display: "inline" }}>
          <button
            className="btn secondary small"
            style={{ marginLeft: 10 }}
            title={user.email}
          >
            Log out
          </button>
        </form>
      </nav>
      <main className="container" style={{ paddingTop: 24, paddingBottom: 64 }}>
        {yard && !yardActive(yard) && (
          <div className="alert error no-print" style={{ marginBottom: 16 }}>
            Your {yard.planStatus === "TRIALING" ? "free trial has ended" : "subscription is inactive"} —
            your storefront is paused and not taking online orders.{" "}
            <Link href="/app/billing">Choose a plan</Link> to turn it back on.
          </div>
        )}
        {children}
      </main>
      <div className="container">
        <footer className="mfooter no-print">
          <div className="spread">
            <span>© {new Date().getFullYear()} YardCart</span>
            <span>
              <Link href="/terms">Terms</Link> · <Link href="/privacy">Privacy</Link> ·{" "}
              <Link href="/security">Security</Link>
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
}
