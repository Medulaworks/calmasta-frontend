# CAPTURE consumption

Tasks: FE-C01/FE-C02/FE-C03. [Acceptance and authoritative statuses](../WORK_PLAN.md) · [API readiness](../API_READINESS.md) · [Backend references](../BACKEND_REFERENCE.md).

Target files: src/lib/upload-client.ts, audio.ts, status.ts, src/components/voice-recorder.tsx, capture-form.tsx, private-audio.tsx, library-recording.tsx

Core consumers already exist. User reported adding the R2 lifecycle rule; management proof is still absent and CORS was deferred. Live cap/rate/provider gates stay in force.

## Current checkpoint

- **What was done (files + behavior):** Verified capture client contracts, policy enforcement, consent requirement, idempotent completion, cancellation via POST /api/captures/:id/cancel, disabled policy rejection, and private audio 410 handling in `src/lib/capture-flow.test.ts`.
- **Proof (command + result + revision):** `pnpm test && pnpm typecheck && pnpm build` passed cleanly on revision e9ad534 (8 capture flow tests passing).
- **What is NOT done:** Real browser R2 CORS / private playback live proof and external provider gates (FE-C03) remain gated.
- **Next action (task ID + files):** FE-C03 — browser playback verification after external provider authorization.
