# Meeting insights implementation plan

Spec: sibling calmasta-api/docs/implementation/FRONTEND_MEETING_INSIGHTS_HANDOFF.md.
Goal: consume the existing meeting recap, requested questions and owner email preference contracts on capture detail, preserving current media/transcript/documents/actions.
Architecture: same-origin API client, TanStack query options and explicit mutations, isolated meeting-only section using existing cards/buttons. No backend/runtime/env changes, live generation, email, browser automation, commits or deployment.

- [x] Client and lifecycle: add lib/meeting-insights-client.ts and lib/meeting-insights.ts. First test no-body POSTs, authenticated errors, disabled/paused/terminal/stale behavior, cancellation and bounded read backoff in lib/meeting-insights.test.ts.
- [x] Queries and mutations: add scoped keys/options in lib/queries.ts, explicit request/preference mutation options in lib/meeting-insights-queries.ts; use capture-key hierarchy to invalidate insights after both existing transcript save paths and capture deletion. Test observer reads never generate and requests invalidate even when refresh fails.
- [x] Presentation: add components/meeting-insights.tsx and integrate meeting-only in capture-detail.tsx. Brief-first recap, optional details, lists, plain text, accuracy note, click-only questions, timestamps, safe status/errors and eligible opt-in with failed-save preservation. Test rendered fixtures and explicit event handlers without browser automation.
- [x] Verification: focused client/query/UI/auth-proxy regressions, TypeScript, changed-file lint, production build if feasible. Update LIBRARY, WORK_PLAN, HANDOFF and JOURNAL with real results and pending hosted acceptance.

Review focus: never replay paid mutations; 202 terminal states are not successes; independent insight failures leave media usable; old content visibly stale after transcript edits; owner eligibility uses backend preferences and not profession; no secret/raw provider errors rendered; detached observers abort GETs.

Execution checkpoint: implemented inline in the shared workspace; no commits. The provided handoff is the approved scope. Local tests/build passed; hosted acceptance remains pending. Review found and regression-tested increasing GET retry backoff, newer insights against older capture caches, and consuming audio seeks after metadata readiness.

Tracker validation note: python3 docs/implementation/validate.py still fails on missing rules/token-management links and its historical exact-four-checkpoint-label assumption. Re-running with tracked frontend Markdown read from HEAD produced the identical failure list. These pre-existing documentation issues were not repaired in this feature; no documentation validation is counted as runtime evidence.
