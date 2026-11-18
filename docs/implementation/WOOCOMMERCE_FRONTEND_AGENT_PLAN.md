# WooCommerce frontend implementation record (FE-WOO-01..04)

Consumes backend contract **woo-entitlements-v1** at `b8c6752`
(`feature/woo-commerce-completion`), read read-only via
`git -C ../calmasta-api show b8c6752:...`. Implemented against that contract;
the local backend checkout predates it, so hosted acceptance stays with
SRV-WOO. No backend, migration, credential, or deployment changes were made.

## FE-WOO-01 — Client Helper Corrections — IMPLEMENTED / PASSED

- `src/lib/commerce-client.ts`: request headers merge after options so caller
  headers (Idempotency-Key) can never discard `Content-Type: application/json`;
  `checkout_url` typed `string | null`; default `returnUrl` is the relative
  `/billing/return` (absolute URLs fail closed); typed woo-entitlements-v1
  catalogue/checkout/intent/portal shapes; `newIdempotencyKey`,
  `purchaseKeyStore` (stable key per attempt, rotate for a new purchase),
  `isTrustedCheckoutUrl` (https + server-published origins only),
  `checkoutUnavailableMessage`.
- `src/lib/commerce-client.test.ts` (new): 9 tests — Content-Type survival and
  override resistance, UUID key default/passthrough, backend code propagation
  (400/409), null `checkout_url`, relative return path, origin validation,
  reason guidance.
- BFF enabler found during implementation: `commerce` was missing from the
  proxy allowlist in `src/server/auth/service.ts`, so every commerce BFF call
  404'd. Added `commerce`; covered by new
  `src/server/auth/commerce-proxy.test.ts` (allowed segments reach the session
  check with 401 unauthenticated; unknown segments still 404).

## FE-WOO-02 — Capability-Aware Purchase Flow — IMPLEMENTED / PASSED

- `src/components/billing/billing-view.tsx`: renders per-offer
  `checkoutEnabled`/`reason`; disabled "Not available" button with actionable
  guidance for disabled offers (e.g. Pro `subscriptions_unavailable`); stable
  per-sku idempotency key reused on retry, rotated after definitive 4xx;
  null `checkout_url` renders guidance, never assigned to location; redirects
  only to server-published https origins via `window.location.assign`;
  401 catalogue shows session-expired guidance.
- `src/components/billing/billing-view.test.tsx` (new): disabled
  subscription offer renders without redirect; session-expiry message mapping.
- `src/app/dashboard/(app)/billing/page.tsx` (new): publishes the billing
  flow at `/dashboard/billing`; `src/components/plan/plan-view.tsx` pack
  "Buy" links point there instead of dead checkout URLs.

## FE-WOO-03 — App Return & Polling Confirmation — IMPLEMENTED / PASSED

- `src/app/billing/return/page.tsx` (new, `/billing/return`, matches the
  backend returnUrl allowlist): reads only the opaque `intent` pointer;
  sibling query params (e.g. `?status=success`) are never consulted.
- `src/components/billing/checkout-status-view.tsx` (new): `waitForActivation`
  polls authenticated `GET /commerce/checkout/:id` every 3s for at most 60s
  (pauses nothing, cancels on unmount/terminal); `pending` shows a spinner,
  `active` re-fetches `/plan` then routes to `/dashboard/plan?purchase=success`,
  `blocked`/`failed` show support guidance, 401 links to login preserving the
  return, 404/expired show not-found/expiry guidance, timeout offers manual
  refresh with no repurchase.
- `src/components/billing/checkout-status-view.test.tsx` (new): UUID pointer
  validation, pending→active polling, terminal blocked/failed, 401/404/expired
  mapping, 60s timeout, all panel states.
- `src/app/dashboard/(app)/plan/page.tsx`: `?purchase=success` success banner.

## FE-WOO-04 — Plan and Purchased Credits Display — IMPLEMENTED / PASSED

- `src/app/api/plan/route.ts` (new): same-origin BFF proxy for `GET /plan`
  (`plan` was already in the proxy allowlist).
- `src/lib/plan-client.ts`: real `fetchPlan` with defensive `normalizePlan`
  (backend nulls stay null; no invented prices); `CreditPackView`,
  `PurchasedCreditsView`, subscription/grace/pending-cancel/cancelled/refunded
  statuses, nullable pricing/allowances; `totalRemainingMinutes` (included +
  purchased, null-propagating); `formatNullableMinutes` (unknown renders
  "—", never 0); `orZero` for arithmetic. Deletion stays `feature_unavailable`.
- `src/components/plan/plan-view.tsx`: "Total you can use" =
  includedRemainingMinutes + purchasedMinutes; "Purchased credits" card renders
  the `creditPacks` array (available/reserved/used/refunded/expires/state);
  explicit 5-day grace notice; paused-workspace notice with no deletion claim;
  pending-cancel end date; cancelled/refunded ended copy; nullable pricing and
  minute guards throughout.
- Shell/profile consumers (`account-banners.tsx`, `top-bar.tsx`,
  `profile-view.tsx`, `test-checkout-view.tsx`) handle the widened nulls;
  `top-bar.tsx:81` set-state-in-effect is pre-existing baseline, untouched.
- `src/lib/plan-client.test.ts`: deletion stays unavailable; projection
  consumption, null preservation, 401 propagation, totals, grace/paused/refund/
  pending-cancel states, pack-only Free stays Free, unavailable subscriptions
  capability.

## Proof

- `node_modules/.bin/vitest run src/lib/plan-client.test.ts src/lib/commerce-client.test.ts src/components/billing/ src/server/auth/commerce-proxy.test.ts` → 5 files, 28 tests passed.
- `pnpm exec vitest run` → 69 files, 478 tests passed.
- `node_modules/.bin/tsc --noEmit` → clean.
- `pnpm run build` → compiled successfully, 79 routes incl. `/billing/return`, `/dashboard/billing`, `/dashboard/plan`.
- `eslint … --max-warnings=0` on all touched files → clean (excl. pre-existing top-bar baseline).
- Revision: frontend `826cdcb` + working tree (uncommitted per no-commit rule); contract `b8c6752`.

## What is NOT done

- Hosted/sandbox acceptance against a deployed BE-WOO-09 backend (SRV-WOO):
  real checkout redirect, return polling against live intents, portal URL
  (still `null`), Pro subscriptions (still `subscriptions_unavailable`).
- `/billing/status` page (plan sketch) not created — only the specified
  `/billing/return` route.
- No browser automation, purchases, refunds, or deployments performed.
