# Production Deployment Runbook

Target: **Fly.io** (single small machine + volume, ~$5–10/mo) or **Vercel + Neon Postgres**
(free tiers to start). Either fits the budget; Fly keeps SQLite an option, Vercel requires
Postgres. Recommended: **Vercel + Neon** for zero-ops.

## One-time owner setup (accounts the founder must own)
1. Domain (e.g. yardcart.com or similar available name) — ~$12/yr.
2. Vercel account (free Hobby is fine to start; Pro $20/mo when commercial).
3. Neon.tech Postgres (free tier: 0.5 GB — plenty at launch).
4. Resend.com (email; free 100/day → $20/mo) + verify sending domain (SPF/DKIM records).
5. Stripe account (test keys first; activate live later).
6. Sentry (free tier) — optional but recommended.

## Steps
1. **Postgres switch:** in `prisma/schema.prisma` set `provider = "postgresql"`; set
   `DATABASE_URL` to the Neon connection string; run `npx prisma migrate deploy`.
   (Migrations were authored on SQLite; regenerate once against Postgres:
   `npx prisma migrate dev --name init-pg` on a scratch branch DB, commit the migration.)
2. **Env vars** (Vercel project settings): `DATABASE_URL`, `SESSION_SECRET` (generate:
   `openssl rand -hex 32`), `APP_URL=https://<domain>`, `RESEND_API_KEY`, `EMAIL_FROM`,
   `STRIPE_SECRET_KEY` (test mode first), `STRIPE_WEBHOOK_SECRET`, `SENTRY_DSN`.
3. **Deploy:** connect the git repo to Vercel; build command `next build` (default).
4. **Stripe webhook:** add endpoint `https://<domain>/api/stripe/webhook` subscribed to
   `checkout.session.completed`, `customer.subscription.deleted`, and
   `invoice.payment_failed`; copy the signing secret into `STRIPE_WEBHOOK_SECRET`.
   (`subscription.deleted` is what flips a yard to CANCELED at the end of a
   cancel-at-period-end cancellation; `payment_failed` marks it PAST_DUE.)
5. **Demo storefront:** run `DATABASE_URL="<neon url>" npm run seed:demo` once to create
   the public demo yard (`/s/cedar-ridge-demo`). This prod-safe seed creates the
   storefront only — no login user, no yard email, no fake orders — and checkout against
   it is simulated server-side (no order rows, no emails; see `lib/demo.ts`). Do **not**
   run the full local seed (`npm run seed` / `prisma/seed.ts`) against production.
   Create the first real yard through /signup.
6. **Backups:** Neon has PITR on free tier; additionally schedule a weekly `pg_dump`
   (GitHub Action cron) to private storage.
7. **Smoke test (prod):** signup → onboarding → storefront order with a test ZIP →
   schedule → mailbox shows Resend-sent mail → Stripe test checkout with card 4242… →
   webhook activates plan. Then exercise the plan-change paths on that test yard:
   **switch tier** (e.g. Starter → Pro) and confirm Stripe shows the *same* subscription
   with a new price (not a second subscription); **cancel** and confirm the subscription
   shows "cancels at period end" in Stripe and the app reflects the pending cancellation.
   Also confirm a Starter yard is blocked from Pro pages (Dispatch/Trucks/Reports show the
   upgrade prompt; `/app/reports/export` returns 403) while a Pro/trial yard is not.
   On a Multi yard, confirm `/app/locations` can add a 2nd location (capped at 5), the nav
   yard-switcher appears, and both locations show as ACTIVE (billing mirrors across them).

## Security checklist before public launch
- [ ] `SESSION_SECRET` rotated from any value ever committed or shared
- [ ] Auth pages behind HTTPS only (Vercel default)
- [ ] `npm audit` reviewed (2 known moderate dev-time advisories documented in TESTING.md)
- [ ] Rate limits verified in prod (single instance) — move to Upstash if scaling out
- [x] Privacy/Terms contact email set to support@getyardcart.com and security page to
      security@getyardcart.com — **create both aliases (forwarding is fine) and monitor them**

## Running migrations against Neon

`DATABASE_URL` points at Neon's **pooled** endpoint (`...-pooler...`), which is right for the
app at runtime but wrong for schema migrations.

- `prisma migrate deploy` — what the build runs (`npm run build`). Applies the committed
  migration files in order. Needs no shadow database and does no drift detection, so it is
  safe over the pooler. **Production is unaffected by the caveat below.**
- `prisma migrate dev` — needs a *shadow database* to diff against, and tries to create one on
  the same server. Over a pooled Neon connection with no shadow/direct URL configured this
  misbehaves: on 2026-07-22 it left the Phase 2a delivery tables in the dev branch with no
  migration file recording them, which would have shipped a schema production could never
  reproduce. Caught by the next `migrate dev` reporting drift.

**This is now configured.** `DIRECT_URL` holds Neon's direct endpoint — the same host without
the `-pooler` suffix — and the datasource declares it:

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")  // pooled — app runtime
  directUrl = env("DIRECT_URL")    // direct — migrations & introspection
}
```

`DIRECT_URL` must exist in Vercel (Production + Preview, marked Sensitive) as well as locally,
or `prisma migrate deploy` fails during the build.

> **The trap:** these are the same database reached two ways, and the hosts must differ. Removing
> `-pooler` from `DATABASE_URL` instead of adding a separate `DIRECT_URL` silently drops connection
> pooling for the running app. Everything works locally; production exhausts Neon's connection
> limit under load. If in doubt, re-copy both strings from the Neon Console.

After any schema change, confirm the migrations and the schema agree — this must print an
empty migration:

```bash
npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script
```

If `migrate dev` ever reports it cannot create the shadow database, the Neon role lacks CREATEDB.
Create a throwaway Neon branch, set `SHADOW_DATABASE_URL` to its direct string, and add
`shadowDatabaseUrl = env("SHADOW_DATABASE_URL")` to the datasource. Prisma resets that branch on
every run, so never point it at data you care about.
