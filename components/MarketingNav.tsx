"use client";

import { useState } from "react";
import Link from "next/link";

export default function MarketingNav() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <nav className="mnav">
        <Link href="/" className="logo" style={{ textDecoration: "none" }}>
          YardCart
        </Link>
        <div className="links links-desktop">
          <Link href="/guides">Guides</Link>
          <Link href="/pricing">Pricing</Link>
          <Link href="/s/cedar-ridge-demo">Live demo</Link>
          <Link href="/login">Log in</Link>
          <Link href="/pricing" className="btn">
            Start free trial
          </Link>
        </div>
        <button
          type="button"
          className="nav-toggle"
          aria-label="Menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
            {open ? (
              <path
                d="M5,5 L17,17 M17,5 L5,17"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            ) : (
              <path
                d="M3,6 H19 M3,11 H19 M3,16 H19"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            )}
          </svg>
        </button>
      </nav>
      {open && (
        <div className="nav-mobile">
          <Link href="/guides" onClick={() => setOpen(false)}>
            Guides
          </Link>
          <Link href="/pricing" onClick={() => setOpen(false)}>
            Pricing
          </Link>
          <Link href="/s/cedar-ridge-demo" onClick={() => setOpen(false)}>
            Live demo
          </Link>
          <Link href="/login" onClick={() => setOpen(false)}>
            Log in
          </Link>
          <Link href="/pricing" className="btn" onClick={() => setOpen(false)}>
            Start free trial
          </Link>
        </div>
      )}
    </>
  );
}
