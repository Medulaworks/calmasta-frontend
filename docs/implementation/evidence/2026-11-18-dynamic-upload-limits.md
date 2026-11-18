# Shared upload settings — local implementation checks

Revision: frontendcb98aa2 plus local diff, paired with backend67c2a8e plus local feature diff. Implementation IMPLEMENTED; focused verification PASSED; browser/hosted acceptance NOT_TESTED.

- Focused Vitest files: src/lib/capture-flow.test.ts, src/lib/transcript-upload.test.ts, src/components/transcript-upload.test.tsx, src/components/admin/product-settings-form.test.tsx, src/lib/product-policy-client.test.ts, src/lib/audio.test.ts, src/server/auth/meeting-insights-proxy.test.ts.84checks passed across scoped runs; latest corrected invalid-form/modal and refreshed-policy/cancel component tests26/26; final large-text BFF12/12. No browser automation.
- `node node_modules/typescript/bin/tsc --noEmit` passed. ESLint --max-warnings=0 passed for changed implementation files excluding voice-recorder.tsx, whose existing set-state-in-effect baseline remains unchanged. `git diff --check` passed.
- Separate existing auth/BFF regressions passed75/75 in9files. Exact transcript import/edit allowances support8MiB JSON with unchanged origin/session guards; unrelated BFF routes retain16KiB and existing API library routes retain their1MiB parser. Final BFF fixture tests forward1.2MB multibyte transcript data, rejecting8MiB overflow, foreign origins, absent auth and extra path segments.
- Paired disposable PostgreSQL backend checks41/41 plus final import-focused13/13, compiler success/OpenAPI156. Dynamic byte and character enforcement, raised limits, lower-policy saved retry, legacy defaults and1.2MB import/edit HTTP are covered without shared DB writes or paid providers.
- Existing defaults100,000characters/1MiB remain; settings support bounded1,000,000characters/4MiB safety ceilings. Draft text is not truncated on refresh. Shared policy query invalidates after Save, revalidates on focus and polls every15seconds while active.

Feature is not published. Upgrade all API/workers sharing a policy before saving new keys; use sibling backend releases/2026-11-18-dynamic-upload-limits-rollout.md. No user data, credentials or signed URLs were recorded.
