# Pre-launch Audit — REVIEW FINDINGS

Independent review of YardCart (Next.js 15 + Prisma 6 + SQLite, custom JWT auth).
Date: 2026-07-19. Scope: security, correctness, data integrity, robustness.

**Verification:** `npm test` — 30/30 pass. `npx tsc --noEmit` — clean.

**Counts:** Critical 0 · High 4 · Medium 7 · Low 8

Tenant isolation is generally solid: every dashboard page and server action goes through
`requireYardUser()` and re-checks `yardId` on object access (one gap: H4/M6 truck
reference). No SQL injection (Prisma parameterized) and no stored-XSS render path in
React pages (no `dangerouslySetInnerHTML`; mailbox iframe is fully sandboxed). The
findings below are what stands between this codebase and a safe launch.

---

## HIGH

### H1 — Order-number race: concurrent checkouts crash with a 500 on production Postgres
`lib/orders.ts:61-67`

```ts
const order = await db.$transaction(async (tx) => {
  const last = await tx.order.findFirst({ where: { yardId }, orderBy: { number: "desc" } ... });
  return tx.order.create({ data: { ..., number: (last?.number ?? 1000) + 1, ... } });
});
```

The read-then-increment is not atomic. It works on SQLite (single writer serializes) and
in the test suite, but the documented production target is Postgres (docs/DEPLOY.md step 1)
where the default isolation is READ COMMITTED: two simultaneous storefront checkouts for
the same yard both read the same `last.number`, and the second `create` violates
`@@unique([yardId, number])` (prisma/schema.prisma:137) → P2002 → generic 500 to the
customer (app/api/storefront/[slug]/order/route.ts:66-70). No retry, no serializable
isolation. Spring Saturday morning with two customers checking out at once is exactly the
launch scenario. Fix direction (do not apply now): serializable isolation + retry, a
per-yard counter row with atomic `UPDATE ... RETURNING`, or retry-on-P2002.

### H2 — Requested delivery date is never validated server-side: past dates, closed days, and overbooking
`app/api/storefront/[slug]/order/route.ts:16` + `lib/orders.ts:54-59`

The quote endpoint computes `availableDates` (lead time, cutoff, booking window,
remaining truck capacity) — but that gate lives only in the browser. The order endpoint
accepts any `requestedDate` matching `/^\d{4}-\d{2}-\d{2}$/` and `placeOrder` only checks
`isNaN`. Nothing re-checks:

- date in the past (`1999-01-01` accepted),
- date beyond `maxAdvanceDays` or inside the lead-time/cutoff window,
- remaining capacity on that day.

Failure scenario: a competitor or bot POSTs directly to
`/api/storefront/cedar-ridge-demo/order` (8/h/IP, trivially bypassed per H3) with
tomorrow's date and 50 duplicate cart lines of the same product at `maxQty` each — the
zod schema allows duplicate `productId` entries (`cart` max 50 lines, each clamped
per-line to `maxQty`), so a single order can book ~1,500 yards, and the capacity check
that the whole storefront date picker exists to enforce never runs at write time. Every
subsequent legitimate quote shows "No delivery slots available." This is the
quote/order divergence called out in the architecture as the anti-overbooking guarantee —
it does not hold at the API boundary. Same gap applies to phone orders (no warning when
the owner books a full day, arguably intended — but online must be enforced).

### H3 — Rate limits are keyed on a client-spoofable header and are per-process: brute force and order spam are practical
`app/actions/auth.ts:19-22`, `app/api/storefront/[slug]/order/route.ts:24`, `lib/ratelimit.ts`

```ts
return h.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
```

Two independent bypasses:

1. **Spoofable key.** The code trusts the *first* element of `X-Forwarded-For`. On any
   platform where the proxy appends (Fly.io, most nginx setups), the leftmost value is
   whatever the client sent. `curl -H "X-Forwarded-For: 1.2.3.$RANDOM"` gives a fresh
   bucket per request → the 10/15min login limit becomes unlimited password brute force
   against `demo@yardcart.test` or any harvested email (no lockout, no 2FA, no
   password-reset flow to invalidate), and the 8/h order limit becomes unlimited fake
   orders flooding a yard's inbox and its email notifications.
2. **Per-instance memory.** `lib/ratelimit.ts` is a module-level `Map`. DEPLOY.md
   recommends **Vercel**, i.e. serverless with many concurrent instances; each lambda has
   its own map, so even unspoofed limits multiply by instance count and reset constantly.
   The "single-instance" caveat in ARCHITECTURE.md contradicts the recommended deploy target.

Use the platform-trusted client IP (rightmost untrusted hop / `request.ip` equivalent) and
a shared store before launch.

### H4 — Timezone bugs in capacity/date logic: wrong cutoff hour and off-by-one delivery dates on a UTC server
`lib/capacity.ts:25-27` (`dateKey` = `toISOString()`, UTC), `lib/capacity.ts:79` (`now.getHours()`, server-local), `app/api/storefront/[slug]/quote/route.ts:45-51`, `app/app/page.tsx:10-17`, `app/app/dispatch/page.tsx:18-48`

The code mixes three clocks: UTC date keys (`toISOString().slice(0,10)`), server-local
hours/midnights (`getHours()`, `setHours(0,0,0,0)`), and the yard's actual local time —
which is never modeled anywhere (no timezone field on `Yard`).

Concrete failures with the recommended deploy (Vercel = UTC) and an Ohio yard (UTC-4/-5):

- **Cutoff fires ~4–5 h early or wraps.** `orderCutoffHour` is documented as "local hour"
  (schema.prisma:37) but compared against `now.getHours()` in server time. Cutoff 15 → on
  a UTC server the cutoff triggers at **11 AM** Ohio time (15:00 UTC), refusing next-day
  orders all afternoon; conversely at 8 PM Ohio (00:00 UTC) the code thinks it is
  *morning* and re-allows next-day delivery after the real cutoff.
- **Evening date shift.** At 8 PM EDT, `now` is already tomorrow in UTC; `dateKey(now + minLeadDays)`
  yields a date one day later than intended, so the storefront date picker skips the first
  valid day (lost orders) — and by the reverse sign in UTC+ regions would *offer* a day
  the yard doesn't intend.
- **Dashboard bucketing mismatch.** `app/app/page.tsx` builds "today" from local-midnight
  Dates but `computeDayLoads` keys them through UTC `dateKey`; dispatch groups
  `scheduledDate` (stored at `T12:00:00Z`) by UTC key while its day columns come from
  local midnights. Whenever server-local and UTC calendar dates differ, the "Today's
  truck capacity" card and dispatch columns bucket orders into the wrong day.

`tests/capacity.test.ts` passes only because tests construct `now` in the same process
timezone with mid-day hours. Model the yard's timezone explicitly (or compute all keys in
one consistent zone) before launch.

---

## MEDIUM

### M1 — Stripe webhook: no idempotency/event dedup; ignores subscription lifecycle; provider mislabeled
`app/api/stripe/webhook/route.ts:19-20, 44-74`

Signature verification itself is correct (HMAC-SHA256 over `t.payload`, `timingSafeEqual`
with try/catch for length mismatch, 5-minute tolerance). Remaining issues:

- **No `event.id` dedup.** Stripe redelivers events, and a captured request can be
  replayed for 5 minutes: each delivery re-runs the transaction and creates a duplicate
  `Invoice` row (and re-activates the plan). Store processed event ids.
- **Only `checkout.session.completed` is handled.** No `invoice.payment_failed`,
  `customer.subscription.deleted/updated` → once ACTIVE, a yard whose card dies or who
  cancels in Stripe stays ACTIVE forever; `PAST_DUE`/`CANCELED` states are unreachable
  from Stripe (compounds M5).
- `provider: "STRIPE_TEST"` is hardcoded (line 69) even when `session.livemode` is true —
  live invoices are recorded as test-provider rows; `payment_status` on the session is
  never checked.
- Minor: `header.split(",")` keeps only the last `v1` when Stripe sends multiple
  signatures (key rolls) — verification can fail spuriously during secret rotation.

### M2 — HTML injection into outbound email via customer-controlled fields
`lib/orders.ts:106-147`, `app/actions/orders.ts:43-56`, `lib/mailer.ts:48-55`

`customerName`, `placementNotes`, `addressLine`, and product `nameSnap` are concatenated
into email HTML with no escaping. The in-app mailbox is safe (`app/app/mailbox/page.tsx:38`
renders in an iframe with `sandbox=""` — scripts blocked, good), but once
`RESEND_API_KEY` is set (the launch plan per DEPLOY.md), a checkout with
`placementNotes = "<a href=https://evil.example>Click to reschedule your delivery</a><style>...</style>"`
or an HTML-payload name lands as **rendered markup** in the yard owner's and customer's
real inboxes — attacker-authored phishing content sent from the yard's verified domain.
Escape all interpolated values in `emailShell`/callers.

### M3 — CSV formula injection in the QuickBooks export
`app/app/reports/export/route.ts:5-8, 35`

`csvEscape` handles quotes/commas but not leading `=`, `+`, `-`, `@`. A customer named
`=HYPERLINK("http://evil.example/x","Open")` (or `=cmd|' /C ...'!A1` for legacy Excel/DDE)
is written verbatim; the yard owner opens the export in Excel/QuickBooks and the formula
executes. Prefix risky leading characters with `'` on export.

### M4 — Quote endpoint: unauthenticated, un-rate-limited, unbounded query per call
`app/api/storefront/[slug]/quote/route.ts:14-64`

Unlike the order endpoint, `/api/storefront/[slug]/quote` has **no rate limit**, and each
call runs `db.order.findMany` over *all* open orders for the yard including items
(lines 52-55), plus zone/product includes. A loop of cheap POSTs hammers the DB (Neon
free tier per DEPLOY.md) into exhaustion — a trivial storefront-takedown vector, and the
path bots will hit hardest. Also every storefront page view inserts an `EventLog` row
(app/s/[slug]/page.tsx:27) with no cap or pruning — crawler traffic bloats the free-tier DB.

### M5 — Billing is never enforced: trials never expire, canceled plans keep full service, mock checkout grants free plans
Grep-verified: `trialEndsAt` / `planStatus` are only *displayed* (billing/settings pages);
no query or action gates anything on them.

- A yard whose 14-day trial ended in 2026 keeps the storefront, dispatch, and reports
  forever; `planStatus` stays `TRIALING` indefinitely (nothing ever sets `PAST_DUE`).
- `cancelPlan` (app/actions/billing.ts:62-70) sets `planStatus: "CANCELED"` — and nothing
  changes for the yard.
- If production launches without `STRIPE_SECRET_KEY` (mock seam active,
  app/actions/billing.ts:26-46), the billing page is live and any user can click
  "Activate (test)" to flip themselves to any plan, `planStatus: ACTIVE`, free. Since the
  whole business model is the flat monthly fee, enforcement (or at least a
  storefront/ordering gate on expired non-paying yards) is a launch prerequisite.

### M6 — `scheduleOrder` accepts an arbitrary `truckId` with no ownership check (cross-tenant reference)
`app/actions/orders.ts:19-35`

The order itself is ownership-checked (`ownedOrder`), but `truckId` from the form is
written as-is: `truckId: truckId || null`. A logged-in user of yard A who obtains any
yard-B truck cuid can attach yard B's truck to their own order; the foreign truck's
`name` then renders on yard A's order detail, dispatch board, and printed ticket.
Impact is modest (cuids are hard to guess; capacity math elsewhere only counts a yard's
own trucks), but it is the one place in the mutation surface where a client-supplied id
crosses the tenant boundary without a `yardId` re-check. Validate
`truck.yardId === ctx.yard.id` like every other id.

### M7 — Dev `SESSION_SECRET` committed; only a length check stands between it and production
`.env:2`, `lib/auth.ts:10-16`

The dev secret (`dev-only-secret-change-in-production-...`, 48 chars) is in the repo and
passes the `>= 32 chars` guard. If the app is ever deployed with `.env` bundled or the
value copy-pasted, anyone who has seen the repo can mint valid HS256 session JWTs for
**any user id** → full auth bypass across all tenants. DEPLOY.md's checklist mentions
rotation, but nothing technical prevents the known value in production (e.g. refuse
boot when `NODE_ENV === "production"` and the secret matches the committed default).
Related: JWTs are valid 14 days with no server-side revocation — logout only deletes the
cookie, and there is no password-change/reset flow to invalidate stolen sessions.

---

## LOW

### L1 — Order status transitions are unrestricted; no-op payment logic
`app/actions/orders.ts:60-95`

Any of the five statuses can be set from any other (UI hides but action allows):
DELIVERED → NEW, re-marking DELIVERED resets `deliveredAt` to now (shifts the 30/90-day
revenue reports and the QuickBooks export window). The `paymentStatus` ternary at lines
73-76 returns `order.paymentStatus` in **both** branches — dead code that suggests an
intended "auto-mark paid on delivery" rule was never finished.

### L2 — find-then-create races on signup email and onboarding slug return raw 500s
`app/actions/auth.ts:36-41`, `app/actions/onboarding.ts:63-71`

Concurrent double-submit of signup (same email) or two onboardings slugifying to the same
name hit the unique constraint after the pre-check passes → unhandled P2002 → generic
error page instead of the friendly message. Catch P2002 and re-render the form error.

### L3 — Thanks page serves customer PII unauthenticated by order id
`app/s/[slug]/thanks/[orderId]/page.tsx:12-16`

Name, full delivery address, placement notes, and totals render to anyone holding the
order cuid (no session, no expiry). Cuids are effectively unguessable, but the URL leaks
via browser history, shared screenshots, and any analytics/referrer on the page. Consider
a short-lived token or showing only order number + total.

### L4 — Quote schema accepts non-positive quantities
`app/api/storefront/[slug]/quote/route.ts:11` — `qty: z.number()` (order route correctly
uses `.positive()`). `clampQty` (lib/pricing.ts:36-42) silently raises a negative/zero
qty to `minQty`, so a quote for `qty: -5` prices as `minQty` — confusing, not exploitable.

### L5 — Product upsert lacks field sanity checks
`app/actions/catalog.ts:17-42`: `unit` and `category` accept any string (an unknown unit
falls through `lineYards` as 0 volume → capacity floor 1); `qtyStep` accepts negative
values (`parseFloat("-1")` is truthy so the `|| 0.5` fallback never triggers), which makes
`clampQty`'s rounding misbehave; `minQty > maxQty` is representable. Whitelist units and
validate numeric ranges.

### L6 — No `error.tsx` boundaries; thrown action errors surface as the default crash page
Server actions throw bare `Error("Not found")` etc. (catalog.ts, orders.ts). In
production Next.js shows the generic error screen with a digest — functional but a rough
edge on the paid dashboard; forms using `useActionState` (auth, phone order, onboarding)
handle errors properly, the others don't.

### L7 — No security headers / CSP
`next.config.mjs` is empty: no CSP, `X-Frame-Options`/`frame-ancestors` (dashboard and
storefront are frameable — clickjacking the one-click "Cancel order" / "Activate plan"
buttons), no `Referrer-Policy` (compounds L3), no HSTS beyond platform defaults.

### L8 — Minor operational papercuts
- Orders list caps at `take: 200` with no pagination (app/app/orders/page.tsx:40) — older
  open orders silently invisible.
- `contains` search is case-sensitive on SQLite, will behave differently on Postgres.
- `matchZone` tie-breaks overlapping zones by cheapest fee only (lib/zones.ts:41); a
  cheaper-fee zone with a *higher* `minOrderCents` wins and can block orders the other
  zone would accept.
- Mock-order honeypot path returns `orderId: "ok"` (order route:41) → the client then
  navigates to `/s/[slug]/thanks/ok` → 404 for the bot; harmless but odd.
- `dollarsToCents` maps invalid input to 0 rather than rejecting (lib/money.ts:8-12) — a
  typo'd delivery fee saves as $0 silently (onboarding guards this; settings/zone forms do via `<= 0` check only for product price).

---

## Data-integrity notes (reviewed, no action needed)
- Order + items creation, mock checkout, and webhook writes are all transactional.
- Soft-delete (`active: false`) on products/zones with snapshotted `nameSnap`/`unitSnap`/
  prices on `OrderItem` correctly preserves history; FK `onDelete: SetNull` on
  product/zone/truck references keeps orders intact.
- Cascade delete on `Yard` would drop orders/invoices, but no yard-deletion flow exists.
- `sendEmail` failures are logged and never break order placement; `trackEvent`/`logError`
  are correctly swallow-safe.

## Suggested fix order for launch
1. H3 (trusted client IP + shared rate-limit store) and M7 (refuse known dev secret in prod).
2. H2 (validate requestedDate + capacity at order time, dedupe cart lines).
3. H1 (atomic order-number allocation with retry).
4. H4 (yard timezone modeling for cutoff/date keys).
5. M1/M5 (webhook idempotency + lifecycle events; gate service on plan status).
6. M2/M3 (escape email HTML; neutralize CSV formulas).

---

# Remediation (2026-07-19, post-review)

Fixed and verified (38/38 tests pass, `tsc` clean, production build clean, live API attack-path checks):
- **[High] Order-number race** → create retried up to 4× on P2002 unique violation, re-reading max (`lib/orders.ts`).
- **[High] Server-side date/capacity validation** → `placeOrder` now requires a date for ONLINE orders and re-validates it against lead time, cutoff, booking window, and remaining truck capacity; duplicate cart lines are merged before clamping. Verified by direct API POST: past and beyond-window dates → 422 `date_unavailable`.
- **[High] Timezone mixing** → new `Yard.timezone` (IANA, default America/New_York) + `lib/tz.ts`; all capacity math, cutoff hours, and day buckets use yard-local calendar keys; stored dates are canonical UTC-noon and all calendar renders use `timeZone: "UTC"`.
- **[High] Rate-limit spoofing** → login now also limited per-account (email key), so IP spoofing alone cannot brute-force a mailbox. In-memory limiter remains single-instance (documented; Upstash swap noted for scale-out).
- **[Med] Stripe webhook** → idempotent via `externalId` lookup; handles `customer.subscription.deleted` (→ CANCELED) and `invoice.payment_failed` (→ PAST_DUE); provider recorded by livemode.
- **[Med] Billing enforcement** → `yardActive()` gates storefront page, quote and order APIs (expired trial/lapsed sub → paused with friendly message + dashboard banner); mock checkout disabled in production unless `ALLOW_MOCK_BILLING=1`.
- **[Med] Email HTML injection** → `escapeHtml()` applied to all user-supplied fields in outbound email.
- **[Med] CSV formula injection** → leading `= + - @` neutralized in export.
- **[Med] Foreign truckId in scheduleOrder** → ownership check added.
- **[Med] Dev SESSION_SECRET reuse** → production refuses to boot with the committed dev marker secret.

Accepted/known (documented, not blocking launch):
- In-memory rate limiting is per-instance; adequate for the recommended single-instance launch deploy.
- Remaining Low findings (cosmetic/robustness) tracked in the findings list above; none security-relevant.
