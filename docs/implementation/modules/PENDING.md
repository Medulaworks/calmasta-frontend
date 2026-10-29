# PENDING consumption

Tasks: FE-X02–FE-X07. [Acceptance and authoritative statuses](../WORK_PLAN.md) · [API readiness](../API_READINESS.md) · [Backend references](../BACKEND_REFERENCE.md).

Target files: src/lib/avatar-client.ts, documents-client.ts, calendar-client.ts, booking-client.ts, plan-client.ts, notifications-client.ts; src/components/admin/

These services have UI/client expectations but no implemented backend contracts. The readiness map and backend contract-request file own the exact blockers; proxy allowlists do not change that.

## Current checkpoint

- **What was done (files + behavior):** Wired dashboard aggregate contract (B-DASH-01 / FE-X01) in `dashboard-types.ts`, `dashboard.tsx`, and `settings-view.tsx`, notifications contract (B-NOTIFY-01) in `notifications-client.ts` and `top-bar.tsx`, and avatar upload/complete/delete contract (B-AUTH-02 / FE-X02) in `avatar-client.ts`, `profile-client.ts`, `profile-view.tsx`, and `app-shell.tsx`.
- **Proof (command + result + revision):** `pnpm typecheck && pnpm test && pnpm lint` passed with new `avatar-client.test.ts`, `profile-client.test.ts`, and `store.test.ts` suites on revision e9ad534; `python3 docs/implementation/validate.py` passed with 0 errors.
- **What is NOT done:** Document generation (FE-X03), calendar (FE-X04), booking (FE-X05), staff HTTP controls (FE-X06), and commerce/deletion (FE-X07) remain blocked pending backend contracts.
- **Next action (task ID + files):** FE-C03 — configure R2 CORS and verify live private avatar and audio upload/playback.

## 2026-10-28 — unavailable commerce/deletion calls and401 diagnosis
- **What was done (files + behavior):** FE-X07 stays BLOCKED: plan-client.ts rejects unsupported plan/deletion operations locally with feature_unavailable, no speculative requests or fake state. settings-data.tsx displays unavailable deletion and no longer treats401 as deletion proof. FE-A04 investigation IN_PROGRESS: auth/service.ts logs safe missing-cookie/unavailable-session/access-token/refresh rejection reasons; plan-client.test.ts and service.test.ts cover no-request guards and diagnostic redaction.
- **Proof (command + result + revision):** Frontend base0086291/backend914c43b plus current worktrees; backend source/current37-path OpenAPI contains no plan/account-deletion contracts, matching existing backend gap rows M2 E01–E07/M9 S02. Focused frontend tests20/20, pnpm typecheck, zero-warning focused eslint and git diff --check passed; new no-request/401 diagnostic tests failed before fixes.
- **What is NOT done:** Intermittent authenticated GET /api/me401 root cause/fix remains unverified pending new reason log; plan/deletion backend scope remains unavailable and is not implemented. No auth bypass, invented deletion/sale, browser automation or live database mutation.
- **Next action (task ID + files):** FE-A04 — inspect profile_session_rejected/auth_session_rejected from auth/service.ts after manual sign-in; FE-X07 waits for canonical M2/M9 contracts.
