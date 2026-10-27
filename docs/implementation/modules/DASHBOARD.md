# DASHBOARD consumption

Tasks: FE-U01/FE-X01. [Acceptance and authoritative statuses](../WORK_PLAN.md) · [API readiness](../API_READINESS.md) · [Backend references](../BACKEND_REFERENCE.md).

Target files: src/lib/dashboard-client.ts, dashboard-types.ts, components/dashboard/, components/shell/

GET /usage/summary is ready for a dedicated quota consumer. GET /dashboard, /plan and notifications are missing; current global/dashboard calls can fail. Do not derive total counts from one library page or invent entitlements.

## Current checkpoint

- **What was done (files + behavior):** Created `src/lib/usage-client.ts` consuming `GET /api/usage/summary` for accurate quota metrics without synthesizing dashboard stats. Added `src/components/dashboard/quota-card.tsx` rendering actual used, reserved, and remaining seconds, handling paused, exhausted, loading, and retry states. Integrated `QuotaCard` into `src/components/dashboard/dashboard.tsx`. Added test suite `src/lib/usage-client.test.ts`.
- **Proof (command + result + revision):** `pnpm test && pnpm typecheck && pnpm build` passed cleanly on revision e9ad534 (160 unit tests passed, including `usage-client.test.ts`).
- **What is NOT done:** Full dashboard aggregate statistics contract B-DASH-01 remains pending backend implementation (FE-X01); dashboard totals are not synthesized from paginated library data.
- **Next action (task ID + files):** FE-X01 — await backend B-DASH-01 contract when scheduled.
