import Link from "next/link";
import MarketingNav from "./MarketingNav";

export default function MarketingShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
      <div className="container">
        <MarketingNav />
      </div>
      {children}
      <div className="container">
        <footer className="mfooter">
          <div className="spread">
            <span>© {new Date().getFullYear()} YardCart</span>
            <span>
              <Link href="/guides">Guides</Link> · <Link href="/calculator">Calculator</Link> ·{" "}
              <Link href="/terms">Terms</Link> · <Link href="/privacy">Privacy</Link> ·{" "}
              <Link href="/security">Security</Link> · <Link href="/pricing">Pricing</Link>
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
}
