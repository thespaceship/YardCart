"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  // Empty = let the yard's rules pick. Only set when the customer deliberately overrides.
  const [methodId, setMethodId] = useState("");
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
  const checkoutRef = useRef<HTMLDivElement>(null);

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
        body: JSON.stringify({ zip, cart: cartLines, methodId: methodId || undefined }),
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
  }, [zip, cartLines, slug, selectedDate, methodId]);

  // re-quote when the cart or the chosen truck changes after a ZIP has been checked
  useEffect(() => {
    if (zipChecked && cartLines.length > 0) void fetchQuote();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(cartLines), methodId]);

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
        checkoutRef.current?.scrollIntoView({ behavior: "smooth" });
      } else {
        router.push(`/s/${slug}/thanks/${data.orderId}`);
      }
    } catch {
      setPlaceError("Network problem — please try again.");
    } finally {
      setPlacing(false);
    }
  }

  return (
    <div className="stack">
      {/* Yardage calculator */}
      <div className="card">
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

      {/* Catalog */}
      {sections.map((section) => (
        <div key={section.slug}>
          <h2 style={{ margin: "8px 0 12px" }}>{section.label}</h2>
          <div className="stack">
            {section.products.map((p: PublicProduct) => {
              const qty = cart[p.id] ?? 0;
              return (
                <div className="card spread" key={p.id}>
                  {p.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.imageUrl}
                      alt={p.name}
                      loading="lazy"
                      style={{ width: 84, height: 84, objectFit: "cover", borderRadius: 8, border: "1px solid var(--line)", flexShrink: 0 }}
                    />
                  )}
                  <div style={{ flex: 1, minWidth: 220 }}>
                    <strong>{p.name}</strong>
                    <div className="muted">{p.description}</div>
                    <div style={{ marginTop: 4 }}>
                      <strong>{usd(p.priceCents)}</strong>{" "}
                      <span className="muted">per {UNIT_LABELS[p.unit] ?? p.unit}</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <button
                      type="button"
                      className="btn secondary small"
                      aria-label={`Less ${p.name}`}
                      onClick={() => bumpQty(p, -1)}
                    >
                      −
                    </button>
                    <input
                      style={{ width: 76, textAlign: "center" }}
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
        </div>
      ))}

      {/* Delivery check + checkout */}
      <div className="card" ref={checkoutRef}>
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
              <button type="button" className="btn secondary" onClick={() => setDemoPlaced(false)}>
                Back to the demo
              </button>
            </div>
          </>
        ) : (
          <>
        <h2>Delivery</h2>
        {cartCount === 0 ? (
          <p className="muted">Add materials above to check delivery pricing for your address.</p>
        ) : (
          <>
            <div className="field-row" style={{ alignItems: "flex-end", maxWidth: 420 }}>
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

                {quote.delivery && (
                  <div style={{ margin: "12px 0" }}>
                    <label htmlFor="method">Delivered by</label>
                    {quote.delivery.options.length > 1 ? (
                      <select
                        id="method"
                        value={methodId || quote.delivery.selected.methodId}
                        onChange={(e) => setMethodId(e.target.value)}
                      >
                        {quote.delivery.options.map((o) => (
                          <option key={o.methodId} value={o.methodId}>
                            {o.name} — {usd(o.feeCents)}
                            {o.trips > 1 ? ` (${o.trips} trips)` : ""}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div style={{ fontWeight: 700 }}>{quote.delivery.selected.name}</div>
                    )}
                    <p className="muted" style={{ margin: "6px 0 0" }}>
                      {quote.delivery.selected.description}
                      {quote.delivery.selected.trips > 1 && (
                        <>
                          {quote.delivery.selected.description ? " · " : ""}
                          Your order needs {quote.delivery.selected.trips} trips
                          {quote.delivery.selected.binding === "weight" && " (weight limit)"}
                          {quote.delivery.selected.binding === "yards" && " (volume limit)"}
                          {quote.delivery.selected.binding === "pallets" && " (pallet limit)"}.
                        </>
                      )}
                    </p>
                  </div>
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
                    for this area — add a bit more above.
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
                    <label htmlFor="notes">Placement instructions (optional)</label>
                    <textarea
                      id="notes"
                      rows={2}
                      placeholder="e.g. Dump on the driveway, left of the garage"
                      value={form.placementNotes}
                      onChange={(e) => setForm({ ...form, placementNotes: e.target.value })}
                    />
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
      </div>
    </div>
  );
}
