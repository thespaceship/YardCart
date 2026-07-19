import Link from "next/link";

export default function MarketingShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
      <div className="container">
        <nav className="mnav">
          <Link href="/" className="logo" style={{ textDecoration: "none" }}>
            YardCart
          </Link>
          <div className="links">
            <Link href="/pricing">Pricing</Link>
            <Link href="/s/cedar-ridge-demo">Live demo</Link>
            <Link href="/login">Log in</Link>
            <Link href="/signup" className="btn">
              Start free trial
            </Link>
          </div>
        </nav>
      </div>
      {children}
      <div className="container">
        <footer className="mfooter">
          <div className="spread">
            <span>© {new Date().getFullYear()} YardCart</span>
            <span>
              <Link href="/privacy">Privacy</Link> · <Link href="/security">Security</Link> ·{" "}
              <Link href="/pricing">Pricing</Link>
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
}
