# AUTH consumption

Tasks: FE-A01/FE-A02/FE-A03/FE-A04. [Acceptance and authoritative statuses](../WORK_PLAN.md) · [API readiness](../API_READINESS.md) · [Backend references](../BACKEND_REFERENCE.md).

Target files: src/components/login.tsx, onboarding.tsx, profile/profile-view.tsx, src/lib/profile-client.ts, src/server/auth/

Core auth/profile/onboarding APIs exist; next work is frontend bootstrap/contract hardening. Avatar APIs and guaranteed avatar/password metadata remain pending; real auth proof is gated.

## Current checkpoint

- **What was done (files + behavior):** Applied database migrations 002 through 008 to Neon DB; granted USAGE and DML on `web_sessions` and `web_auth_transactions` to `calmasta_frontend`. Verified live ZITADEL discovery, PKCE challenge generation, state/nonce creation, cookie dispatch, and authorization redirect on `GET /api/auth/login`.
- **Proof (command + result + revision):** Migrations applied cleanly (`pnpm run migrate` in API); grants confirmed via PostgreSQL query; `curl -s -i http://localhost:3006/api/auth/login` verified returning HTTP 303 redirect to ZITADEL OAuth authorize endpoint with encrypted transaction saved in `web_auth_transactions`.
- **What is NOT done:** Browser completion of user sign-in/signup interaction on hosted ZITADEL login page and subsequent OAuth callback verification with session write.
- **Next action (task ID + files):** FE-A04 — test end-to-end user sign-in at `http://localhost:3006/login` and verify session establishment in `web_sessions`.
