# Architecture

## Stack
Next.js 15 (App Router, server components + server actions) · TypeScript · Prisma 6 ·
SQLite (dev/demo) → Postgres (production) · custom cookie-session auth (jose JWT + bcrypt)
· no CSS framework (hand-rolled design system in `app/globals.css`).

Rationale: one deployable unit, minimal dependencies, everything swappable at the env layer
(email, billing, error reporting), cheap to host, fast for a solo founder to maintain.

## Data model (prisma/schema.prisma)
- **Yard** — tenant. All queries scope by `yardId`; users belong to exactly one yard (MVP).
- **Category** — per-yard storefront section. `slug` is immutable (it is what
  `Product.category` stores); `label` and `sortOrder` are freely editable. Every yard is
  seeded the six built-ins and can add its own (sand, construction material, …).
- **Product** — priced per unit (`cubic_yard`, `half_yard`, `bag`, `cord`, `face_cord`, `ton`).
  Prices stored in integer cents. Soft-delete via `active` to preserve order history.
  Carries delivery load attributes (`yardsPerUnit`, `weightLbsPerUnit`, `palletsPerUnit`)
  plus optional method allow-lists and required equipment.
- **Zone** — named delivery area = list of ZIP codes + fee + minimum order. Overlap resolves
  to the cheapest fee (`lib/zones.ts`). Typically named for a distance band ("0–3 miles");
  there is no geocoding, so ZIP membership is the proxy for distance.
- **DeliveryMethod** — a delivery *service* ("Medium dump truck"), not a physical truck.
  Per-trip limits in yards / lbs / pallets, where 0 means "don't enforce".
- **DeliveryRate** — one cell of the sparse zone × method fee grid; a missing cell falls back
  to `Zone.deliveryFeeCents`.
- **DeliveryAddOn** — equipment billed on top (forklift), pulled in automatically by products
  that require it, per trip or once per order.
- **Truck** — supplies `maxTripsPerDay` to the delivery method it performs.
- **Order / OrderItem** — item rows snapshot name/unit/price at order time. Per-yard
  sequential `number` (customer-facing) assigned in a transaction; global `cuid` id.
  Status: NEW → SCHEDULED → OUT_FOR_DELIVERY → DELIVERED (or CANCELED).
- **EmailLog** — test-mode outbound mailbox + audit trail. **EventLog/ErrorLog** —
  first-party analytics/error monitoring. **Invoice** — billing records (MOCK or Stripe).

## Delivery model (lib/load.ts, lib/delivery.ts)
A yard states truck limits in whichever unit suits each material — "10 tons of gravel or
18 yards of mulch" is one truck described twice. So limits are a **utilization** model, not
independent caps: each dimension's load ÷ limit is computed and the hardest-binding one is
`ceil()`ed into a trip count. Gravel binds on weight, mulch on volume, pallets on count.
A limit of 0 is skipped, which is the owner's override when the physics disagrees with
their stated policy.

The customer never picks a truck. `selectDelivery()` reads the cart and resolves to one of:
an auto-assigned method (cheapest eligible, overridable to another *eligible* one), a
quote-only escalation, a cart needing more than one delivery, or nothing that can haul it.
Fee = `rate(zone, method) × trips + add-ons`. `placeOrder` always recomputes this, so a
stale or hand-edited client choice can never set the price.

Fees live in a grid rather than a base-plus-surcharge formula because real published tables
are not a constant offset between columns.

With no methods configured, a yard prices exactly as it did before the feature existed via
an implicit unlimited method — and product method restrictions are dropped in that case, so
retiring the last method cannot close a storefront.

## Capacity model (lib/capacity.ts)
Day-level, measured in **truck trips per method**. Trucks supply trips to the method they
perform; an order consumes its `tripCount` from that method's pool only, so a full flatbed
day leaves the dump trucks open. Trips are the only unit that works across materials — the
previous yards-based pool charged tons, cords, and pallets zero and made the yard look
infinitely available for anything not sold by the cubic yard.

A method with no trucks assigned is **unconstrained, not full**: assigning trucks is Pro-only,
so treating undeclared capacity as zero would let a Starter yard configure methods and
silently close its own storefront. Trucks with no method form a legacy pool.

Still deliberately coarse (no routing/geo) — good enough to prevent overbooking, simple
enough for owners to trust and predict.

## Auth & security
- bcrypt(11) password hashes; JWT (HS256, `SESSION_SECRET`) in HttpOnly SameSite=Lax cookie.
- Every dashboard query/action goes through `requireYardUser()` and scopes by the session's
  yard; object access re-checks ownership (`order.yardId !== ctx.yard.id → 404`).
- Server actions (Next 15) carry framework CSRF protection (POST + origin checks);
  SameSite=Lax cookies cover the API routes, which are otherwise public endpoints.
- Public endpoints: zod validation, in-memory rate limits (order: 8/h/IP, login: 10/15min,
  signup: 5/h), honeypot field on checkout.
- No card data touches the app (Stripe Checkout hosted page).
- Known limits (single-instance): in-memory rate limiter resets on deploy; swap for
  Upstash Redis if multi-instance.

## Integration seams (env-gated, dormant by default)
- `lib/mailer.ts` — Resend REST; falls back to EmailLog test mailbox.
- `lib/billing.ts` + `app/api/stripe/webhook` — Stripe Checkout via REST + signed webhook
  (manual HMAC verification, replay-protected); falls back to mock checkout with TEST invoices.
- `lib/observability.ts` — DB-backed; Sentry via `SENTRY_DSN` at deploy time.

## Key decisions
1. **ZIP-based zones, not map-drawn polygons** — no maps API key, no geocoding cost,
   owners already think in ZIPs; can add radius/drive-time later.
2. **Pay-on-delivery first** — matches industry norms (verified in prospect research),
   removes checkout friction and payment-processor dependency from the critical path.
   Online prepayment can be added via the existing Stripe seam.
3. **Mulch/topsoil/compost/firewood scope; stone by the ton deferred** — certified-scale
   ticketing is a hardware/compliance project (skeptic finding R3A); volume goods aren't.
4. **SQLite dev / Postgres prod via Prisma** — swap `provider` + `DATABASE_URL`, run
   `prisma migrate deploy`.
