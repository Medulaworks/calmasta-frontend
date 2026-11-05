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

## 2026-10-31 — selective meeting notifications and final review

- **What was done (files + behavior):** FE-C02/FE-L02: added ui/toast.tsx, lib/meeting-phase.ts/tests and hooks/use-meeting-toasts.ts from feature3f57939 with staging adaptations: canonical attention/failure precedence, quiet initial load, stable history across query/filter gaps, encoded links and capture-scoped notices. Current capture-form/detail query results feed notifications; consent/names/video/cancel/mutations preserved. PR_SELECTIVE_IMPORT.md records separately deferred rebrand/showcase/auth redesign.
- **Proof (command + result + revision):**78f02a1 + notification patch; actual16file focused vitest command/results in evidence/2026-10-31-selective-import.md:141/141; TypeScript, new-file targeted lint/diff and next build51routes passed. Fresh source review found no blockers; scope feedback fixed. Compared protected auth/brand/query/mutation/upload files to49d7482: no changes. Existing1screen lint error/7warnings remain identical to baseline.
- **What is NOT done:** Browser/visual/live meeting and hosted acceptance; no full rebrand/redesign, original PR merge, backend change, paid dispatch, push or deployment. Presentation verification stays PARTIALLY_TESTED despite passed fixture/build checks.
- **Next action (task ID + files):** FE-C03/FE-A04 — authorized manual local visual/meeting checks and later hosted acceptance; deferred design package may be reviewed separately using PR_SELECTIVE_IMPORT.md before any design import.


## 2026-11-05 — B01/G01 remaining recording cap removal
- **What was done (files + behavior):** IMPLEMENTED under RECORDING_LIMITS_OVERRIDE_ENABLED: nullable unlimited capture/usage policy; relaxed DTO/DB duration and file-size admission; no Recall recording timeout or worker duration stop; unlimited media validation plus streamed private temp-file ingestion/R2 writes; long transcript capacity and recording-only quota/spend bypass preserve unrelated insight guards. Migration023 preserves old migrations and supports late uncovered recording-duration accounting. Default flag-off limits remain; existing dirty source trees preserved in isolated branches.
- **Proof (command + result + revision):** API base37c762a/frontend0b8e51a plus scoped working changes: node /private/tmp/calmasta-recording-caps-check.cjs passed100/100focused disposable-PG/mock-provider/media tests, TypeScript and82-path OpenAPI. Frontend30/30focused tests, next typegen and tsc --noEmit passed. Changed-file lint passes with pre-existing react-hooks/set-state-in-effect violation at voice-recorder.tsx144 excluded; unrestricted lint reports that existing violation. Code review findings on stalled storage/result capacity resolved. No live provider calls.
- **What is NOT done:** Not deployed; migration023 and matching API/worker/frontend release still required. Provider constraints remain: AssemblyAI10h/5GB per transcription file; current R2 single-PUT5GiB; browser memory/storage/meeting-platform limits cannot be disabled. No live recording, multipart/chunked transcription feature or main/staging merge performed; no original dirty source edits overwritten.
- **Next action (task ID + files):** B01/G01/FE-C01 — merge/release both fix/recording-caps branches through normal pipelines, apply migrations/023_recording_duration_caps.sql, verify the existing flag on all API/worker consumers of shared DB and nullable /uploads/policy plus /usage/summary; fresh active-meeting test remains user initiated. Restore by setting flag=false on each runtime. Criteria WORK_PLAN.md.


## 2026-11-05 — recording cap changes merged to main
- **What was done (files + behavior):** At explicit user request, published branches and merged backend PR17 into main as0037499797558358dec502fe2643a99c404bc2cc and frontend PR14 into main asfbf418c967f6523f767167cd1b56b3cca98331a6. Backend PR retargeted from staging to main; original source checkouts preserved.
- **Proof (command + result + revision):** Fresh focused backend100/100,82-path OpenAPI and frontend30/30 plus TypeScript passed on exact unchanged candidate trees. gh pr view confirms both MERGED/main; backend Actions42034255418 and frontend42034257810 are in_progress for exact merge commits.
- **What is NOT done:** Workflow completion, hosted migration023/effective runtime policy and live recording are not yet verified. Staging branch not merged by this user request. External provider constraints remain.
- **Next action (task ID + files):** B01/G01/FE-C01 — deployment workflows verify/release main, apply migration023 through normal mechanism and inspect runtime API/worker parity and null policy before user-initiated meeting test; canonical WORK_PLAN.md.
