"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { groupByCategory, type CategoryView } from "@/lib/categories";

type PublicProduct = {
  id: string;
  name: string;
  category: string;
  description: string;
  imageUrl: string;
  unit: string;
  priceCents: number;
  minQty: number;
  maxQty: number;
  qtyStep: number;
};

type MethodQuote = {
  methodId: string;
  name: string;
  description: string;
  trips: number;
  binding: "yards" | "weight" | "pallets" | null;
  rateCents: number;
  addOns: { id: string; name: string; feeCents: number }[];
  addOnCents: number;
  feeCents: number;
};

type Quote = {
  zone: { name: string; deliveryFeeCents: number; minOrderCents: number };
  priced: {
    lines: { productId: string; totalCents: number }[];
    materialCents: number;
    deliveryCents: number;
    totalCents: number;
    meetsMinOrder: boolean;
    minOrderCents: number;
  };
  dates: string[];
  delivery: { selected: MethodQuote; options: MethodQuote[] } | null;
};

const UNIT_LABELS: Record<string, string> = {
  cubic_yard: "cu yd",
  half_yard: "½ yd",
  bag: "bag",
  cord: "cord",
  face_cord: "face cord",
  ton: "ton",
};

function usd(cents: number) {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function prettyDate(iso: string) {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export default function Storefront({
  slug,
  yardName,
  yardPhone,
  products,
  categories,
  isDemo = false,
}: {
  slug: string;
  yardName: string;
  yardPhone: string;
  products: PublicProduct[];
  categories: CategoryView[];
  isDemo?: boolean;
}) {
  const router = useRouter();
  const [demoPlaced, setDemoPlaced] = useState(false);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [zip, setZip] = useState("");
  const [zipChecked, setZipChecked] = useState(false);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [placing, setPlacing] = useState(false);
  const [placeError, setPlaceError] = useState<string | null>(null);
  // The rail shows a compact order summary; the full delivery + checkout form lives in a modal
  // this opens, so the always-visible rail stays small.
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  // Which category the shopper is browsing. "all" = every product, the starting view.
  const [activeCategory, setActiveCategory] = useState("all");
  const [form, setForm] = useState({
    customerName: "",
    customerPhone: "",
    customerEmail: "",
    addressLine: "",
    city: "",
    placementNotes: "",
  });
  // yardage calculator
  const [calcSqft, setCalcSqft] = useState("");
  const [calcDepth, setCalcDepth] = useState("3");
  // Product photo the customer tapped to view larger (null = lightbox closed).
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null);
  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox]);
  // Close the checkout modal on Escape, and lock the page behind it while it's open.
  useEffect(() => {
    if (!checkoutOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setCheckoutOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [checkoutOpen]);

  const cartLines = useMemo(
    () =>
      Object.entries(cart)
        .filter(([, qty]) => qty > 0)
        .map(([productId, qty]) => ({ productId, qty })),
    [cart]
  );
  const cartCount = cartLines.length;

  const fetchQuote = useCallback(async () => {
    if (!/^\d{5}$/.test(zip) || cartLines.length === 0) return;
    setLoadingQuote(true);
    setQuoteError(null);
    try {
      const res = await fetch(`/api/storefront/${slug}/quote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zip, cart: cartLines }),
      });
      const data = await res.json();
      if (!res.ok) {
        setQuote(null);
        setQuoteError(data.message ?? "Could not check that ZIP code.");
      } else {
        setQuote(data);
        if (data.dates.length > 0 && !data.dates.includes(selectedDate)) {
          setSelectedDate(data.dates[0]);
        }
      }
    } catch {
      setQuoteError("Network problem — please try again.");
    } finally {
      setLoadingQuote(false);
      setZipChecked(true);
    }
  }, [zip, cartLines, slug, selectedDate]);

  // re-quote when the cart changes after a ZIP has been checked
  useEffect(() => {
    if (zipChecked && cartLines.length > 0) void fetchQuote();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(cartLines)]);

  const setQty = (p: PublicProduct, raw: number) => {
    const qty = isFinite(raw) ? Math.max(0, Math.min(p.maxQty, raw)) : 0;
    setCart((c) => ({ ...c, [p.id]: qty }));
  };

  const bumpQty = (p: PublicProduct, dir: 1 | -1) => {
    setCart((c) => {
      const current = c[p.id] ?? 0;
      const next = Math.max(0, Math.min(p.maxQty, current + dir * p.qtyStep));
      return { ...c, [p.id]: Math.round(next * 100) / 100 };
    });
  };

  const calcYards = useMemo(() => {
    const sqft = parseFloat(calcSqft);
    const depth = parseFloat(calcDepth);
    if (!isFinite(sqft) || !isFinite(depth) || sqft <= 0 || depth <= 0) return null;
    return Math.max(0.5, Math.ceil(((sqft * (depth / 12)) / 27) * 2) / 2);
  }, [calcSqft, calcDepth]);

  const sections = useMemo(
    () => groupByCategory(products, categories),
    [products, categories]
  );

  // Only categories that actually have products get a filter — an empty filter is a dead end.
  const filters = useMemo(
    () => [
      { slug: "all", label: "All materials", count: products.length },
      ...sections.map((s) => ({ slug: s.slug, label: s.label, count: s.products.length })),
    ],
    [sections, products.length]
  );

  const shown = useMemo(() => {
    const picked = activeCategory === "all" ? sections : sections.filter((s) => s.slug === activeCategory);
    return picked.flatMap((s) => s.products.map((p) => ({ ...p, categoryLabel: s.label })));
  }, [sections, activeCategory]);

  const activeLabel = filters.find((f) => f.slug === activeCategory)?.label ?? "All materials";

  // Client-side materials subtotal for the rail summary before a ZIP is checked. Quantities are
  // already clamped in setQty/bumpQty, so this matches the server's material total; once a quote
  // exists the summary shows that authoritative grand total instead.
  const materialSubtotalCents = useMemo(
    () =>
      cartLines.reduce((sum, l) => {
        const p = products.find((pp) => pp.id === l.productId);
        return sum + (p ? Math.round(p.priceCents * l.qty) : 0);
      }, 0),
    [cartLines, products]
  );

  async function placeOrder(e: React.FormEvent) {
    e.preventDefault();
    if (!quote || !selectedDate) return;
    setPlacing(true);
    setPlaceError(null);
    try {
      const res = await fetch(`/api/storefront/${slug}/order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          zip,
          requestedDate: selectedDate,
          cart: cartLines,
          deliveryMethodId: quote.delivery?.selected.methodId,
          website: "", // honeypot stays empty
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPlaceError(data.message ?? "Could not place your order.");
      } else if (data.demo) {
        setDemoPlaced(true);
      } else {
        router.push(`/s/${slug}/thanks/${data.orderId}`);
      }
    } catch {
      setPlaceError("Network problem — please try again.");
    } finally {
      setPlacing(false);
    }
  }

  // The delivery check + order form. Rendered inside the checkout modal, not the rail.
  const checkoutBody = (
    <>
      {demoPlaced ? (
        <>
          <h2>Order placed — demo complete 🎉</h2>
          <div className="alert ok">
            <strong>No real order was created and no emails were sent.</strong> On a real
            storefront, your customer would now see a confirmation page and get an email — and
            the order would land on your dispatch board, ready to schedule onto a truck.
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 8 }}>
            <Link href="/signup" className="btn">
              Start your free 14-day trial
            </Link>
            <button
              type="button"
              className="btn secondary"
              onClick={() => {
                setDemoPlaced(false);
                setCheckoutOpen(false);
              }}
            >
              Back to the demo
            </button>
          </div>
        </>
      ) : (
        <>
      <h2>Delivery</h2>
      {cartCount === 0 ? (
        <p className="muted">Pick your materials to check delivery pricing for your address.</p>
      ) : (
        <>
          <div className="field-row">
            <div>
              <label htmlFor="zip">Delivery ZIP code</label>
              <input
                id="zip"
                inputMode="numeric"
                maxLength={5}
                value={zip}
                onChange={(e) => {
                  setZip(e.target.value.replace(/\D/g, "").slice(0, 5));
                  setZipChecked(false);
                  setQuote(null);
                }}
                placeholder="43004"
              />
            </div>
            <div>
              <button
                type="button"
                className="btn"
                disabled={!/^\d{5}$/.test(zip) || loadingQuote}
                onClick={() => void fetchQuote()}
              >
                {loadingQuote ? "Checking…" : "Check delivery"}
              </button>
            </div>
          </div>
          {quoteError && <div className="alert error">{quoteError}</div>}
          {quote && (
            <>
              <div className="alert ok">
                We deliver to {zip} ({quote.zone.name}). Delivery fee:{" "}
                <strong>{usd(quote.priced.deliveryCents)}</strong>
                {quote.zone.minOrderCents > 0 && (
                  <> · Minimum order: {usd(quote.zone.minOrderCents)} of material</>
                )}
              </div>

              {/* Which truck runs the load is the yard's call, not the customer's — we only
                  tell them when the order is big enough to need more than one trip. */}
              {quote.delivery && quote.delivery.selected.trips > 1 && (
                <p className="muted" style={{ margin: "12px 0 0" }}>
                  Your order needs {quote.delivery.selected.trips} trips
                  {quote.delivery.selected.binding === "weight" && " (weight limit)"}
                  {quote.delivery.selected.binding === "yards" && " (volume limit)"}
                  {quote.delivery.selected.binding === "pallets" && " (pallet limit)"}.
                </p>
              )}

              <table style={{ maxWidth: 480 }}>
                <tbody>
                  <tr>
                    <td>Material</td>
                    <td className="right">{usd(quote.priced.materialCents)}</td>
                  </tr>
                  <tr>
                    <td>
                      Delivery
                      {quote.delivery && quote.delivery.selected.trips > 1 && (
                        <span className="muted"> × {quote.delivery.selected.trips} trips</span>
                      )}
                    </td>
                    <td className="right">
                      {usd(
                        quote.delivery
                          ? quote.delivery.selected.rateCents
                          : quote.priced.deliveryCents
                      )}
                    </td>
                  </tr>
                  {quote.delivery?.selected.addOns.map((a) => (
                    <tr key={a.id}>
                      <td>{a.name}</td>
                      <td className="right">{usd(a.feeCents)}</td>
                    </tr>
                  ))}
                  <tr>
                    <td>
                      <strong>Total</strong>
                    </td>
                    <td className="right">
                      <strong>{usd(quote.priced.totalCents)}</strong>
                    </td>
                  </tr>
                </tbody>
              </table>
              {!quote.priced.meetsMinOrder && (
                <div className="alert error">
                  Your material subtotal is below the {usd(quote.priced.minOrderCents)} minimum
                  for this area — add a bit more to your order.
                </div>
              )}

              {quote.priced.meetsMinOrder && (
                <form onSubmit={placeOrder}>
                  <label htmlFor="date">Delivery date</label>
                  {quote.dates.length === 0 ? (
                    <div className="alert error">
                      No delivery slots available in the next few weeks — please call{" "}
                      {yardPhone || yardName}.
                    </div>
                  ) : (
                    <select
                      id="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                    >
                      {quote.dates.map((d) => (
                        <option key={d} value={d}>
                          {prettyDate(d)}
                        </option>
                      ))}
                    </select>
                  )}
                  <div className="field-row">
                    <div>
                      <label htmlFor="name">Your name</label>
                      <input
                        id="name"
                        required
                        value={form.customerName}
                        onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                        autoComplete="name"
                      />
                    </div>
                    <div>
                      <label htmlFor="phone">Phone</label>
                      <input
                        id="phone"
                        required
                        type="tel"
                        value={form.customerPhone}
                        onChange={(e) => setForm({ ...form, customerPhone: e.target.value })}
                        autoComplete="tel"
                      />
                    </div>
                  </div>
                  <label htmlFor="email">Email (for your confirmation — optional)</label>
                  <input
                    id="email"
                    type="email"
                    value={form.customerEmail}
                    onChange={(e) => setForm({ ...form, customerEmail: e.target.value })}
                    autoComplete="email"
                  />
                  <div className="field-row">
                    <div style={{ flex: 2 }}>
                      <label htmlFor="addr">Street address</label>
                      <input
                        id="addr"
                        required
                        value={form.addressLine}
                        onChange={(e) => setForm({ ...form, addressLine: e.target.value })}
                        autoComplete="street-address"
                      />
                    </div>
                    <div>
                      <label htmlFor="city">City</label>
                      <input
                        id="city"
                        value={form.city}
                        onChange={(e) => setForm({ ...form, city: e.target.value })}
                      />
                    </div>
                  </div>
                  <label htmlFor="notes">Additional comments (optional)</label>
                  <textarea
                    id="notes"
                    rows={2}
                    aria-describedby="notes-help"
                    placeholder="e.g. Gate code, dogs in the yard, best time of day"
                    value={form.placementNotes}
                    onChange={(e) => setForm({ ...form, placementNotes: e.target.value })}
                  />
                  <p className="muted" id="notes-help" style={{ margin: "6px 0 0" }}>
                    Anything you tell us here helps, but where the load is dropped is finally up to
                    the driver — they&apos;ll get as close to your request as the site, the truck,
                    and safety allow.
                  </p>
                  {placeError && <div className="alert error">{placeError}</div>}
                  <div style={{ marginTop: 18 }}>
                    <button
                      className="btn big"
                      disabled={placing || quote.dates.length === 0}
                      style={{ width: "100%" }}
                    >
                      {placing
                        ? "Placing order…"
                        : `Place order — ${usd(quote.priced.totalCents)} (pay on delivery)`}
                    </button>
                    <p className="muted" style={{ marginTop: 8, textAlign: "center" }}>
                      {isDemo
                        ? "Demo mode — the order is simulated. Nothing real is placed and no emails are sent."
                        : `No payment now. ${yardName} will confirm your delivery date.`}
                    </p>
                  </div>
                </form>
              )}
            </>
          )}
        </>
      )}
        </>
      )}
    </>
  );

  // Compact order summary for the rail. It stays small and always visible; the button opens the
  // full checkout modal above.
  const summary = (
    <div className="card checkout-summary" aria-label="Your order">
      <h3>Your order</h3>
      {cartCount === 0 ? (
        <p className="muted" style={{ margin: 0 }}>
          Add materials to start your order — you&apos;ll get delivery pricing at checkout.
        </p>
      ) : (
        <>
          <div className="summary-line">
            <span>
              {cartCount} {cartCount === 1 ? "item" : "items"}
            </span>
            <strong>{usd(quote ? quote.priced.totalCents : materialSubtotalCents)}</strong>
          </div>
          <p className="muted" style={{ margin: "4px 0 14px" }}>
            {quote ? `Delivery to ${zip} included` : "Materials subtotal — delivery added at checkout"}
          </p>
          <button
            type="button"
            className="btn"
            style={{ width: "100%" }}
            onClick={() => setCheckoutOpen(true)}
          >
            {quote ? "Review & place order" : "Continue to checkout"}
          </button>
        </>
      )}
    </div>
  );

  return (
    <div className="stack">
      {/* Yardage calculator */}
      <div className="card" style={{ maxWidth: 720 }}>
        <h3>Not sure how much you need?</h3>
        <div className="field-row" style={{ alignItems: "flex-end" }}>
          <div>
            <label htmlFor="calc-sqft">Area (sq ft)</label>
            <input
              id="calc-sqft"
              inputMode="numeric"
              placeholder="e.g. 500"
              value={calcSqft}
              onChange={(e) => setCalcSqft(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="calc-depth">Depth (inches)</label>
            <select id="calc-depth" value={calcDepth} onChange={(e) => setCalcDepth(e.target.value)}>
              {["1", "2", "3", "4", "6"].map((d) => (
                <option key={d} value={d}>
                  {d}&quot;
                </option>
              ))}
            </select>
          </div>
          <div>
            <div
              style={{ padding: "9px 12px", fontWeight: 700 }}
              aria-live="polite"
            >
              {calcYards ? `≈ ${calcYards} cubic yards` : "—"}
            </div>
          </div>
        </div>
      </div>

      {/* Catalog: categories + a compact order summary ride along on the left, product gallery on
          the right. The rail sticks so the order summary is always in reach; its button opens the
          full checkout in a modal. */}
      <div className="shopfront">
        <div className="shop-rail">
          <aside className="shop-filters" aria-label="Product categories">
            <h3>Shop by category</h3>
            <ul>
              {filters.map((f) => (
                <li key={f.slug}>
                  <button
                    type="button"
                    aria-pressed={activeCategory === f.slug}
                    aria-label={`${f.label} (${f.count})`}
                    onClick={() => setActiveCategory(f.slug)}
                  >
                    <span>{f.label}</span>
                    <span className="count">{f.count}</span>
                  </button>
                </li>
              ))}
            </ul>
          </aside>

          {summary}
        </div>

        <div className="shop-results">
          <div className="shop-head">
            <h2 style={{ margin: 0 }}>{activeLabel}</h2>
            <span className="muted">
              {shown.length} {shown.length === 1 ? "product" : "products"}
            </span>
          </div>

          {shown.length === 0 ? (
            <p className="muted">
              Nothing listed here right now — call {yardPhone || yardName} and we&apos;ll sort you out.
            </p>
          ) : (
            <div className="product-grid">
              {shown.map((p) => {
                const qty = cart[p.id] ?? 0;
                return (
                  <div className={`card product-card${qty > 0 ? " in-cart" : ""}`} key={p.id}>
                    {p.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        className="product-thumb"
                        src={p.imageUrl}
                        alt={p.name}
                        loading="lazy"
                        onClick={() => setLightbox({ src: p.imageUrl, alt: p.name })}
                        title="Click to enlarge"
                      />
                    ) : (
                      <div className="product-thumb empty" aria-hidden="true">
                        {/* Neutral stand-in until the yard uploads a photo — a material-specific
                            icon would be wrong for half the catalog. */}
                        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <rect x="3" y="5" width="18" height="14" rx="2" />
                          <circle cx="8.5" cy="10" r="1.5" />
                          <path d="M21 16l-5-5-5.5 6" />
                        </svg>
                      </div>
                    )}
                    {activeCategory === "all" && <div className="pcat">{p.categoryLabel}</div>}
                    <div className="pname">{p.name}</div>
                    {p.description && <div className="pdesc">{p.description}</div>}
                    <div className="pprice">
                      <strong>{usd(p.priceCents)}</strong>{" "}
                      <span className="muted">per {UNIT_LABELS[p.unit] ?? p.unit}</span>
                    </div>
                    <div className="qty-row">
                      <button
                        type="button"
                        className="btn secondary small"
                        aria-label={`Less ${p.name}`}
                        onClick={() => bumpQty(p, -1)}
                      >
                        −
                      </button>
                      <input
                        inputMode="decimal"
                        aria-label={`Quantity of ${p.name}`}
                        value={qty || ""}
                        placeholder="0"
                        onChange={(e) => setQty(p, parseFloat(e.target.value))}
                      />
                      <button
                        type="button"
                        className="btn secondary small"
                        aria-label={`More ${p.name}`}
                        onClick={() => bumpQty(p, 1)}
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>


      {checkoutOpen && (
        <div
          className="modal-overlay"
          onClick={() => setCheckoutOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Checkout"
        >
          <div
            className="modal-card checkout-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="modal-close"
              aria-label="Close checkout"
              onClick={() => setCheckoutOpen(false)}
            >
              ×
            </button>
            {checkoutBody}
          </div>
        </div>
      )}

      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          role="dialog"
          aria-modal="true"
          aria-label={lightbox.alt}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background: "rgba(0,0,0,0.8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            cursor: "zoom-out",
          }}
        >
          <button
            type="button"
            aria-label="Close"
            onClick={() => setLightbox(null)}
            style={{
              position: "absolute",
              top: 16,
              right: 20,
              background: "transparent",
              border: "none",
              color: "#fff",
              fontSize: 40,
              lineHeight: 1,
              cursor: "pointer",
            }}
          >
            ×
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox.src}
            alt={lightbox.alt}
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: "100%",
              maxHeight: "100%",
              objectFit: "contain",
              borderRadius: 8,
              boxShadow: "0 8px 40px rgba(0,0,0,0.5)",
              cursor: "default",
            }}
          />
        </div>
      )}
    </div>
  );
}
