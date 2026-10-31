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

## 2026-10-29 — meeting assistant display names

- **What was done (files + behavior):** FE-C01/FE-C02: voice page CaptureForm adds optional assistant-name input using policy botName placeholder, blank-default behavior, maxLength 100, mutation forwarding and submit reset. upload-client trims/validates the override, omits blank names and includes chosen names in existing request fingerprints; useRequestMeeting forwards it. Meeting title remains separate; shared same-origin auth/proxy and consent/video guards retained. Voice page removes hardcoded assistant branding from its description.
- **Proof (command + result + revision):** cb374de dirty frontend with concurrent auth edits preserved; provider/client regressions first failed, then direct node_modules/.bin/vitest run src/lib/capture-flow.test.ts passed 9/9; frontend tsc --noEmit, targeted eslint and diff checks passed. Backend df32fd0 dirty: migration018, DTO/policy/read models, persisted retry name and worker/provider dispatch verified by 40/40 focused disposable-PG tests and valid 68-path OpenAPI. No live bot/browser/provider test. pnpm auto-synchronized the pre-existing dependency tree during the first test invocation; only its unrelated lockfile edit was restored, with no requested dependency additions.
- **What is NOT done:** Hosted API/worker/frontend rollout and real custom-name meeting proof pending. No live flags, allowances, paid dispatch, browser automation, commit or deploy. Authenticated Google Meet assistants use their account name; guest custom names follow Recall bot_name.
- **Next action (task ID + files):** FE-C01/FE-C03 — deploy backend migrations through 018 and updated API/worker before the frontend; optional RECALL_BOT_NAME default, verify policy.botName and chosen name on an authorized live meeting. Acceptance: WORK_PLAN.md; backend runbook ../calmasta-api/docs/runbooks/meeting-bot-names.md (sibling repository).

## 2026-10-31 — selective loading presentation import

- **What was done (files + behavior):** FE-C02/FE-L02: imported shared ui/skeleton.tsx and shimmer CSS from feature3f57939; exact skeleton-class substitutions across existing screens, labeled list/detail placeholders on current capture/library consumers. PR_SELECTIVE_IMPORT.md records included groups and deferred rebrand/auth redesign; staging data/control logic retained.
- **Proof (command + result + revision):** Auth checkpoint49d7482 + selective working changes; TypeScript and git diff --check passed; changed-file lint exposed 1 existing top-bar set-state-in-effect error and 7 existing warnings; ESLint stdin comparison against49d7482 confirmed identical rule/severity diagnostics, no new lint diagnostics. Presentation source review only; visual/browser acceptance not claimed.
- **What is NOT done:** Rebrand/showcase/auth redesign, original PR merge, push/deploy or browser automation; indicators/notifications pending next groups. Visual verification remains PARTIALLY_TESTED.
- **Next action (task ID + files):** FE-C02 — status.ts/ui/badge.tsx/status-indicator.tsx: add indicators without changing terminal/readiness precedence, then notifications.

## 2026-10-31 — selective status indicator import

- **What was done (files + behavior):** FE-C02/FE-L02: added ui/status-indicator.tsx, optional Badge indicator and reduced-motion CSS from feature3f57939. status.ts decorates existing captureStatus outcomes after unchanged failure/attention precedence; badges on current capture/library/calendar/dashboard/voice consumers receive indicators. No status labels, query intervals, controls or brand changes.
- **Proof (command + result + revision):** Skeleton checkpoint9c72d1f + working changes; new status regression failed before implementation, then node_modules/.bin/vitest run src/lib/status.test.ts passed17/17; TypeScript, focused new/status-file eslint and diff checks passed. Previously documented unchanged screen lint issues remain; no visual/browser acceptance.
- **What is NOT done:** Live meeting/visual proof, notifications, rebrand/redesign, original PR merge, push/deploy; presentation verification remains partial.
- **Next action (task ID + files):** FE-C02 — lib/meeting-phase.ts, hooks/use-meeting-toasts.ts and ui/toast.tsx: adapt notifications to canonical states and staging query data, test failure/reconciliation transitions before wiring.
