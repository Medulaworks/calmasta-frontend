# Admin Invitation On One Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Let an invitee create or access a verified Joobah account, accept a staff invitation, and sign into admin from `/admin/accept-invite` without leaving that page.

**Architecture:** Add a rate-limited token-scoped backend lookup that returns only invitation email, role, and expiry. Route that lookup through the same-origin BFF without a session; use the invitee's normal session for auth and acceptance, then mint the separate admin session after the role is accepted. Reuse existing account, email-code, and password recovery APIs; keep credentials, codes, and tokens in memory only.

**Tech Stack:** NestJS, PostgreSQL query through existing service, Next.js App Router, React client component, existing BFF/auth APIs.

**Spec:** `docs/superpowers/specs/2026-11-27-admin-invite-on-one-page-design.md`

## Global Constraints

- Do not create a staff role until the verified account matches a valid pending invite and accepts it.
- Never let the client choose the invited email or role; lookup binds the UI to backend data.
- Do not persist/log invitation tokens, passwords, email codes, or password-reset tokens.
- Keep invitation lookup and all auth actions same-origin and rate-limited by existing backend guards.
- No schema changes, migrations, production-data changes, commits, pushes, or deployments.
- Do not add or run tests in this task; run only compile/typecheck/preflight verification.

## Review Focus

- Malformed, expired, cancelled, replaced, accepted, or replayed invitation tokens return no invitation details and cannot grant staff role.
- Email mismatch and unverified account cannot accept, even when the page state or request body is modified.
- Registration conflict moves the invitee to sign-in or inline password recovery rather than creating a duplicate account.
- Passwordless/provider-only accounts can set a password using the existing recovery API, with the reset token kept in memory.
- Failure after successful acceptance preserves the accepted state and avoids repeating the one-time accept action.

## File Map

- Backend `src/modules/admin/admin.controller.ts`, `admin.service.ts`: add public, rate-limited invite lookup.
- Backend `src/modules/admin/admin.dto.ts`: use the existing 64-hex invite token DTO for lookup input.
- Backend OpenAPI output: regenerate/verify the lookup operation using existing repo scripts.
- Frontend `src/server/auth/service.ts`: allow only the lookup route without login; keep acceptance on the normal user session.
- Frontend `src/app/admin/accept-invite/client.tsx`: implement the one-page invitation flow and memory-only credential state.
- Frontend `src/lib/admin-client.ts`: add safe messages for lookup/account/recovery errors if missing.
- Frontend docs `docs/implementation/WORK_PLAN.md`, `HANDOFF.md`, `modules/AUTH.md`, and `JOURNAL.md`: record implementation and verification separately.

## Tasks

### Task 1: Add token-scoped invite lookup

**Files:**
- Modify backend `src/modules/admin/admin.controller.ts`
- Modify backend `src/modules/admin/admin.service.ts`
- Reuse backend `src/modules/admin/admin.dto.ts`
- Regenerate backend OpenAPI output only if required by canonical scripts

**Interface:** `POST /admin/staff/invites/lookup` accepts `{ token: string }`; for a valid pending, unexpired token it returns `{ email: string, role: string, expiresAt: string, accountExists: boolean }`. It checks only the email bound to that valid token. For every unusable token it returns the existing generic `invalid_invitation` domain error. Apply `AuthRateGuard`; mark the route public for API bearer auth while preserving DTO validation.

- [x] Confirm the lookup handler takes the existing `AdminInviteAcceptDto` and is guarded by `AuthRateGuard`.
- [x] Implement a read-only `AdminService.invitationDetails(token)` query using only `hash(token)`; never select or return `token_hash`.
- [x] Add the OpenAPI operation description and verify canonical spec generation through backend preflight.

### Task 2: Route lookup and acceptance through the right BFF sessions

**Files:**
- Modify frontend `src/server/auth/service.ts`

**Interface:** The exact `POST /admin/staff/invites/lookup` path uses unauthenticated `upstream()` transport and is still same-origin/BFF-rate-limited by backend. The exact `POST /admin/staff/invites/accept` path uses the normal session. All other `/admin/**` proxy paths continue to use the admin session.

- [x] Add exact route predicates for lookup and acceptance; do not make the whole `/admin/staff/invites/**` prefix public.
- [x] Route lookup without a session through `upstream()` so no bearer token is required.
- [x] Preserve normal-session auth for acceptance, admin-session auth for all other staff routes, and correct 401 cookie clearing.

### Task 3: Build the invite onboarding state flow on the page

**Files:**
- Modify frontend `src/app/admin/accept-invite/client.tsx`
- Modify frontend `src/lib/admin-client.ts` only for missing safe error mappings

**Interface:** The page performs these transitions: `loading_invite` → one account path selected by `accountExists` → `verify_email` (when needed) → `accepting` → `admin_sign_in`/`complete`. New accounts call `/api/auth/register` with `{ email, name, password, delivery: "code" }`; existing accounts call `/api/auth/login` with `{ email, password }`. Verification uses `/api/auth/verify-email`, resend `/api/auth/verify-email/resend` with `{ delivery: "code" }`. Existing-account recovery uses `/api/auth/forgot-password` with `{ email, delivery: "code" }`, `/api/auth/verify-reset-code` with `{ email, code }`, then `/api/auth/reset-password` with `{ token: resetToken, password }`. Acceptance calls the existing `/api/admin/staff/invites/accept`; admin session uses `/api/admin/auth/login`.

- [x] Look up invite details with the token in a JSON body; strip the token from the URL immediately and do not write it to browser storage or logs.
- [x] Show the backend-provided email as read-only and dynamically show only account creation or sign-in from `accountExists`, with no mode buttons.
- [x] Handle `email_already_registered` by offering sign-in; request email-code delivery on registration.
- [x] Keep unverified recipients on-page for verification code entry and resend; respect API cooldown/429 responses.
- [x] Add inline recovery for existing accounts without a password; keep code and reset token in component memory only.
- [x] Accept only after verification, then request the admin session using the entered password.
- [x] If acceptance succeeds but admin sign-in fails, show that the invite is accepted and let the invitee retry admin sign-in without submitting acceptance again.
- [x] Clear password/code/reset-token state after success or page exit; keep all invalid/stale invite messaging generic and safe.

### Task 4: Verify implementation and update trackers

**Files:**
- Update frontend implementation tracker files listed in the File Map

- [x] Run backend `pnpm run preflight` and record the actual result; this includes TypeScript/OpenAPI/migration-baseline checks, not the database suite.
- [x] Run frontend `npm run typecheck` and `git diff --check`.
- [x] Review changes for no token/password/code logging or persistence and no broad public `/admin` proxy access.
- [ ] Record authenticated browser acceptance as outstanding; do not claim the flow works end-to-end without that check.

## Execution Notes

- Tasks 1 and 2 define the contract and transport required by Task 3; execute in order.
- Do not send test email or create/accept an invitation during local verification.
- Automated test authoring/execution is omitted under the active session instruction; verification claims must remain limited to the compile/preflight commands above.
