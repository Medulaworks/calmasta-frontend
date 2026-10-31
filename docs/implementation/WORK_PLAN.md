# Frontend API-consumption work plan

Canonical frontend acceptance criteria live here. Backend acceptance remains in its own WORK_PLAN. Existing local implementation is recorded separately from new work and live verification.

| ID | Owner | Acceptance / files | Implementation | Verification |
| --- | --- | --- | --- | --- |
| FE-DOC01 | HANDOFF | Accurate architecture/readiness/auth audit, cross-repo references and usable next-agent instructions; docs only | COMPLETED | PASSED |
| FE-R01 | AUTH | All authenticated workspace/staff/onboarding pages under /dashboard; navigation/auth destinations canonical; old page URLs redirect; public/auth API routes preserved | IMPLEMENTED | PARTIALLY_TESTED |
| FE-R02 | AUTH | Auth pages under /auth (login, reset/verify/change password); direct legacy redirects, canonical email/auth destinations and safe returnTo without login loops | IMPLEMENTED | PARTIALLY_TESTED |
| FE-A01 | AUTH | Preserve existing BFF OIDC/session/proxy + GET/PATCH /api/me and welcome profession/timezone/completion mapping | IMPLEMENTED | PARTIALLY_TESTED |
| FE-A02 | AUTH | login.tsx/onboarding.tsx: correct redirects/bootstrap; verification/recovery codes through bounded BFF with legacy links preserved; focused fixture regressions | IMPLEMENTED | PASSED |
| FE-A03 | AUTH | profile-client/profile UI: nullable optional contract fields, honest avatar/password availability and welcome capture/deletion/document copy; no invented endpoints | IMPLEMENTED | PASSED |
| FE-A04 | AUTH | Real hosted signup/verified login/welcome/profile/refresh/current+all-session logout proof with HTTPS, DB grants and actual provider configuration | IN_PROGRESS | PARTIALLY_TESTED |
| FE-A05 | AUTH | Persist validated mode/theme in backend user profile; hydrate across devices, immediate preview, save errors/rollback and independent field updates; preserve browser first-paint cache | IMPLEMENTED | PARTIALLY_TESTED |
| FE-U01 | DASHBOARD | Add usage-client.ts consuming GET /api/usage/summary and a quota UI; actual used/reserved/remaining seconds, paused/zero/error states; do not fabricate full dashboard/paid plan stats | IMPLEMENTED | PASSED |
| FE-C01 | CAPTURE | Existing policy/consent/hash/immutable upload+completion, bounded meetings/cancel/retry, private expiring playback and shared capture detail | IMPLEMENTED | PARTIALLY_TESTED |
| FE-C02 | CAPTURE | Verify current contracts against configured API with fixtures, error/retry/disabled/expiry cases and no unsupported delete/video/docs calls; fix only observed drift | IMPLEMENTED | PASSED |
| FE-C03 | CAPTURE | Real signed-in browser R2 CORS/private playback and bounded recording/meeting proof after external gates approved | BLOCKED | NOT_TESTED |
| FE-L01 | LIBRARY | Existing authenticated pagination/search/detail/versioned transcript+speaker corrections; preserve in-flight edits and per-recording identity | IMPLEMENTED | PARTIALLY_TESTED |
| FE-L02 | LIBRARY | Focused regressions for filter/pagination cancellation, empty/error/retry, stale/multi-tab edits, audio 410 preserving transcript, missing/foreign/deleted capture | IMPLEMENTED | PASSED |
| FE-X01 | PENDING | Full dashboard aggregate API contract B-DASH-01 and real consumer | IMPLEMENTED | PASSED |
| FE-X02 | PENDING | Avatar contract B-AUTH-02 + explicit BFF handlers before enabling upload/delete | IMPLEMENTED | PASSED |
| FE-X03 | PENDING | Document generation/edit/regeneration/version/export consumption after M6 API and guards exist | BLOCKED | NOT_TESTED |
| FE-X04 | PENDING | Real Google/Microsoft calendar connect/agenda/disconnect after M7 contracts; no dev/Nylas substitution | BLOCKED | NOT_TESTED |
| FE-X05 | PENDING | Host and guest booking/slots/manage/ICS after M7 APIs and safe public routing | BLOCKED | NOT_TESTED |
| FE-X06 | PENDING | Notifications and staff HTTP controls after backend contracts/authorization, not operator CLI exposure | BLOCKED | NOT_TESTED |
| FE-X07 | PENDING | Paid plan/checkout/credits after M2 approval; account/capture deletion after S02 tombstone contract | BLOCKED | NOT_TESTED |

## Execution order

FE-A02 → FE-A03 → FE-U01 → FE-C02 → FE-L02. Existing FE-A01/FE-C01/FE-L01 are already wired: inspect and verify them, do not rebuild them. FE-A04/FE-C03 wait for actual external configuration and explicit live authorization. FE-X tasks wait for backend source/OpenAPI/checks, not promises or page mockups.

## Validation

Use targeted Vitest tests for changed logic, pnpm typecheck and targeted eslint; run pnpm build for route/production integration changes. Authentication persistence tests verify the BFF session store against local HTTP fixtures without connecting directly to a database. Respect the no-browser rule unless the user explicitly requests browser verification. Historical tests do not prove later revisions.

Internal authentication supersedes hosted-provider setup for FE-A01–FE-A04. Local implementation/checks are recorded in AUTH.md; real deployment proof remains pending under FE-A04. Backend plan/progress are the current environment/migration references.

## 2026-10-28 — registration diagnostic support

- **What was done (files + behavior):** FE-A04 remains IN_PROGRESS/PARTIALLY_TESTED. Authorized backend src/common/errors.ts now logs sanitized server failures; backend test/errors.test.cjs verifies redaction/correlation. Frontend runtime preserved.
- **Proof (command + result + revision):** Backend feature worktree: pnpm run build && node --test test/errors.test.cjs && git diff --check passed (3/3). Synthetic exception checks only; no real registration/provider/database verification.
- **What is NOT done:** Registration 500 root cause remains unverified pending a retried request and sanitized backend diagnostic; no migrations or browser automation.
- **Next action (task ID + files):** FE-A04/A03 — inspect api_request_failed from ../calmasta-api/src/common/errors.ts and repair only the evidenced failure.

## 2026-10-28 — endpoint context in server error logs
- **What was done (files + behavior):** FE-A04 diagnostic support IMPLEMENTED in src/server/auth/runtime.ts + runtime.test.ts: server-failure logs include HTTP method and endpoint template; query strings, parameter values, request bodies and raw exceptions excluded. Frontend awaits handler responses to log upstream 5xx and catch rejected handlers.
- **Proof (command + result + revision):** Base 0086291 plus existing working changes; pnpm exec vitest run src/server/auth/runtime.test.ts passed (4/4); pnpm typecheck, targeted eslint and git diff --check passed. Regression failures observed before fixes; synthetic diagnostic checks PASSED.
- **What is NOT done:** Live registration root cause/acceptance remains unverified; broader auth status stays partially tested. No database/provider calls, migrations, browser automation, commits/push/deploy.
- **Next action (task ID + files):** FE-A04/AUTH-LIVE — inspect the method/endpoint and backend diagnosticCode on the next registration failure, then repair only its evidenced cause.

## 2026-10-28 — internal login navigation
- **What was done (files + behavior):** FE-A02 navigation refinement IMPLEMENTED in src/components/login.tsx: authenticated bootstrap and email/password success use Next router.replace; Google retains the external redirect with connecting feedback, duplicate-click prevention and back-navigation state reset. Sign-in/signup mode switching remains local state.
- **Proof (command + result + revision):** Frontend base0086291 plus existing worktree; pnpm typecheck and targeted eslint passed (zero errors, existing Google img warning); git diff --check passed. Navigation source/type checks only, verification PARTIALLY_TESTED for this refinement.
- **What is NOT done:** Browser/client-transition and real Google acceptance unverified; no backend/auth contract changes, live account/provider calls, commits/push/deploy or browser automation.
- **Next action (task ID + files):** FE-A04 — manually verify sign-in/signup navigation and real Google roundtrip after external configuration; registration failure investigation remains open.

## 2026-10-28 — Google connecting spinner
- **What was done (files + behavior):** FE-A02 UI refinement IMPLEMENTED in src/components/login.tsx: Google connecting state uses an aria-hidden animated LoaderCircle with connecting text and no ellipsis; existing busy/disabled behavior preserved.
- **Proof (command + result + revision):** Frontend base0086291 plus existing worktree; targeted eslint passed with existing img warning, git diff --check passed. Static verification only.
- **What is NOT done:** Browser/real Google acceptance unverified; no provider calls or auth contract changes.
- **Next action (task ID + files):** FE-A04 — verify configured Google roundtrip manually; registration diagnostics remain available.

## 2026-10-28 — Google icon lint fix
- **What was done (files + behavior):** FE-A02 icon refinement IMPLEMENTED in src/components/login.tsx: replaced Google img with next/image Image at 18×18.
- **Proof (command + result + revision):** Base0086291 plus current worktree; targeted eslint --max-warnings=0, pnpm typecheck and git diff --check passed.
- **What is NOT done:** Browser/real provider checks; broader auth verification unchanged.
- **Next action (task ID + files):** FE-A04 — continue pending registration/provider acceptance.

## 2026-10-28 — authorized application auth migration
- **What was done (files + behavior):** FE-A04: user explicitly authorized applying existing backend migrations009/010 to configured application database. scripts/migrate.ts applied both transactionally; no migration/runtime source changes. Missing authentication schema dependency resolved.
- **Proof (command + result + revision):** Backend base914c43b plus working changes; read-only preflight verified all prior checksums, exactly009/010 pending and zero normalized-email duplicate groups. pnpm run build && pnpm run migrate exited0 (Migrations applied). Read-only postcheck verified both migration records, five auth tables with SELECT/INSERT access, password/lease columns (3), and zero users missing legacy identity mappings.
- **What is NOT done:** Real registration/Google/SMTP/HTTPS/proxy/browser acceptance, independent backup verification and broader deployment validation; broader auth remains IN_PROGRESS/PARTIALLY_TESTED. Separate unknown error not reproduced. No application test accounts, paid jobs, commits/push/deploy or browser automation.
- **Next action (task ID + files):** FE-A04/AUTH-LIVE — retry registration/Google manually and inspect endpoint-tagged diagnostics if any failure remains; no further schema changes needed for009/010.

## 2026-10-28 — Google callback rejection diagnosis and clean error URLs
- **What was done (files + behavior):** FE-A04 diagnostic/error-presentation support IMPLEMENTED: frontend auth/flash.ts + GET /api/auth/error and login.tsx use short-lived HttpOnly error cookie, consume/clear it and redirect failures to clean /login; callback logs safe stage/status/backend code/correlation. Backend auth.service.ts logs allowlisted provider rejection stage/codes without raw errors/claims/tokens.
- **Proof (command + result + revision):** Backend914c43b/frontend0086291 plus existing worktrees; frontend 18/18 targeted auth tests, typecheck and zero-warning focused eslint passed; webpack production build compiled47 routes (Turbopack blocked by internal-port EPERM even after escalation). Backend build and5/5 fixture diagnostic tests passed; both diff checks passed. User retry proves frontend code_exchange reaches backend and receives401 invalid_google_identity, no session established.
- **What is NOT done:** Real Google acceptance/root-cause fix remains unverified pending new backend google_identity_rejected diagnostic. No signature/state/nonce/PKCE checks weakened, no database mutation or live automated provider/account calls, commits/push/deploy/browser automation. Broader auth verification remains PARTIALLY_TESTED.
- **Next action (task ID + files):** FE-A04/AUTH-LIVE — inspect backend auth.service.ts google_identity_rejected on manual retry, fix only its evidenced provider/validation issue, then verify Google session creation.

## 2026-10-28 — Google issuer response preservation
- **What was done (files + behavior):** FE-A04 callback fix IMPLEMENTED: frontend src/server/auth/service.ts preserves single iss parameter through backend exchange and rejects duplicates; backend auth.dto.ts accepts bounded optional iss and auth.service.ts reconstructs the actual issuer response for library validation. OpenAPI regenerated. Existing clean-login error-cookie flow/security checks preserved.
- **Proof (command + result + revision):** Backend914c43b/frontend0086291 plus worktrees; current Google discovery advertises authorization_response_iss_parameter_supported=true. Installed oauth4webapi rejects omitted iss with OAUTH_INVALID_RESPONSE. Frontend regression failed on dropped iss; backend signed local fixture failed before DTO/fix and now rejects absent/wrong issuers and accepts correct issuer. Backend build,6/6 targeted tests and valid37-path OpenAPI passed; frontend19/19 targeted tests, typecheck and zero-warning focused eslint passed; both diff checks passed.
- **What is NOT done:** Fresh real Google roundtrip/session acceptance remains unverified; intermittent GET /auth/google/url unknown diagnostic not reproduced. No real provider tokens/accounts used by automated checks, database changes, commits/push/deploy/browser automation. Broader auth remains PARTIALLY_TESTED.
- **Next action (task ID + files):** FE-A04/AUTH-LIVE — begin a fresh manual Google sign-in and confirm session/profile routing; inspect sanitized callback diagnostics only if it still fails.

## 2026-10-28 — welcome PATCH503 diagnosis
- **What was done (files + behavior):** FE-A04/FE-A02 investigation IN_PROGRESS: confirmed welcome payload role=consultant is valid and mapped to profession. src/server/auth/service.ts now logs safe profile_request_failed stages, transport codes, known lease failures and bounded upstream store status without request content/raw errors; service.test.ts covers redaction/session-stage failure. User reports real Google sign-in now works following issuer fix.
- **Proof (command + result + revision):** Frontend base0086291 plus current worktree; targeted service fixture tests14/14, pnpm typecheck, focused eslint --max-warnings=0 and git diff --check passed. New diagnostic regression failed before implementation. Earlier profile-client4/4 tests passed; source contract supports profession update.
- **What is NOT done:** Welcome PATCH503 root cause/fix and real onboarding completion unverified pending manual retry diagnostic; Google success is user-reported, broader auth remains PARTIALLY_TESTED. No database/provider calls or browser automation by agent.
- **Next action (task ID + files):** FE-A04 — inspect profile_request_failed from src/server/auth/service.ts plus matching backend errors; repair only the evidenced session/transport/profile failure.

## 2026-10-28 — intermittent welcome session-store recovery
- **What was done (files + behavior):** FE-A04 recovery support IMPLEMENTED: backend database/connection-errors.ts classifies fixed driver timeout/connection diagnostics, Database.withConnection retries acquisition once before SQL, BffSessionController sessions/get uses that connection for lease lookup and releases/discards clients correctly; SafeExceptionFilter logs classified safe diagnostics. Frontend profile failure-stage diagnostics preserved.
- **Proof (command + result + revision):** Backend914c43b/frontend0086291 plus worktrees; user reports initial PATCH503 then PATCH200 and backend500 at POST /internal/auth/sessions/get (before profile update). Five-second duration matches configured acquisition timeout; original unknown exception is not proven. Backend recovery/diagnostic regressions failed before fix; build +9/9 targeted checks and PG_BIN=/opt/homebrew/opt/postgresql@18/bin pnpm run test:isolated passed125/125, valid37-path OpenAPI, temporary DB removed. Frontend14/14 service checks/typecheck/focused lint passed; both diff checks passed.
- **What is NOT done:** Actual historic exception classification and live recovery/onboarding completion remain unverified; broader auth stays PARTIALLY_TESTED. No live database changes, SQL retry, lease/identity bypass, real provider/account automation, commits/push/deploy or browser automation.
- **Next action (task ID + files):** FE-A04/AUTH-LIVE — retry welcome save manually; inspect classified backend/session diagnostics on recurrence and finish real onboarding acceptance.

## 2026-10-28 — unavailable commerce/deletion calls and401 diagnosis
- **What was done (files + behavior):** FE-X07 stays BLOCKED: plan-client.ts rejects unsupported plan/deletion operations locally with feature_unavailable, no speculative requests or fake state. settings-data.tsx displays unavailable deletion and no longer treats401 as deletion proof. FE-A04 investigation IN_PROGRESS: auth/service.ts logs safe missing-cookie/unavailable-session/access-token/refresh rejection reasons; plan-client.test.ts and service.test.ts cover no-request guards and diagnostic redaction.
- **Proof (command + result + revision):** Frontend base0086291/backend914c43b plus current worktrees; backend source/current37-path OpenAPI contains no plan/account-deletion contracts, matching existing backend gap rows M2 E01–E07/M9 S02. Focused frontend tests20/20, pnpm typecheck, zero-warning focused eslint and git diff --check passed; new no-request/401 diagnostic tests failed before fixes.
- **What is NOT done:** Intermittent authenticated GET /api/me401 root cause/fix remains unverified pending new reason log; plan/deletion backend scope remains unavailable and is not implemented. No auth bypass, invented deletion/sale, browser automation or live database mutation.
- **Next action (task ID + files):** FE-A04 — inspect profile_session_rejected/auth_session_rejected from auth/service.ts after manual sign-in; FE-X07 waits for canonical M2/M9 contracts.

## 2026-10-28 — disable all-device sign-out controls
- **What was done (files + behavior):** FE-A04 requested UI restriction IMPLEMENTED in profile/profile-view.tsx and shell/top-bar.tsx: all-device sign-out buttons are natively disabled with unavailable tooltip; profile confirmation trigger removed and copy updated. Current-device sign-out preserved; backend logout contract unchanged.
- **Proof (command + result + revision):** Frontend base0086291 plus current worktree; focused eslint --max-warnings=0, pnpm typecheck and git diff --check passed. Static UI checks only.
- **What is NOT done:** Browser verification; intermittent authenticated401 investigation remains unresolved.
- **Next action (task ID + files):** FE-A04 — inspect safe session rejection diagnostics on recurrence; re-enable all-device controls only when requested.

## 2026-10-28 — account-backed mode and theme preferences
- **What was done (files + behavior):** FE-A05 appearance persistence IMPLEMENTED: backend migration011 adds constrained user_profiles theme/mode; profile DTO/service/OpenAPI and frontend profile BFF/client accept independent fields. theme/appearance-provider.tsx + theme-picker.tsx hydrate server preferences, preview immediately, serialize saves and restore prior choice/show errors on failure; AppShell/welcome integrate hydration and settings copy reflects account storage. Browser storage remains first-paint cache.
- **Proof (command + result + revision):** Backend914c43b/frontend0086291 plus existing worktrees; initial regressions failed, then35 frontend tests/typecheck/zero-warning focused lint/webpack build passed. Focused disposable backend auth tests22/22 and valid41-path OpenAPI passed, including per-user persistence, defaults, invalid/null rejection, auth and independent-field updates. Full suite131/132: unrelated concurrent route-list test OpenAPI groups implemented operations by module/audience and retains business routes failed due added plan/calendar/deletion routes. Explicit user DB persistence authorization: prior migration checksums matched, only011 pending; migrator applied011 and read-only catalog check verified both non-null columns/defaults.
- **What is NOT done:** Manual browser/cross-device/failed-save interaction acceptance and unrelated OpenAPI expected-route repair; broader auth stays partially tested. No other migrations, production test-account writes, paid processing, provider calls, commits/push/deploy or browser automation.
- **Next action (task ID + files):** FE-A05/AUTH-LIVE — manually change mode/theme in menu/settings, reload/sign in on another device, verify saved choice and error rollback; coordinate unrelated route-list test with active backend endpoint work.

## 2026-10-28 — authenticated dashboard URL namespace
- **What was done (files + behavior):** FE-R01 IMPLEMENTED: authenticated page files moved to src/app/dashboard/, workspace shell retained in dashboard/(app), admin/welcome/change-password keep separate layouts. Updated navigation, search/capture/library/profile/plan links and auth destinations; app-routes.ts canonicalizes legacy backend links/returnTo and next.config.ts redirects12 legacy page families. Home nav uses exact matching. Public login/recovery/verification/booking and API paths preserved.
- **Proof (command + result + revision):** Frontend base0086291 plus existing worktree; initial route/returnTo regressions failed, then pnpm test passed189/189 across26 files, webpack production build passed47 routes showing authenticated /dashboard paths, pnpm typecheck and focused zero-warning eslint passed. Build routes-manifest verifies12 legacy families with307 redirects; git diff --check passed. Stale generated route types were refreshed by build.
- **What is NOT done:** Browser navigation/authentication roundtrip verification; broader live auth checks remain partial. No backend runtime/schema changes, provider calls, commits/push/deploy or browser automation.
- **Next action (task ID + files):** FE-R01/FE-A04 — manually navigate /dashboard/voice, library detail/admin/welcome and a legacy deep link; verify sign-in returnTo routing if desired.

## 2026-10-28 — authentication page URL namespace
- **What was done (files + behavior):** FE-R02 auth namespace IMPLEMENTED: frontend auth/login, auth/reset-password, auth/verify-email and auth/change-password replace old page locations. next.config.ts redirects old root auth pages and prior dashboard/change-password directly; links, login/logout/session-error destinations, flash cookie redirect and safe returnTo updated. Backend email.service.ts generates canonical /auth verification/recovery links. Google callback/API paths unchanged; welcome remains /dashboard/welcome. Active frontend README/architecture refreshed.
- **Proof (command + result + revision):** Backend914c43b/frontend0086291 plus worktrees; initial page/redirect/email regressions failed. Frontend pnpm test191/191 across27 files, production webpack build47 routes, pnpm typecheck and zero-warning focused lint passed; build manifest verifies four legacy auth redirects plus prior dashboard password-change path. Backend build and8/8 fixture tests passed, including canonical email links with preserved synthetic tokens; both diff checks passed.
- **What is NOT done:** Real browser/signup/Google/email click-through acceptance, no real mail/provider/account/database calls. Broad auth acceptance remains partial; no commits/push/deploy/browser automation.
- **Next action (task ID + files):** FE-R02/AUTH-LIVE — manually verify /auth/login, signup/recovery modes and old verification/recovery links; all provider callback settings continue using /api/auth/callback.

## 2026-10-28 — forgot-password SMTP TLS correction
- **What was done (files + behavior):** FE-A04 SMTP configuration correction IMPLEMENTED: backend ignored .env SMTP_SECURE changed false→true for existing port465; .env.example explains465 implicit TLS versus587 STARTTLS. Frontend login.tsx distinguishes temporary503 delivery failure and429 throttling from invalid requests. No credentials or SMTP host/recipient/token values printed.
- **Proof (command + result + revision):** Backend914c43b/frontend0086291 plus worktrees; user backend log confirms email_unavailable at POST /auth/forgot-password. No-mail SMTP verification: prior secure=false timed out, secure=true authenticated successfully; after env edit configured transport verified with normal10s/10s/15s timeouts (a shorter5s probe failed). Frontend focused eslint --max-warnings=0/typecheck and both diff checks passed.
- **What is NOT done:** Real recovery-email delivery/reset click-through acceptance; verification sent no mail and performed no database/account mutations. No commits/push/deploy/browser automation; broad auth verification remains partial.
- **Next action (task ID + files):** FE-A04/AUTH-LIVE — retry forgot-password manually after dev watcher reload; verify delivery and /auth/reset-password single-use flow.

## 2026-10-28 — recovery form success and back navigation
- **What was done (files + behavior):** FE-A02 recovery UI refinement IMPLEMENTED in src/components/login.tsx: reset-password mode hides Google/account-switch sections, adds labeled back arrow returning to prior sign-in view, disables email during request/after success and changes successful submit action to Return. Returning clears success/error/password state; successful form cannot resubmit recovery mail.
- **Proof (command + result + revision):** Frontend base0086291 plus existing worktree; pnpm exec eslint src/components/login.tsx --max-warnings=0, pnpm typecheck and git diff --check passed. Static UI/state checks only.
- **What is NOT done:** Browser/recovery-email delivery acceptance; no API/backend/database changes, live emails, commits/push/deploy or browser automation.
- **Next action (task ID + files):** FE-A02/FE-A04 — manually confirm forgot-password view, successful disabled email + Return action and back-arrow navigation when testing recovery delivery.

## 2026-10-29 — password visibility toggle
- **What was done (files + behavior):** FE-A02 UI refinement IMPLEMENTED in src/components/login.tsx: password eye/eye-off button toggles masking in sign-in/signup, uses accessible labels/pressed state and resets masking on mode changes; button never submits form.
- **Proof (command + result + revision):** Frontend base0086291 plus current worktree; focused eslint --max-warnings=0, pnpm typecheck and git diff --check passed.
- **What is NOT done:** Browser verification; no authentication/API/backend changes or live provider calls.
- **Next action (task ID + files):** FE-A02 — manually check password toggle when testing sign-in/signup.

## 2026-10-29 — recovery success hides email field
- **What was done (files + behavior):** FE-A02 UI refinement IMPLEMENTED in src/components/login.tsx: successful forgot-password view hides email label/input while retaining success message and Return action.
- **Proof (command + result + revision):** Frontend base0086291 plus current worktree; focused eslint --max-warnings=0 and git diff --check passed.
- **What is NOT done:** Browser verification; no backend/API changes.
- **Next action (task ID + files):** FE-A02 — manually confirm recovery success view during acceptance.

## 2026-10-29 — shared login and verification layout
- **What was done (files + behavior):** FE-A02 UI refinement IMPLEMENTED: extracted existing split-screen branding/content panel into src/components/auth-layout.tsx, reused by login.tsx and auth-account-action.tsx verification mode. Verification heading/messages/buttons/navigation use login visual conventions; reset/change-password presentation and verification API/token behavior preserved.
- **Proof (command + result + revision):** Frontend base0086291 plus current worktree; focused eslint --max-warnings=0, pnpm typecheck and git diff --check passed. Static UI/component verification only.
- **What is NOT done:** Browser/real email verification acceptance; no API/backend changes, provider calls, commits/push/deploy or browser automation.
- **Next action (task ID + files):** FE-A02/FE-A04 — manually verify /auth/verify-email responsive layout and email action flow during acceptance.

## 2026-10-29 — automatic email verification
- **What was done (files + behavior):** FE-A02 automatic verification IMPLEMENTED in auth-account-action.tsx + lib/email-verification.ts: valid email-link token submits to existing POST /api/auth/verify-email on mount, loading spinner/success/error feedback shown, manual Verify button removed. Missing/expired links retain resend option. Component-scoped request sharing prevents duplicate single-use token submissions during Strict Mode; existing URL token removal preserved. Password forms remain manual.
- **Proof (command + result + revision):** Frontend base0086291 plus current worktree; new verifier tests3/3 passed (request sharing, missing/new tokens, expiry/network redaction), focused eslint --max-warnings=0, pnpm typecheck and git diff --check passed. No real token/provider/mail calls.
- **What is NOT done:** Browser/real email-link acceptance; no backend/API contract changes, database mutation, commits/push/deploy or browser automation.
- **Next action (task ID + files):** FE-A02/FE-A04 — manually open a verification email and confirm automatic success + Continue; check missing/expired-link resend state.

## 2026-10-29 — verification resend countdown
- **What was done (files + behavior):** FE-A02 UI refinement IMPLEMENTED in auth-account-action.tsx: successful verification-email resend hides its button and shows a60-second countdown; button returns at zero. Deadline-based timer handles delayed/background ticks, guards early resends and cleans up on unmount; failed requests do not start cooldown.
- **Proof (command + result + revision):** Frontend base0086291 plus current worktree; focused eslint --max-warnings=0, pnpm typecheck and git diff --check passed. Static UI/timer checks only.
- **What is NOT done:** Browser timer/real email delivery acceptance; cooldown is frontend UX, existing backend rate limits preserved. No API/backend changes or live requests.
- **Next action (task ID + files):** FE-A02/FE-A04 — manually request verification email and confirm1:00 countdown then resend button return.
## 2026-10-29 — top menu sign-out loading feedback
- **What was done (files + behavior):** FE-A04 UI refinement IMPLEMENTED in `src/components/shell/top-bar.tsx`: pending sign-out has spinner, disabled action and visible error on failure.
- **Proof (command + result + revision):** `pnpm exec eslint src/components/shell/top-bar.tsx --max-warnings=0 && pnpm typecheck && git diff --check` passed; no live logout request.
- **What is NOT done:** Browser interaction check; no auth API changes.
- **Next action (task ID + files):** FE-A04 — manually verify pending and retry states in `src/components/shell/top-bar.tsx`.

## 2026-10-29 — disabled Microsoft sign-in option

- **What was done (files + behavior):** FE-A02 UI refinement IMPLEMENTED in src/components/login.tsx: added Continue with Microsoft below Google on sign-in/signup, using existing secondary button styling and a Microsoft mark; native disabled button has no handler or provider route.
- **Proof (command + result + revision):** dded46a working tree: pnpm exec eslint src/components/login.tsx, pnpm typecheck and git diff --check passed. Verification PARTIALLY_TESTED for this UI refinement (static checks).
- **What is NOT done:** Microsoft authentication integration and browser/visual verification; no provider calls, deployment or browser automation.
- **Next action (task ID + files):** FE-A02 — manually inspect src/components/login.tsx on /auth/login when browser verification is authorized; Microsoft remains disabled.

## 2026-10-29 — meeting list polling

- **What was done (files + behavior):** FE-C02 refinement IMPLEMENTED in src/components/capture-form.tsx and src/lib/meeting-poller.ts: sequential 15-second polling only while active, hidden-tab pause, 30/60/120-second failure backoff, immediate action refresh, terminal-state stop and unmount cancellation via src/lib/upload-client.ts. List errors remain separate from mutation errors.
- **Proof (command + result + revision):** dded46a working tree: pnpm test src/lib/meeting-poller.test.ts src/lib/capture-flow.test.ts passed 12/12; pnpm typecheck, targeted eslint and git diff --check passed. Polling refinement verification PARTIALLY_TESTED (fake timers/client checks).
- **What is NOT done:** Live browser/network and backend/provider verification; no browser automation, paid processing, commits or deployment.
- **Next action (task ID + files):** FE-C02 — manually verify capture-form.tsx request cadence, tab visibility and failure recovery when browser verification is authorized.

## 2026-10-29 — FE-C01 assistant naming refinement

- **What was done (files + behavior):** FE-C01/FE-C02: voice page CaptureForm adds optional assistant-name input using policy botName placeholder, blank-default behavior, maxLength 100, mutation forwarding and submit reset. upload-client trims/validates the override, omits blank names and includes chosen names in existing request fingerprints; useRequestMeeting forwards it. Meeting title remains separate; shared same-origin auth/proxy and consent/video guards retained. Voice page removes hardcoded assistant branding from its description.
- **Proof (command + result + revision):** cb374de dirty frontend with concurrent auth edits preserved; provider/client regressions first failed, then direct node_modules/.bin/vitest run src/lib/capture-flow.test.ts passed 9/9; frontend tsc --noEmit, targeted eslint and diff checks passed. Backend df32fd0 dirty: migration018, DTO/policy/read models, persisted retry name and worker/provider dispatch verified by 40/40 focused disposable-PG tests and valid 68-path OpenAPI. No live bot/browser/provider test. pnpm auto-synchronized the pre-existing dependency tree during the first test invocation; only its unrelated lockfile edit was restored, with no requested dependency additions.
- **What is NOT done:** Hosted API/worker/frontend rollout and real custom-name meeting proof pending. No live flags, allowances, paid dispatch, browser automation, commit or deploy. Authenticated Google Meet assistants use their account name; guest custom names follow Recall bot_name.
- **Next action (task ID + files):** FE-C01/FE-C03 — deploy backend migrations through 018 and updated API/worker before the frontend; optional RECALL_BOT_NAME default, verify policy.botName and chosen name on an authorized live meeting. Acceptance: WORK_PLAN.md; backend runbook ../calmasta-api/docs/runbooks/meeting-bot-names.md (sibling repository).

## 2026-10-30 — proposed backend auth-code handoff

- **What was done (files + behavior):** Added docs/backend-auth-code-flows-handoff.md for FE-A02/FE-A04: proposed additive code delivery, legacy-link compatibility, conditional backend authentication, security requirements, implementation order and acceptance checklist. Runtime and existing task statuses unchanged.
- **Proof (command + result + revision):** Source/contract inspection at frontend 200c70e, feature 3f57939 and backend e88588d; git diff --check and handoff structure checks passed. Documentation checks only; no runtime evidence or endpoint implementation claimed.
- **What is NOT done:** Backend contracts/migrations, frontend integration, live mail/provider checks, rebrand/redesign, commits/push/deploy. Canonical backend M1/gap tracker registration remains backend implementer work.
- **Next action (task ID + files):** Backend M1 owner registers proposal in ../calmasta-api/docs/implementation/FRONTEND_CONTRACT_GAPS.md and WORK_PLAN.md, then implements/tests compatibility before FE-A02 consumers change.

## 2026-10-30 — verification and recovery code consumption

- **What was done (files + behavior):** FE-A02 code flows IMPLEMENTED: src/lib/auth-code-flow.ts + tests own pending/cooldown/errors and ephemeral reset grant; src/components/auth-code-form.tsx + email-code-verification.tsx add current-style code forms while preserving AuthAccountAction token pages. login.tsx explicitly requests code delivery for signup; new /api/auth/verify-reset-code route and server/auth service/runtime forward bounded actions, delivery and authenticated unverified sessions for code verification; ambiguous credentials rejected. Microsoft/Google, query/capture controls and branding preserved. Earlier handoff proposal is superseded by backend docs/runbooks/auth-code-flows.md for exact contracts.
- **Proof (command + result + revision):** Frontend200c70e + working changes; backend e88588d + local implementation per runbook/OpenAPI. New BFF tests reproduced 3 expected failures before implementation; final node_modules/.bin/vitest run src/lib/auth-code-flow.test.ts src/lib/email-verification.test.ts src/lib/auth-routes.test.ts src/server/auth/service.test.ts src/server/auth/service.public.test.ts src/server/auth/runtime.test.ts src/server/auth/security.test.ts src/server/auth/store.test.ts src/server/auth/flash.test.ts passed71/71 across9files. node_modules/.bin/tsc --noEmit, targeted eslint --max-warnings=0 and git diff --check passed; pnpm build passed51pages/routes. Read-only configured remote /openapi.json was reachable but did not advertise /auth/verify-reset-code. Fixture verification PASSED; hosted acceptance pending. pnpm build auto-synchronized the pre-existing dependency tree; only its unrelated lockfile edit was restored, no dependencies added.
- **What is NOT done:** Hosted code endpoint deployment/migration/grants, real mail/HTTPS/OAuth acceptance, browser checks; no backend edits, live email, migration, commit/push/deploy. No silent fallback to links. FE-A04 remains IN_PROGRESS/PARTIALLY_TESTED; local tests do not establish hosted readiness.
- **Next action (task ID + files):** FE-A04 / backend B-AUTH-03 deployment owner confirms deployed migration021/API contract and intended environment; then authorize synthetic end-to-end code/link acceptance. FE-A02 files above await that integration proof; backend runbook remains canonical.

## 2026-10-31 — recovery success return navigation

- **What was done (files + behavior):** FE-A02: src/components/auth-code-form.tsx recovery success/sign-in link invokes existing parent onBack handler instead of navigating to the already-active /auth/login URL; parent restores signin mode and clears password/error state. Verification navigation retains its existing destination.
- **Proof (command + result + revision):** Frontend200c70e plus preserved working changes; node_modules/.bin/eslint src/components/auth-code-form.tsx --max-warnings=0, node_modules/.bin/tsc --noEmit and git diff --check passed. Source/state-path inspection only; no browser verification claimed.
- **What is NOT done:** Manual browser confirmation and hosted acceptance; no backend changes, commit/push/deploy.
- **Next action (task ID + files):** FE-A02 — manually select Back to sign in after recovery success at /auth/login and confirm sign-in form appears; FE-A04 hosted acceptance remains pending.

## 2026-10-31 — remaining return-to-sign-in actions

- **What was done (files + behavior):** FE-A02: audited recovery, token reset/change-password, verification and account-deleted return actions. Added verification-sign-in-link.tsx using existing auth-client signOut to clear the current session before returning; code and link verification now avoid the login→verification redirect loop, show pending/error states and preserve sessions on failed logout. Recovery retains parent-mode reset; other page links retain distinct destinations. Added focused signOut navigation/failure tests. User reports local signup/code/setup, recovery/new-password/login, resend/incorrect/legacy links and Google/Microsoft flows all work.
- **Proof (command + result + revision):** Frontend200c70e + preserved worktree; node_modules/.bin/vitest run src/lib/auth-client.test.ts src/lib/auth-code-flow.test.ts src/lib/email-verification.test.ts src/lib/auth-routes.test.ts passed22/22 across4files; targeted eslint, TypeScript and diff check passed. User report is manual local acceptance, not agent browser proof; new verification return action still awaits manual confirmation.
- **What is NOT done:** Hosted readiness/HTTPS/provider acceptance, browser automation or new live auth requests; no backend changes, commit/push/deploy. FE-A04 remains partial.
- **Next action (task ID + files):** FE-A02 — manually select Back to sign in from code and link verification to confirm signout/signin without a redirect loop; FE-A04 hosted acceptance remains pending.

## 2026-10-31 — Microsoft sign-in request origin correction

- **What was done (files + behavior):** FE-A02: Microsoft URL request in login.tsx now uses POST and src/app/api/auth/microsoft/url/route.ts exports POST, retaining service origin checks. Browser same-origin GET lacked required Origin and was mislabeled as configuration failure. server/auth/service.ts now preserves origin-error status and upstream machine errors; transport failures use generic temporary-unavailability copy. Fixture tests cover rejected origins and same-origin POST transaction creation. User confirms local code/link/Google flows work, explicitly excluding Microsoft; that supersedes earlier blanket acceptance report.
- **Proof (command + result + revision):** Frontend200c70e dirty; regression first failed503-vs403, then focused9file auth/session run passed73/73; targeted eslint, TypeScript and git diff --check passed. next build failed due Turbopack CSS worker port-binding EPERM, including escalated retry; no successful new production-build claim. Backend env presence inspection found calendar Microsoft credential fallback present; no values printed and no live provider transaction initiated.
- **What is NOT done:** Real Microsoft login/provider callback acceptance; credential validity/redirect registration and hosted acceptance unverified. Build blocked by local worker permission. No backend/env changes, live email, browser automation, commit/push/deploy.
- **Next action (task ID + files):** FE-A04 — retry Microsoft button manually and inspect exact surfaced error if any; backend Microsoft configuration is owned by backend M1. Repeat production build when Turbopack worker binding is available.

## 2026-10-31 — authorized auth checkpoint

- **What was done (files + behavior):** FE-A02 selective auth-code implementation reviewed for local commit; user confirms all local flows including Microsoft now work. Existing handoff and prior working changes included intentionally. Rebrand/showcase excluded.
- **Proof (command + result + revision):** Frontend200c70e dirty; focused10file auth/session75tests passed, TypeScript/targeted lint/diff checks passed. Local manual acceptance user-reported; no new hosted/provider proof. Prior Turbopack build remains blocked by worker port permission.
- **What is NOT done:** Hosted deployment/acceptance and remote push; FE-A04 remains partial. User authorized local commits and selective presentation imports, not original PR merge or deployment.
- **Next action (task ID + files):** FE-C02/FE-L02 — port skeleton/status/meeting notifications from feature3f57939 onto current staging consumers in separate commits, retaining query/capture controls; keep rebrand/auth redesign separate.
