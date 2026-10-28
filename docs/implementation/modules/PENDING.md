# PENDING consumption

Tasks: FE-X02–FE-X07. [Acceptance and authoritative statuses](../WORK_PLAN.md) · [API readiness](../API_READINESS.md) · [Backend references](../BACKEND_REFERENCE.md).

Target files: src/lib/avatar-client.ts, documents-client.ts, calendar-client.ts, booking-client.ts, plan-client.ts, notifications-client.ts; src/components/admin/

These services have UI/client expectations but no implemented backend contracts. The readiness map and backend contract-request file own the exact blockers; proxy allowlists do not change that.

## Current checkpoint

- **What was done (files + behavior):** Wired dashboard aggregate contract (B-DASH-01 / FE-X01) in `dashboard-types.ts`, `dashboard.tsx`, and `settings-view.tsx`, notifications contract (B-NOTIFY-01) in `notifications-client.ts` and `top-bar.tsx`, and avatar upload/complete/delete contract (B-AUTH-02 / FE-X02) in `avatar-client.ts`, `profile-client.ts`, `profile-view.tsx`, and `app-shell.tsx`.
- **Proof (command + result + revision):** `pnpm typecheck && pnpm test && pnpm lint` passed with new `avatar-client.test.ts`, `profile-client.test.ts`, and `store.test.ts` suites on revision e9ad534; `python3 docs/implementation/validate.py` passed with 0 errors.
- **What is NOT done:** Document generation (FE-X03), calendar (FE-X04), booking (FE-X05), staff HTTP controls (FE-X06), and commerce/deletion (FE-X07) remain blocked pending backend contracts.
- **Next action (task ID + files):** FE-C03 — configure R2 CORS and verify live private avatar and audio upload/playback.
