# Frontend implementation tracking

Start with [HANDOFF](HANDOFF.md), then [WORK_PLAN](WORK_PLAN.md) and only the owning module. This is the integration tracker for the Mojooba-branded frontend in `calmasta-frontend`; the API repository/package remains named `calmasta-api`. Do not rename services because of that branding difference.

Read [architecture](ARCHITECTURE.md), [backend reference](BACKEND_REFERENCE.md) and [API readiness](API_READINESS.md) when needed. [Auth audit](AUTH_AUDIT.md) records exactly what login/welcome support already exists. Runtime source and current OpenAPI take precedence over older README descriptions.

Implementation and verification are independent:

- Implementation: NOT_STARTED (pending), IN_PROGRESS, IMPLEMENTED (code exists), COMPLETED (acceptance proven), BLOCKED, DEFERRED.
- Verification: NOT_TESTED, PARTIALLY_TESTED, PASSED, FAILED, BLOCKED.
- Anything other than COMPLETED still has outstanding work. A rendered page, TypeScript interface, proxy allowlist entry or mocked response does not prove an API exists.
- READY_LOCAL in the readiness map means implemented backend source/contract, not deployment or real-provider acceptance. Existing wired features start IMPLEMENTED/PARTIALLY_TESTED; do not invent new successful checks.

At checkpoints update the owning module, HANDOFF, WORK_PLAN status and append JOURNAL (maximum five lines per entry). Use only four checkpoint fields: What was done (files + behavior); Proof (command + result + revision); What is NOT done; Next action (task ID + files). Link acceptance criteria rather than copying them into module records.

Create `evidence/` only for real implementation checks. Never put documentation-validation output, secrets, signed URLs, tokens, real transcripts or private meeting data there. This audit deliberately creates no evidence artifact.

Follow frontend [rules](../rules.md), [token protocol](../token-management.md) and [AGENTS](../../AGENTS.md). No browser/simulator automation unless requested. Do not enable live processing, invent allowances, dispatch paid provider calls, commit/push/deploy or change production data as part of ordinary frontend consumption.

Validate tracker links/statuses/readiness without running the app: `python3 docs/implementation/validate.py`. This only inspects local documentation/source/OpenAPI; it does not prove runtime behavior.

## Current checkpoint

- **What was done (files + behavior):** Frontend structure/client/auth audit and implementation handoff created; existing runtime behavior preserved. Backend source 5b690cc and frontend source e9ad534 inspected; ready contracts separated from unavailable/proposed endpoints.
- **Proof (command + result + revision):** Source inspection plus `python3 docs/implementation/validate.py` passed: 15 documentation files, 48 local links, 15 READY_LOCAL contract rows, 18 unique task IDs and six matching professions. Documentation/contract validation only; no runtime, browser, provider or production database check claimed. Historical application evidence is linked through BACKEND_REFERENCE.md.
- **What is NOT done:** No new API consumption code or backend endpoints implemented by this documentation task; live ZITADEL/HTTPS/deployment and provider acceptance remain incomplete. Existing connected code is not to be rebuilt from scratch.
- **Next action (task ID + files):** FE-A02 — src/components/login.tsx, onboarding.tsx, src/lib/profile-client.ts and focused tests; harden bootstrap/error/redirect handling against existing /api/me and auth routes, then FE-U01 quota consumption.
