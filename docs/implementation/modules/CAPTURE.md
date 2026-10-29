# CAPTURE consumption

Tasks: FE-C01/FE-C02/FE-C03. [Acceptance and authoritative statuses](../WORK_PLAN.md) · [API readiness](../API_READINESS.md) · [Backend references](../BACKEND_REFERENCE.md).

Target files: src/lib/upload-client.ts, audio.ts, status.ts, src/components/voice-recorder.tsx, capture-form.tsx, private-audio.tsx, library-recording.tsx

Core consumers already exist. User reported adding the R2 lifecycle rule; management proof is still absent and CORS was deferred. Live cap/rate/provider gates stay in force.

## Current checkpoint

- **What was done (files + behavior):** Verified capture client contracts, policy enforcement, consent requirement, idempotent completion, cancellation via POST /api/captures/:id/cancel, disabled policy rejection, and private audio 410 handling in `src/lib/capture-flow.test.ts`.
- **Proof (command + result + revision):** `pnpm test && pnpm typecheck && pnpm build` passed cleanly on revision e9ad534 (8 capture flow tests passing).
- **What is NOT done:** Real browser R2 CORS / private playback live proof and external provider gates (FE-C03) remain gated.
- **Next action (task ID + files):** FE-C03 — browser playback verification after external provider authorization.

## 2026-10-29 — meeting list polling

- **What was done (files + behavior):** FE-C02 refinement IMPLEMENTED in src/components/capture-form.tsx and src/lib/meeting-poller.ts: sequential 15-second polling only while active, hidden-tab pause, 30/60/120-second failure backoff, immediate action refresh, terminal-state stop and unmount cancellation via src/lib/upload-client.ts. List errors remain separate from mutation errors.
- **Proof (command + result + revision):** dded46a working tree: pnpm test src/lib/meeting-poller.test.ts src/lib/capture-flow.test.ts passed 12/12; pnpm typecheck, targeted eslint and git diff --check passed. Polling refinement verification PARTIALLY_TESTED (fake timers/client checks).
- **What is NOT done:** Live browser/network and backend/provider verification; no browser automation, paid processing, commits or deployment.
- **Next action (task ID + files):** FE-C02 — manually verify capture-form.tsx request cadence, tab visibility and failure recovery when browser verification is authorized.
