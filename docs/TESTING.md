# Testing

## Automated (`npm test`)
- `tests/zones.test.ts` — ZIP parsing/normalization, zone matching (overlap → cheapest).
- `tests/pricing.test.ts` — quantity clamping, integer-cent totals, minimum-order flag,
  inactive/unknown product handling, null-zone phone orders.
- `tests/capacity.test.ts` — daily capacity, order volume floors, lead time, cutoff-hour
  shift, capacity exclusion, canceled-order exclusion.
- `tests/orders.integration.test.ts` — full placeOrder against a scratch SQLite DB:
  totals, per-yard sequential numbering, out-of-area rejection (online) vs. allowance
  (phone), minimum enforcement, empty cart, paused ordering. Verifies confirmation +
  alert emails land in EmailLog.

30 tests. The suite creates `prisma/test.db` via `prisma db push` and removes it after.

## Manual QA script (verified 2026-07-19 in live browser session)
1. Landing page renders; demo link works.
2. Storefront: calculator (540 sq ft @ 3" ≈ 5 yds), +/- steppers, ZIP 43004 quote
   ($45 fee, $75 min), date list starts at lead time, order placement → thanks page.
3. Dashboard login (demo creds) → order appears in "Needs scheduling" with correct stats.
4. Order detail → schedule (date/slot/truck) → status SCHEDULED; customer email captured.
5. Mailbox shows confirmation, yard alert, and scheduling emails ("not sent (test)").
6. Dispatch board: day cards, capacity meters, orders under correct days.
7. Ticket page: driver-readable, print button, collect-on-delivery total.
8. Billing: plan cards, mock activation notice, cancel.

## Known dependency advisories
`npm audit`: 2 moderate, both build/dev-time only (postcss <8.5.10 transitive via Next's
pinned toolchain). No runtime exposure identified; re-check on each Next upgrade.

## Bug log (found & fixed during build)
- Redirect loop for authed users without a yard (requireYardUser refactor).
- Stale-closure on storefront quantity steppers (rapid clicks lost) — found in live E2E.
- ZIP normalization silently truncated 6+ digit strings into "valid" ZIPs.
