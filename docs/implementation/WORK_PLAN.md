# Frontend API-consumption work plan

Canonical frontend acceptance criteria live here. Backend acceptance remains in its own WORK_PLAN. Existing local implementation is recorded separately from new work and live verification.

| ID | Owner | Acceptance / files | Implementation | Verification |
| --- | --- | --- | --- | --- |
| FE-DOC01 | HANDOFF | Accurate architecture/readiness/auth audit, cross-repo references and usable next-agent instructions; docs only | COMPLETED | PASSED |
| FE-A01 | AUTH | Preserve existing BFF OIDC/session/proxy + GET/PATCH /api/me and welcome profession/timezone/completion mapping | IMPLEMENTED | PARTIALLY_TESTED |
| FE-A02 | AUTH | login.tsx/onboarding.tsx: correct unauthenticated/already-onboarded redirects, loading/config/network/retry states; failed bootstrap cannot complete onboarding; focused regressions | IMPLEMENTED | PASSED |
| FE-A03 | AUTH | profile-client/profile UI: nullable optional contract fields, honest avatar/password availability and welcome capture/deletion/document copy; no invented endpoints | IMPLEMENTED | PASSED |
| FE-A04 | AUTH | Real hosted signup/verified login/welcome/profile/refresh/current+all-session logout proof with HTTPS, DB grants and actual provider configuration | IN_PROGRESS | PARTIALLY_TESTED |
| FE-U01 | DASHBOARD | Add usage-client.ts consuming GET /api/usage/summary and a quota UI; actual used/reserved/remaining seconds, paused/zero/error states; do not fabricate full dashboard/paid plan stats | IMPLEMENTED | PASSED |
| FE-C01 | CAPTURE | Existing policy/consent/hash/immutable upload+completion, bounded meetings/cancel/retry, private expiring playback and shared capture detail | IMPLEMENTED | PARTIALLY_TESTED |
| FE-C02 | CAPTURE | Verify current contracts against configured API with fixtures, error/retry/disabled/expiry cases and no unsupported delete/video/docs calls; fix only observed drift | IMPLEMENTED | PASSED |
| FE-C03 | CAPTURE | Real signed-in browser R2 CORS/private playback and bounded recording/meeting proof after external gates approved | BLOCKED | NOT_TESTED |
| FE-L01 | LIBRARY | Existing authenticated pagination/search/detail/versioned transcript+speaker corrections; preserve in-flight edits and per-recording identity | IMPLEMENTED | PARTIALLY_TESTED |
| FE-L02 | LIBRARY | Focused regressions for filter/pagination cancellation, empty/error/retry, stale/multi-tab edits, audio 410 preserving transcript, missing/foreign/deleted capture | IMPLEMENTED | PASSED |
| FE-X01 | PENDING | Full dashboard aggregate API contract B-DASH-01 and real consumer | BLOCKED | NOT_TESTED |
| FE-X02 | PENDING | Avatar contract B-AUTH-02 + explicit BFF handlers before enabling upload/delete | BLOCKED | NOT_TESTED |
| FE-X03 | PENDING | Document generation/edit/regeneration/version/export consumption after M6 API and guards exist | BLOCKED | NOT_TESTED |
| FE-X04 | PENDING | Real Google/Microsoft calendar connect/agenda/disconnect after M7 contracts; no dev/Nylas substitution | BLOCKED | NOT_TESTED |
| FE-X05 | PENDING | Host and guest booking/slots/manage/ICS after M7 APIs and safe public routing | BLOCKED | NOT_TESTED |
| FE-X06 | PENDING | Notifications and staff HTTP controls after backend contracts/authorization, not operator CLI exposure | BLOCKED | NOT_TESTED |
| FE-X07 | PENDING | Paid plan/checkout/credits after M2 approval; account/capture deletion after S02 tombstone contract | BLOCKED | NOT_TESTED |

## Execution order

FE-A02 → FE-A03 → FE-U01 → FE-C02 → FE-L02. Existing FE-A01/FE-C01/FE-L01 are already wired: inspect and verify them, do not rebuild them. FE-A04/FE-C03 wait for actual external configuration and explicit live authorization. FE-X tasks wait for backend source/OpenAPI/checks, not promises or page mockups.

## Validation

Use targeted Vitest tests for changed logic, pnpm typecheck and targeted eslint; run pnpm build for route/production integration changes. Authentication persistence tests verify the BFF session store against local HTTP fixtures without connecting directly to a database. Respect the no-browser rule unless the user explicitly requests browser verification. Historical tests do not prove later revisions.
