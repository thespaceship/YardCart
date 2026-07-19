# Architecture

## Stack
Next.js 15 (App Router, server components + server actions) · TypeScript · Prisma 6 ·
SQLite (dev/demo) → Postgres (production) · custom cookie-session auth (jose JWT + bcrypt)
· no CSS framework (hand-rolled design system in `app/globals.css`).

Rationale: one deployable unit, minimal dependencies, everything swappable at the env layer
(email, billing, error reporting), cheap to host, fast for a solo founder to maintain.

## Data model (prisma/schema.prisma)
- **Yard** — tenant. All queries scope by `yardId`; users belong to exactly one yard (MVP).
- **Product** — priced per unit (`cubic_yard`, `half_yard`, `bag`, `cord`, `face_cord`, `ton`).
  Prices stored in integer cents. Soft-delete via `active` to preserve order history.
- **Zone** — named delivery area = list of ZIP codes + fee + minimum order. Overlap resolves
  to the cheapest fee (`lib/zones.ts`).
- **Truck** — `capacityYards × maxTripsPerDay` contributes to daily capacity.
- **Order / OrderItem** — item rows snapshot name/unit/price at order time. Per-yard
  sequential `number` (customer-facing) assigned in a transaction; global `cuid` id.
  Status: NEW → SCHEDULED → OUT_FOR_DELIVERY → DELIVERED (or CANCELED).
- **EmailLog** — test-mode outbound mailbox + audit trail. **EventLog/ErrorLog** —
  first-party analytics/error monitoring. **Invoice** — billing records (MOCK or Stripe).

## Capacity model (lib/capacity.ts)
Day-level: daily capacity = Σ active trucks (capacity × trips). An order consumes its
volume-equivalent yards (min 1). The storefront date picker only offers dates where
remaining capacity fits the cart, after lead-time/cutoff/booking-window rules. This is
deliberately coarse (no routing/geo yet) — good enough to prevent overbooking, simple
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
