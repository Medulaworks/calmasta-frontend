# Frontend agent handoff

You can start consuming ready local contracts now. Core auth/capture/library code is already wired; the next agent should close identified gaps, not rebuild it.

## Start here

1. Read root AGENTS.md, docs/rules.md and docs/token-management.md.
2. Read this file + README + WORK_PLAN + only modules/AUTH.md for the next task.
3. Use AUTH_AUDIT.md, API_READINESS.md and BACKEND_REFERENCE.md as targeted references. Inspect git status first and preserve existing work.
4. Start **FE-A02** in components/login.tsx/onboarding.tsx and focused tests. Core server auth supports it already. Then FE-A03 nullable profile/copy hardening and **FE-U01** using ready GET /api/usage/summary.
5. Existing FE-C01/FE-L01 code supports capture/transcript consumption; verify and fix drift under FE-C02/FE-L02 rather than creating duplicate clients.

## Paste into the new frontend agent

> Work in /Users/josiaharkson/Work/Medulaworks/calmasta-frontend. Follow AGENTS.md, docs/rules.md and docs/token-management.md. Read docs/implementation/README.md, HANDOFF.md, WORK_PLAN.md and modules/AUTH.md; start FE-A02. The backend is the sibling /Users/josiaharkson/Work/Medulaworks/calmasta-api; use docs/implementation/BACKEND_REFERENCE.md and API_READINESS.md to inspect real source/OpenAPI. Core auth/profile, upload/meeting/private playback and transcript search/edit are already implemented locally. Harden the pending auth/bootstrap/profile/usage consumers without rebuilding existing flows. Never invent missing endpoints or successful data. Record backend gaps in the linked backend implementation request file; do not implement backend scope without assignment. Keep live processing, rates and allowances unchanged; no paid provider calls, production DB tests, browser automation, commits, pushes or deployments without the appropriate authorization. At checkpoints update owning module, task statuses and this handoff; append JOURNAL using the four checkpoint fields.

## Current checkpoint

- **What was done (files + behavior):** Applied additive database migrations 002-008 to Neon database; granted schema USAGE and table DML on `web_sessions` and `web_auth_transactions` to `calmasta_frontend`. Verified live ZITADEL discovery, PKCE challenge generation, state/nonce creation, cookie dispatch, and authorization redirect on `GET /api/auth/login`.
- **Proof (command + result + revision):** `curl -s -i http://localhost:3006/api/auth/login` returned HTTP 303 redirect to ZITADEL OAuth authorize endpoint with encrypted transaction saved in `web_auth_transactions`; `calmasta_frontend` query verified 0 errors on revision e9ad534.
- **What is NOT done:** Interactive user login/signup in browser on hosted ZITADEL page and callback exchange to write authenticated session.
- **Next action (task ID + files):** FE-A04 — perform browser sign-in at `http://localhost:3006/login` and verify session write and welcome/dashboard landing.
