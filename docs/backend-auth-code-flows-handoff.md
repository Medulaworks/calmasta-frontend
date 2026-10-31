# Backend handoff: email codes with existing link flows preserved

Date: 2026-10-30. Status: PROPOSED / NOT IMPLEMENTED / NOT TESTED.

## Purpose and ownership

Add signup email-verification and password-recovery codes without breaking existing email links or staging authentication. This document is a requested implementation specification, not proof that the contracts exist. No backend runtime changes, migrations, mail delivery, or frontend integration are performed by this document.

Canonical backend acceptance/status remains in `../calmasta-api/docs/implementation/WORK_PLAN.md`, module `modules/M1.md`, and `FRONTEND_CONTRACT_GAPS.md`. Backend implementer must register the proposed work there under existing M1 ownership before coding. Frontend integration belongs to FE-A02; hosted acceptance remains FE-A04. This handoff does not mark either complete.

Inspected backend revision: `e88588d`; frontend baseline: staging `200c70e`; reviewed frontend proposal: `3f57939` on `feature/local-backend-connection`. Recheck current source before implementation.

Read backend AGENTS.md, implementation README/HANDOFF/WORK_PLAN/M1 and current OpenAPI first. Exact source targets:

- `src/modules/identity/auth.controller.ts`, `auth.dto.ts`, `auth.service.ts`, `auth.guard.ts`, `auth-rate.guard.ts`, `email.service.ts`.
- `src/common/errors.ts`, `src/app.ts`, database migration conventions, existing auth tests.
- `openapi/calmasta-api.json` and `scripts/openapi.ts`.

Current backend: verification accepts a 64-character lowercase hexadecimal token; reset accepts the same token format plus an 8–128-character password. `auth_action_tokens` stores action-token hashes. Registration and resend issue verification links; forgot-password issues recovery links. There is no reset-code exchange endpoint. Existing reset changes credentials, revokes sessions, verifies the email and supports password establishment for provider-only accounts; preserve those semantics and provider identities.

## Compatibility decision

Recommended design choice: add optional `delivery: "link" | "code"` to register, forgot-password and verification-resend bodies. Omission defaults to `link`. Existing clients keep their behavior; the selectively adapted code UI explicitly requests `code`. Reject unsupported delivery values.

This intentionally requires small frontend changes: the PR currently omits delivery. Do not merge it unchanged and assume it will receive codes. Do not switch the default silently or invalidate already-issued links during rollout. Existing token expiries remain unchanged; new code expiries are separate.

For a code email, include the code and a fallback link for the same challenge. Either redemption consumes both credentials. Old outstanding link-only tokens remain usable until their existing expiry, use, or existing replacement rules. A new issuance for a purpose invalidates earlier challenges for that purpose, consistently across code and link credentials, so an old code cannot bypass a resend.

## API contract

Browser calls same-origin Next `/api/auth/*`; Next forwards to backend `/auth/*` using existing server-side sessions. No browser access/refresh-token stores or direct identity-provider calls.

| Backend endpoint | Request | Authentication and result |
| --- | --- | --- |
| POST /auth/register | Existing fields plus optional delivery | Preserve current registration/session result and existing response status. Code mode issues the first verification challenge. No code returned in JSON. |
| POST /auth/forgot-password | `{ "email": "person@example.test", "delivery": "code" }` | Public; 200 `{ "ok": true }` for eligible and unknown accounts. Default/link mode remains available. |
| POST /auth/verify-reset-code (new) | `{ "email": "person@example.test", "code": "012345" }` | Public, rate limited; 200 `{ "resetToken": "<64 lowercase hex characters>" }`. No login session or JWT issued. |
| POST /auth/reset-password | `{ "token": "<64 lowercase hex characters>", "password": "<new password>" }` | Existing public endpoint; preserve current success body/status and credential/session revocation. Accept old link tokens and new exchange tokens. |
| POST /auth/verify-email | Exactly one of `{ "token": "..." }` or `{ "code": "012345" }` | Token remains public. Code requires an authenticated, possibly unverified account; 200 `{ "ok": true }` after verification. |
| POST /auth/verify-email/resend | `{ "delivery": "code" }` or existing empty body | Authenticated, unverified accounts allowed. 200 `{ "ok": true }`; default empty body sends link. Already-verified account remains an idempotent no-op. |

Normalize email with existing backend rules. Codes are strings matching `^[0-9]{6}$`; leading zeroes must survive. Tokens retain `^[a-f0-9]{64}$`. Reject both/neither verification credentials, malformed input and unsupported fields using existing validation conventions. Do not allow body email/userId to select the account for email-code verification.

### Conditional authentication is mandatory

Current verify-email is marked public. Merely adding a bearer annotation or forwarding a BFF session does not authenticate its code branch. Validate a real backend session for `{code}` through the existing auth infrastructure; permit unverified sessions only for this narrowly scoped auth action. Missing/expired/revoked session returns 401. Never trust a body user ID or decode an unverified JWT to select the account. Public token verification must continue without a session. Describe the alternatives accurately in OpenAPI, including conditional authentication; do not broaden public/proxy access.

### Error contract

Backend continues its canonical error envelope with machine-readable `code`; the Next auth service maps that to browser `error`. Document and test that mapping, rather than changing every API error shape.

| Case | HTTP | Backend code | Browser error |
| --- | --- | --- | --- |
| Wrong code, unknown reset email, or no matching challenge | 400 | invalid_code | invalid_code |
| Expired challenge for a known, validly identified challenge | 400 or 410; choose one consistently in implementation/OpenAPI | expired_code | expired_code |
| Fifth wrong attempt, exhausted challenge, or resend cooldown | 429 | too_many_attempts | too_many_attempts |
| Existing global auth rate limit | 429 | Preserve too_many_auth_attempts | Preserve mapping; UI handles HTTP 429 |
| Missing/revoked session for verification code | 401 | Existing unauthorized code | Existing mapping |
| Invalid/expired/consumed reset or link token | 400 | Preserve invalid_or_expired_token | Preserve mapping; reset UI handles HTTP 400 |
| Mail transport failure | Existing policy | Existing email_unavailable where applicable | Existing mapping |

For public reset-code exchange, prefer generic invalid_code for absent, consumed and expired records if distinguishing them would expose account/challenge existence. Expiry-specific responses are safe for authenticated verification. The UI already supports generic failure; amend the proposed PR doc to reflect this privacy choice. Never return user_not_found from public recovery. Keep mail failures indistinguishable between known and unknown accounts; current forgot-password intentionally acknowledges requests despite delivery failure. Acknowledgement copy must say "If an account exists" and must not assert confirmed delivery.

## Challenge lifecycle and security requirements

Recommended new-code rules: cryptographically random six digits; ten-minute lifetime; five failed guesses per challenge; sixty-second resend cooldown. Reset exchange grants last fifteen minutes. These are proposed defaults requiring implementation, not existing guarantees. Apply server-side limits even if UI buttons are disabled.

- Separate purposes: `email_verification` versus `password_reset`; bind challenge to account and current normalized email/email version. Never accept one purpose's code for another. Email change invalidates outstanding verification challenges and grants.
- Generate with an unbiased cryptographic integer generator; preserve zero padding. Do not return codes through HTTP, logs, metrics, fixtures containing real accounts, or committed artifacts.
- Six-digit codes have low entropy. Protect stored verifiers with a server-only keyed digest including purpose/account/challenge context, or an appropriately reviewed equivalent; a plain unsalted SHA hash is insufficient protection against offline enumeration. Keep key server-only, define rotation behavior, compare in constant time.
- Keep opaque link/reset tokens random and high entropy; use existing hashed storage patterns. New reset grant must be 32 random bytes encoded as 64 lowercase hex characters to satisfy existing DTOs.
- Issue, replace and redeem challenges transactionally. Lock account/challenge in consistent order. Parallel successful verification/exchange requests must produce at most one redemption/grant. Resends racing with guesses must not restore old credentials.
- Persist failed-attempt increments even when returning an HTTP error: throwing inside a transaction that rolls back must not reset the counter. On attempt five, exhaust challenge and invalidate its fallback link. Rate limiting persists across requests/instances/restarts.
- Successful verification consumes the code and its fallback link and marks the account email verified atomically. Repeated code use fails. Already-verified resend stays safe/idempotent.
- Successful reset-code exchange consumes that code and its fallback link and creates one reset grant atomically; it does not update password, verify email, revoke sessions or sign in yet.
- Reset-password consumes the selected grant and updates credentials/revocation atomically using existing reset behavior. Invalidate other recovery challenges/grants on success and credential changes; retain unrelated OAuth identities. Concurrent use of code/fallback/grant cannot reset credentials twice.
- Resend invalidates the previous purpose challenge, associated fallback credential and outstanding recovery grants for that issuance; it does not revoke normal login sessions. Maintain existing link replacement behavior for link-mode clients.
- Preserve existing IP/email auth limits. Add durable purpose/account cooldown and guess limits, including authenticated verify-email where no email appears in the body. Do not trust arbitrary forwarded IP headers; reuse existing authenticated BFF forwarding checks. Public cooldown responses must not reveal whether an account exists.
- Define delivery failure handling so retries are possible without resurrecting old challenges. Mail contains plaintext secrets by necessity: if queued durably, protect payloads, restrict access, redact logs and expire them. No mail send inside a transaction that can hold DB locks indefinitely.
- Audit only sanitized event type, outcome and safe correlation identifiers. Never log codes, tokens, passwords, authorization/session headers or private email content.

Backend implementer chooses the smallest schema extension compatible with existing token storage and migration conventions. Record challenge purpose, account/email binding, verifier, expiry, attempts, consumption/replacement and reset-grant association as needed. Preserve old rows; do not rewrite/deactivate all legacy tokens. Load the repository's Postgres/security guidance before designing SQL. Run migrations/tests only against disposable databases; production migration remains a separate authorized operation.

## Emails and copy

Retain current approved product branding. Jooba rebranding is a separate decision; do not copy the PR's branding change into this auth task.

Verification: subject "Your email verification code"; code as six plain-text digits in text part and readable grouped digits in HTML; explain ten-minute expiry, single use, not sharing it, and ignoring unexpected mail. Include existing verification URL as the same-challenge fallback.

Recovery: subject "Your password reset code"; same formatting and expiry; say the password has not changed and that unexpected requests may be ignored. Include existing reset URL as the same-challenge fallback. Do not send the reset exchange grant in the code-request email. Link-only mode retains current link expiry wording.

No marketing redesign or provider configuration changes required. Preserve Google/Microsoft OAuth login and linking behavior.

## Implementation order

1. Register missing contracts under backend M1 in FRONTEND_CONTRACT_GAPS and WORK_PLAN; keep implementation and verification statuses separate.
2. Add compatible schema/storage and disposable-DB tests for issuance, atomic redemption, counters, cooldowns and legacy tokens.
3. Implement services, conditional authentication, DTOs, endpoint and email changes; retain omission-default link behavior.
4. Update OpenAPI from runtime source, including request alternatives, response statuses, resetToken format and errors. Verify the intended deployed contract before enabling consumers.
5. Backend focused checks pass before any frontend code-flow integration. Stage backend independently; no production migration/deployment implied.
6. On a review branch based on staging, adapt code UI with explicit delivery mode. Preserve server-owned sessions, old token pages, password/redirect/error behavior and Microsoft sign-in. Test focused BFF/client flows against supported contracts.
7. Port skeletons, status indicators and then meeting notifications as separate patches if desired; retain TanStack Query, assistant names, video options, consent/G01 guards and cancellation controls. Rebrand/auth redesign remain separate reviews. Do not cherry-pick the bundled feature commit wholesale.

## Local curl examples (future acceptance; not run)

Use an explicitly disposable local environment and a synthetic test mailbox. These examples target the Next BFF so code verification uses the same session handling as the UI. Obtain codes from the local test-mail sink, not logs or production email. Do not paste output containing credentials into evidence.

```sh
# Local Next BFF only; confirm it points at a disposable backend/database.
AUTH_TEST_BASE=http://localhost:3006
AUTH_TEST_EMAIL=auth-code-test@example.test
# The local test sink must be configured to receive this synthetic recipient.

# New reset-code request. Existing link request is the same without delivery.
curl -sS -X POST "$AUTH_TEST_BASE/api/auth/forgot-password" \
  -H 'Content-Type: application/json' \
  --data '{"email":"auth-code-test@example.test","delivery":"code"}'

# Intentionally wrong code; expect generic invalid_code, subject to limits.
curl -sS -X POST "$AUTH_TEST_BASE/api/auth/verify-reset-code" \
  -H 'Content-Type: application/json' \
  --data '{"email":"auth-code-test@example.test","code":"000000"}'
```

For a successful exchange, use the actual local-sink code, capture resetToken privately, and POST `{token,password}` to `/api/auth/reset-password`. Do not print/save that token in shared evidence. Repeat the exchange and reset to confirm rejection. Use automated disposable-DB tests with controlled clock advance for expiry; do not wait ten minutes or consume real-provider mail.

For authenticated verification, sign in to an unverified synthetic account through the existing BFF and retain its session in a private temporary cookie jar. POST `{delivery:"code"}` to `/api/auth/verify-email/resend`, then `{code:"<sink code>"}` to `/api/auth/verify-email` using that cookie jar. Repeat without cookies (401), with the wrong account (failure), and with an existing link token without cookies (success). Keep cookie jars out of Git and remove after use. Do not invent a second password-login API for these checks.

## Acceptance checklist

- [ ] Existing requests with omitted delivery still issue usable links; outstanding pre-migration verification/reset links still work.
- [ ] Signup code mode and resend code mode send code plus valid fallback link; default mode remains unchanged.
- [ ] Exactly-one verification credential enforced; code branch requires a validated session, token branch stays public.
- [ ] Leading-zero code accepted; malformed codes/tokens rejected; purpose/account/email binding enforced.
- [ ] Wrong/unknown public recovery responses match; expiry/privacy behavior and BFF error mapping match OpenAPI.
- [ ] Fifth failed attempt persists/exhausts challenge despite error response; resend cooldown and global limits survive parallel requests and restarts.
- [ ] Concurrent redemption, replacement and fallback-link races allow at most one successful consumption; replay fails.
- [ ] New reset grant matches existing token DTO, expires after fifteen minutes, and cannot verify email or authenticate as a session token.
- [ ] Reset revokes existing credentials/sessions, consumes recovery grants and retains existing provider-linking behavior.
- [ ] Existing Google and Microsoft sign-in, refresh, logout and link recovery regressions pass.
- [ ] Mail failure/retry behavior is tested without account enumeration or secret logging.
- [ ] Backend focused tests use disposable DB/mail; generated OpenAPI matches runtime. Record actual command/results/revision, not this checklist as evidence.
- [ ] Frontend BFF tests exercise conditional authentication, origin checks and errors; current mocked success tests alone do not prove backend support.
- [ ] Staging integrations preserve TanStack Query, assistant names, video options and cancellation controls. Rebrand/redesign excluded.
- [ ] Implementation and verification statuses updated independently in canonical trackers; live/provider/deployment acceptance remains pending unless separately authorized and performed.
