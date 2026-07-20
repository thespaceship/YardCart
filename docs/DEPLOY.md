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
4. **Stripe webhook:** add endpoint `https://<domain>/api/stripe/webhook` for
   `checkout.session.completed`; copy the signing secret into `STRIPE_WEBHOOK_SECRET`.
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
   webhook activates plan.

## Security checklist before public launch
- [ ] `SESSION_SECRET` rotated from any value ever committed or shared
- [ ] Auth pages behind HTTPS only (Vercel default)
- [ ] `npm audit` reviewed (2 known moderate dev-time advisories documented in TESTING.md)
- [ ] Rate limits verified in prod (single instance) — move to Upstash if scaling out
- [x] Privacy/Terms contact email set to support@getyardcart.com and security page to
      security@getyardcart.com — **create both aliases (forwarding is fine) and monitor them**
