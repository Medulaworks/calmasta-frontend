# CAPTURE consumption

## 2026-11-09 — hosted rollout and verification

- **What was done (files + behavior):** Pulled and deployed latest fixes for both repositories. Deployed staging backend (7b8b046), production backend (7b8b046), and production frontend (fdcb2b1). Verified duplicate-bot prevention, canonical meeting URL handling, and empty-transcript display ("No speech detected").
- **Proof (command + result + revision):** Backend PG16 isolated suite: 288/288 passed, 122 OpenAPI paths. Frontend suite: 358/358 passed; tsc --noEmit and next build passed. Live checks: /dashboard/voice and /auth/login return 200; PM2 processes healthy.
- **What is NOT done:** Automated probe execution & alert delivery remain blocked awaiting operator provisioning of dedicated fixture credentials/capture ID and authorized on-call notification destination.
- **Next action (task ID + files):** OTEL-09/OPERATIONS — operator provisions operator-owned fixture capture ID and session cookie in protected env for scripts/check-playback.cjs, and designates alert destination.

## 2026-11-09 — runtime source published on main and staging

- **What was done (files + behavior):** Published frontend runtime commit20bc27c and backend7b8b046 to main/staging in the Medulaworks repositories. Both source trees contain the tested auth/playback and active-meeting safeguards. Server handoff now directs pull/deploy of committed source; patch artifacts are historical references.
- **Proof (command + result + revision):** Atomic non-force pushes succeeded; remote ls-remote confirmed both branches equal20bc27cfrontend/7b8b046backend before this documentation-only checkpoint. Source proof remains358/358frontend,typecheck/build and288/288backend,122OpenAPIpaths; no source changes since checks. Tracking refs refreshed and worktrees clean before this checkpoint.
- **What is NOT done:** Hosted deployment/incident cause, playback fixture monitoring/collector receipt/alert delivery and unrelated mirror updates. No live data or provider mutations; saved earlier transcription stash preserved.
- **Next action (task ID + files):** FE-A04/FE-C02/OTEL-09 — server pulls both repositories and follows backend docs/implementation/HOSTED_AUTH_PLAYBACK_DUPLICATE_FIX_PROMPT.md; deploy source without reapplying patches. WORK_PLAN.md criteria and hosted acceptance remain separate.


## 2026-11-09 — playback diagnostics and duplicate submission safeguards

- **What was done (files + behavior):** On frontend2983a09, server/auth diagnostics.ts/service.ts/store.ts now emit safe per-request BFF failure stages, frontend/upstream references and trace context without private payloads. upload-client adds support references and reads duplicate responses; capture-form/capture-menu guard in-flight submits and explain existing captures. Browser telemetry ingress fails closed to prevent arbitrary private-message forwarding; stale admin stub test updated to real denial propagation. Backend93ae1e3 local follow-up adds atomic active-meeting guard and read-only probe. Existing empty-speech UI retained.
- **Proof (command + result + revision):**2983a09 plus local diff; full Vitest358/358 across50files, tsc --noEmit and next build passed. New auth/capture regressions observed red before fixes; review findings corrected/rechecked. Backend disposable-PG18 full288/288 and122-path OpenAPI valid. Source/fixture checks only; no browser/live provider runs. git diff --check clean.
- **What is NOT done:** No commit/push/deploy, production auth root-cause proof, live session/media changes, notification sends, collector receipt or scheduled probe. Browser arbitrary-message collection intentionally unavailable; server logs must be collected separately. Older local backend transcription edits preserved in named stash and temporary patch before sync; deployed equivalent retained.
- **Next action (task ID + files):** FE-A04/FE-C02/OTEL-09/B01/B03 — operator uses sibling calmasta-api/docs/implementation/HOSTED_AUTH_PLAYBACK_DUPLICATE_FIX_PROMPT.md and both release patches to deploy, trace original failure and prove scheduled fixture detection plus authorized alert delivery. WORK_PLAN.md criteria; local verification does not close hosted acceptance.


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


## 2026-11-05 — main/staging synchronization
- **What was done (files + behavior):** Preserved both branch histories: recording-cap release plus backend safe insight diagnostics and frontend zero-byte insight proxy fix. Saved all temporary-worktree checkpoints in primary checkouts; synchronized branch publication and unused-worktree cleanup authorized by user.
- **Proof (command + result + revision):** Backend merge411b7eb passed115/115focused disposable-PG/provider/media/insight checks and82-path OpenAPI. Frontend mergea012c13 combines verified proxy/cap changes; final focused checks recorded in session. No secrets/environment files staged; source merge conflicts absent, documentation appends retained from both sides.
- **What is NOT done:** Remote synchronization and deployment completion pending at this checkpoint; provider/live acceptance remains separate from Git equality. No force-push or commit discard authorized/performed.
- **Next action (task ID + files):** F02/B01/FE-C01/FE-L03 — push identical final HEAD to main/staging in each repository, verify remote hashes and clean tracked trees, remove only merged temporary recording-cap worktrees, then inspect deployment workflows.

## 2026-11-09 — hosted capture status investigation and recovery (B01/B03/T03)
- **What was done (files + behavior):** Investigated and recovered hosted captures `a9331b05-0740-4630-9ad4-a30a324f8566` (Bot 1 `ed3bafea-5105-40bd-96de-9d489b6f9b1f`) and `643e973f-6f0c-46ec-8714-d6e5d3c16cc6` (Bot 2 `c29b8f22-86ce-40b9-844a-f6c0c21fa1c7`). Provider lifecycle logs revealed Bot 1 recorded past human attendee exit due to a second bot (`T's Fathom Notetaker`) remaining until 09:52:43 UTC; Recall auto-ended on bot silence timeout at 10:02:45 UTC, and media (3398s) + transcript completed cleanly. Bot 2 had completed Recall media (15s) and AssemblyAI transcript, but worker poll looped in `provider_result_unavailable` due to strict parser rejection of completed empty transcript (`text: ''`, `utterances: null`). In `src/providers/assemblyai.ts`, normalized verified completed empty results to empty utterances/speakers while maintaining audio duration, model, and ID validation. In `src/workers/transcription.worker.ts`, added sanitized poll failure diagnostics. Verified downstream recap scheduling cleanly avoids paid analysis on empty transcripts. Zero-downtime deployment applied to production and staging; worker resumed polling existing AssemblyAI transcript without resubmission, completing Capture 2 with single settlement and Recall billing hold preserved.
- **Proof (command + result + revision):** Backend revision `15ce7e53b061b78160a2afcc43cfff5c0df8d67d` pushed to `origin/main` and `origin/staging`. `test:isolated` passed 276/276 (3 skipped) with valid 122-path OpenAPI. Both `/home/ubuntu/calmasta-shared/deploy.sh` and `/home/ubuntu/calmasta-staging-shared/deploy.sh` succeeded. Live Neon DB query confirms Capture 1 `state: completed` (3398s), Capture 2 `state: completed` (15s, transcript `07b33ba2-ec9d-498d-8c72-cacff395eb4d`, text `""`, utterances `[]`), exactly 1 usage settlement event, 0 insight jobs, Recall billing hold `billing_reconciliation_required` preserved.
- **What is NOT done:** `RECORDING_LIMITS_OVERRIDE_ENABLED=true` remains in `runtime.env`. Restoring to `false` requires operational approval; zero active recall jobs currently exist so toggle is safe.
- **Next action (task ID + files):** B01/OPS — operator toggles `RECORDING_LIMITS_OVERRIDE_ENABLED=false` in `/home/ubuntu/calmasta-shared/runtime.env` and `/home/ubuntu/calmasta-staging-shared/runtime.env` and reloads PM2 to restore standard 1800s timeout ceilings.
