# YardCart

Online ordering + dispatch software for bulk landscape-material suppliers (mulch, topsoil,
compost, firewood). Customers order on a yard's hosted storefront with instant ZIP-based
delivery pricing; the yard schedules, dispatches, and prints delivery tickets.

**Positioning:** flat monthly price, no per-order fees (vs. incumbent's $0/mo + 2.5%/order).

## Quick start

```bash
npm install
npx prisma migrate dev   # creates dev.db (SQLite)
npx prisma db seed       # seeds the synthetic demo yard
npm run dev              # http://localhost:3000
```

**Demo login:** `demo@yardcart.test` / `demo-password-123`
**Demo storefront:** http://localhost:3000/s/cedar-ridge-demo

## What's where

| Path | Purpose |
| --- | --- |
| `app/page.tsx`, `app/pricing`, `app/privacy`, `app/security` | Marketing site |
| `app/(auth)` | Login / signup |
| `app/s/[slug]` | Public storefront (catalog, calculator, ZIP quote, checkout) |
| `app/app/*` | Yard dashboard (orders, dispatch, products, zones, trucks, reports, mailbox, billing, settings, onboarding) |
| `app/api/storefront/*` | Public quote + order APIs (rate-limited, honeypot) |
| `app/api/stripe/webhook` | Stripe webhook (inactive without env keys) |
| `lib/` | Domain logic: pricing, zones, capacity, orders, auth, mailer, billing, observability |
| `prisma/` | Schema, migrations, demo seed |
| `tests/` | Vitest unit + integration tests (`npm test`) |

## Test modes (no external accounts needed)

- **Email:** without `RESEND_API_KEY`, all outbound email is captured to the in-app
  Mailbox (`/app/mailbox`) instead of being sent.
- **Billing:** without `STRIPE_SECRET_KEY`, checkout is simulated — plan flips and a
  clearly-marked TEST invoice is recorded. With keys, real Stripe Checkout (test or live
  mode per key) + webhook activation.
- **Analytics / errors:** first-party `EventLog` / `ErrorLog` tables; Sentry/Plausible
  optional via env.

## Environment

See `.env` (dev defaults included). Production requires `SESSION_SECRET` (32+ chars),
`DATABASE_URL`, `APP_URL`; optional `RESEND_API_KEY`, `EMAIL_FROM`, `STRIPE_SECRET_KEY`,
`STRIPE_WEBHOOK_SECRET`, `SENTRY_DSN`.

## Docs

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — data model, capacity model, auth, decisions
- [docs/DEPLOY.md](docs/DEPLOY.md) — production deployment runbook
- [docs/TESTING.md](docs/TESTING.md) — test strategy and manual QA script
- Business package: `../../ops/` (ICP, GTM, prospects, budget, risks, owner checklist)
