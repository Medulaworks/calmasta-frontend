# AUTH consumption

Tasks: FE-A01/FE-A02/FE-A03/FE-A04. [Acceptance and authoritative statuses](../WORK_PLAN.md) · [API readiness](../API_READINESS.md) · [Backend references](../BACKEND_REFERENCE.md).

Target files: src/components/login.tsx, onboarding.tsx, profile/profile-view.tsx, src/lib/profile-client.ts, src/server/auth/

Core auth/profile/onboarding APIs exist; next work is frontend bootstrap/contract hardening. Avatar APIs and guaranteed avatar/password metadata remain pending; real auth proof is gated.

## Current checkpoint

- **What was done (files + behavior):** Replaced direct frontend PostgreSQL connection with `ApiAuthStore` calling `/internal/auth/*` on `calmasta-api` (`BffSessionController`), removed all `DATABASE_URL` references from frontend, and wired avatar upload/complete/delete (`FE-X02` / `B-AUTH-02`) and `passwordUrl` in `profile-client.ts`, `avatar-client.ts`, and `profile-view.tsx`.
- **Proof (command + result + revision):** `pnpm typecheck && pnpm test && pnpm lint` and `git grep -i "database_url\|databaseurl"` (0 matches) verified on revision e9ad534; live ZITADEL login/callback verified creating user and session in PostgreSQL.
- **What is NOT done:** Live R2 avatar/audio upload and playback verification (`FE-C03`) pending R2 bucket credentials and CORS setup.
- **Next action (task ID + files):** FE-C03 — configure R2 credentials/CORS in `calmasta-api` and verify live avatar and audio upload/playback.
