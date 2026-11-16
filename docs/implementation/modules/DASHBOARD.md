# DASHBOARD consumption

## 2026-11-16 — production rollout returned and remote revisions verified

- **What was done (files + behavior):** FE-L01/FE-L02/FE-U01 scoped expired-upload projection, safe video diagnostics, renewable private playback and truthful timeline/reserved-quota copy are reported deployed in production. Recorded server return packet; implementation IMPLEMENTED for scoped fixes, failed-video recovery/billing still IN_PROGRESS. Evidence: sibling calmasta-api/docs/implementation/evidence/2026-11-16-production-recording-rollout.md.
- **Proof (command + result + revision):** Server reports backend 12c6a75/frontend 24b1133, Actions 43874149223/43874164556 SUCCESS; backend 369 tests/OpenAPI 147, frontend 401 tests/types/lint/build; production detail/usage/plan 200 and existing video Range 206. Independent git ls-remote/fetch + ancestor check confirm backend commit on main 67258a3 and frontend main 24b1133. Local checks are Git-only; real runtime results are attributed to server. No new implementation suite run.
- **What is NOT done:** No signed billing reconciliation or quota availability restoration, failed-video repair, local browser-expiry proof, or updated dev/staging deployment proof. One-time 3750-second/150000000-byte existing-video waiver has been requested, not applied. Original Smithy storage failure is separate from current duration recovery guard; no cap/ledger changes authorized by the report.
- **Next action (task ID + files):** B03/U03/G01 — owner decides bounded existing-artifact recovery; server implements scoped idempotent video-only repair if approved. Operator provisions verified signed receipts/restricted access per docs/runbooks/recall-billing.md; then verifies balances without guaranteed quota release. Track each environment independently.


## 2026-11-16 — reconciliation/deployment preparation

- **What was done (files + behavior):** FE-L02/FE-U01: prepared task-only backend/frontend patches, SHA256 manifest and release ZIP under releases/2026-11-16-recording-video-quota*; updated server prompt with deployment ownership/order. Native null handling isolates banner patch from pre-existing commerce changes. Implementation IMPLEMENTED locally; release packet prepared; deployment/reconciliation remain IN_PROGRESS.
- **Proof (command + result + revision):** edd9db8/backend and 826cdcb/frontend plus local task diffs: both patches passed git apply --check on temporary copies of recorded base files; focused banner regression 2/2/lint PASS after isolation change. Earlier backend 36/36/frontend 30/30 proof remains scoped to recorded source; no live writes. Presence-only checks found all six billing/Recall prerequisites absent here.
- **What is NOT done:** No final receipt verification/apply, live quota repair, branch publication or server deployment. /docs/ ignores new prompt/evidence files; ZIP is the transferable packet. Environment verification must precede release; billing reconciliation can run separately from code deployment.
- **Next action (task ID + files):** B03/U03/G01 — server/operator receives releases/2026-11-16-recording-video-quota.zip, verifies actual environment, applies reviewed task source and signed-receipt reconciliation via HOSTED_RECORDING_VIDEO_QUOTA_FIX_PROMPT.md, then returns sanitized deployed outcomes.


## 2026-11-16 — truthful recording states and renewable private video

- **What was done (files + behavior):** FE-L01/FE-L02/FE-U01: library-recording.tsx explains requested-only legacy history, shows latest 8 events/observed time and renews completed-video URLs with bounded read retry; meeting-video.tsx preserves seek/playing intent and distinguishes storage failure from expiry. account-banners.tsx distinguishes held allowance from used time; upload-client.ts accepts existing videoPlaybackFailure. Focused regressions added. Implementation IMPLEMENTED locally; existing unrelated edits preserved.
- **Proof (command + result + revision):** 826cdcb+task diff: focused Vitest 5 files 30/30, tsc --noEmit and changed-file eslint PASS; review regressions observed RED→GREEN, follow-up review found no blockers. Backend edd9db8+diff 36/36 disposable PG tests; read-only dev metadata and Range 206 only. [Evidence](../../../../calmasta-api/docs/implementation/evidence/2026-11-16-recording-video-quota.md). Local checks PASSED; live verification PARTIALLY_TESTED.
- **What is NOT done:** Production deployment/browser/provider diagnosis, failed-video recovery or quota settlement. Local DB contains copied prod IDs; it does not prove prod state. No cap/ledger/settings/provider writes, browser automation, paid dispatch or commit/push/deploy. Missing docs/rules.md and docs/token-management.md were observed; AGENTS and backend combined rules followed.
- **Next action (task ID + files):** FE-L02/FE-U01/B03 — server follows sibling backend HOSTED_RECORDING_VIDEO_QUOTA_FIX_PROMPT.md, deploys reviewed hunks and verifies actual per-environment existing-video/allowance outcomes; criteria WORK_PLAN.md.


Tasks: FE-U01/FE-X01. [Acceptance and authoritative statuses](../WORK_PLAN.md) · [API readiness](../API_READINESS.md) · [Backend references](../BACKEND_REFERENCE.md).

Target files: src/lib/dashboard-client.ts, dashboard-types.ts, components/dashboard/, components/shell/

GET /usage/summary is ready for a dedicated quota consumer. GET /dashboard, /plan and notifications are missing; current global/dashboard calls can fail. Do not derive total counts from one library page or invent entitlements.

## Current checkpoint

- **What was done (files + behavior):** Created `src/lib/usage-client.ts` consuming `GET /api/usage/summary` for accurate quota metrics without synthesizing dashboard stats. Added `src/components/dashboard/quota-card.tsx` rendering actual used, reserved, and remaining seconds, handling paused, exhausted, loading, and retry states. Integrated `QuotaCard` into `src/components/dashboard/dashboard.tsx`. Added test suite `src/lib/usage-client.test.ts`.
- **Proof (command + result + revision):** `pnpm test && pnpm typecheck && pnpm build` passed cleanly on revision e9ad534 (160 unit tests passed, including `usage-client.test.ts`).
- **What is NOT done:** Full dashboard aggregate statistics contract B-DASH-01 remains pending backend implementation (FE-X01); dashboard totals are not synthesized from paginated library data.
- **Next action (task ID + files):** FE-X01 — await backend B-DASH-01 contract when scheduled.
