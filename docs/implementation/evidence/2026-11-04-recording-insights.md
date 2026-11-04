# FE-L03 active recording insights regression — 2026-11-04

Revision: frontend b4a65e4 plus library-recording.tsx/private-audio.tsx and new library-recording.test.tsx. Existing uncommitted admin/calendar changes preserved. Both /dashboard/captures/[id] and /dashboard/library/recordings/[id] consume LibraryRecording; routes unchanged.

Before implementation: focused new recording test failed four cases for missing MeetingInsights identity/version, post-save panel version, question seeking connection and audio metadata/ref callbacks. Two initial test-fixture timing failures were corrected before recording the expected regression failures.

Final commands:

```
node_modules/.bin/vitest run src/components/library-recording.test.tsx src/components/meeting-insights.test.tsx src/lib/meeting-insights.test.ts src/lib/meeting-insights-queries.test.ts src/lib/library-client.test.ts
node_modules/.bin/tsc --noEmit
node_modules/.bin/eslint src/components/library-recording.tsx src/components/private-audio.tsx src/components/library-recording.test.tsx --max-warnings=0
```

Results:54/54tests across5files; TypeScript and lint exit0. Six new regressions exercise meeting-only panel, uploaded audio exclusion, real insight observer plus mount/version-invalidation effect with GET-only requests, transcript-save callback refreshing version and stale recap rendering, same-player seek readiness/clearing, and player metadata/emptied/error/expiry/ref-detachment callbacks. Additional existing tests cover polling/backoff/cancellation, feature guards, explicit mutations, owner email eligibility and safe errors. Tests use a hook/effect harness, server rendering, actual QueryClient/QueryObserver and mocked HTTP; navigation/editor boundaries are stubbed. Audio events/ref detachment are simulated, not browser playback proof.

No browser, live AI/email, backend/configuration edits, commit, push or deployment. Backend migration022 and bounded API/worker AssemblyAI/insights configuration remain deployment prerequisites, not newly discovered missing settings. Overall hosted verification remains partial.
