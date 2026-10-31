# LIBRARY consumption

Tasks: FE-L01/FE-L02. [Acceptance and authoritative statuses](../WORK_PLAN.md) · [API readiness](../API_READINESS.md) · [Backend references](../BACKEND_REFERENCE.md).

Target files: src/lib/library-client.ts, transcript-drafts.ts, src/components/transcript-library.tsx, transcript-editor.tsx, library-recording.tsx

Search/detail/edit are already wired. Keep changed lines, exact retries, version conflicts and late in-flight edits safe; do not route back to unsupported legacy document/capture actions.

## Current checkpoint

- **What was done (files + behavior):** Verified library client contracts, cursor pagination, search query mapping, 401 unauthenticated session handling, AbortSignal request cancellation, 409 conflict detection preserving in-flight edits, 413 payload limit handling, and 404 missing capture handling in `src/lib/library-client.test.ts`.
- **Proof (command + result + revision):** `pnpm test && pnpm typecheck && pnpm build` passed cleanly on revision e9ad534 (7 library tests passing).
- **What is NOT done:** Document generation/export and document version history remain pending backend M6 implementation (FE-X03).
- **Next action (task ID + files):** FE-X03 — document generation consumption after backend M6 APIs are ready.

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
