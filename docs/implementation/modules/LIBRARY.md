# LIBRARY consumption

Tasks: FE-L01/FE-L02. [Acceptance and authoritative statuses](../WORK_PLAN.md) · [API readiness](../API_READINESS.md) · [Backend references](../BACKEND_REFERENCE.md).

Target files: src/lib/library-client.ts, transcript-drafts.ts, src/components/transcript-library.tsx, transcript-editor.tsx, library-recording.tsx

Search/detail/edit are already wired. Keep changed lines, exact retries, version conflicts and late in-flight edits safe; do not route back to unsupported legacy document/capture actions.

## Current checkpoint

- **What was done (files + behavior):** Verified library client contracts, cursor pagination, search query mapping, 401 unauthenticated session handling, AbortSignal request cancellation, 409 conflict detection preserving in-flight edits, 413 payload limit handling, and 404 missing capture handling in `src/lib/library-client.test.ts`.
- **Proof (command + result + revision):** `pnpm test && pnpm typecheck && pnpm build` passed cleanly on revision e9ad534 (7 library tests passing).
- **What is NOT done:** Document generation/export and document version history remain pending backend M6 implementation (FE-X03).
- **Next action (task ID + files):** FE-X03 — document generation consumption after backend M6 APIs are ready.
