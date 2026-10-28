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

- **What was done (files + behavior):** Removed all `DATABASE_URL` and direct PostgreSQL dependencies from `calmasta-frontend` in favor of `ApiAuthStore` (`/internal/auth/*`), and implemented `FE-X01` (dashboard aggregates), `B-NOTIFY-01` (notifications seen IDs), and `FE-X02` (avatar upload/complete/delete and `passwordUrl` in `avatar-client.ts`, `profile-client.ts`, `profile-view.tsx`, and `app-shell.tsx`).
- **Proof (command + result + revision):** `pnpm typecheck && pnpm test && pnpm lint` and `python3 docs/implementation/validate.py` passed on revision e9ad534; `git grep -i "database_url\|databaseurl"` returned 0 matches.
- **What is NOT done:** Live R2 bucket credentials and CORS setup for end-to-end private audio and avatar upload/playback (`FE-C03`).
- **Next action (task ID + files):** FE-C03 — configure R2 storage credentials and CORS in `../calmasta-api/.env` and verify private upload/playback.
