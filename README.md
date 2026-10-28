# Mojooba frontend

API consumption handoff: start at [docs/implementation/README.md](docs/implementation/README.md) and [HANDOFF](docs/implementation/HANDOFF.md); follow [AGENTS.md](AGENTS.md). These trackers distinguish implemented local contracts from unavailable APIs and live-provider gates.

The user interface for Mojooba (formerly CalMasta): a conversation-to-action workspace. Capture a meeting or voice note, get a transcript, turn it into an editable document.

Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, Tiptap 3, lucide-react.

## What is here

- `src/app/`: pages. `login`, `welcome` (onboarding), `deleted`, the signed-in app under `(app)/` (dashboard, capture with voice and meeting bot, library, recording and document detail, calendar, booking, plan and usage, settings), the public guest booking pages under `(public)/` (`book/`, `manage/`), and the separate staff area under `admin/`.
- `src/components/`: shared UI kit (`ui/`), app shell, dashboard, Document Studio editor, voice recorder, forms.
- `src/lib/`: browser-side helpers that call the API (`*-client.ts`), status wording, roles, audio, the header search palette rules, theme and sidebar boot, plan pricing and calendar/booking rules (all with tests).
- `src/server/domain/`: the document template definitions and shared types the UI reads. UI-only copy; the backend owns the real ones.

## What is not here

The NestJS backend owns business data, job workers and provider adapters. This frontend now supplies OIDC authentication, server-side sessions, profile routes and an authenticated API proxy under `/api/*`. The pages call `/api/dashboard`, `/api/uploads`, `/api/captures`, `/api/documents`, `/api/library`, `/api/calendar`, `/api/booking`, `/api/public`, `/api/plan`, `/api/account`, `/api/admin` and `/api/me`, so they need the Calmaster backend running at the same origin (or a proxy to it) to show real data.

## Develop

```bash
npm install
npm run dev        # http://localhost:3000
npm run typecheck
npm test
```

Design tokens live in `src/app/globals.css` (Light and Dark). Fills that carry white text use `accent-solid` / `danger-solid`; check new colour pairs against WCAG AA (4.5:1) in both themes. The Figma screens match these tokens.

## Authentication setup

1. Deploy the API's additive `002_identity_sessions.sql` through its checksum-tracked migration runner before starting frontend authentication. Never edit `001_foundation.sql`. Grant the frontend runtime DB role DML on `web_sessions` and `web_auth_transactions`; it must not have schema CREATE or migration credentials. The API runtime role also needs DML on `user_profiles`. Existing default grants must be verified for these new tables.
2. Copy `.env.example` to `.env.local` and fill the server-only values. Use the same restricted database/branch as the API. Generate a 64-hex-character `SESSION_SECRET`; keep it stable across frontend instances and restarts. Changing it invalidates encrypted session/transaction data. Nothing in this file is a browser/public environment variable.
3. In ZITADEL register an OIDC application with Authorization Code + PKCE S256. The code supports public PKCE (no client secret) or confidential client authentication via `client_secret_post` (configure the matching method). Register exact callback `${APP_URL}/api/auth/callback` and post-logout `${APP_URL}/login`. Request JWT/RS256 access tokens and the project's API audience. `ZITADEL_PROJECT_ID` is used in the project-audience scope; the API's `ZITADEL_API_AUDIENCE` must match the issued token audience. Enable self-registration, email verification, recovery email delivery and refresh tokens/offline access according to policy.
4. Set API issuer/JWKS/audience from that same ZITADEL instance. Frontend/backend IDs and audience are distinct configuration concepts: verify the resulting token against the actual API audience; do not guess from labels.
5. Locally run API on port 3000 and `pnpm dev --port 3001` here. Production APP_URL and remote API connections require HTTPS; plain HTTP is accepted only for loopback backend connections (e.g. when both apps share the Ubuntu server). Do not send bearer tokens over the public HTTP IP route.
6. Serve `/api/auth/*`, `/api/me` and `/api/*` to **Next.js** at the frontend origin. Its route handlers call the NestJS origin server-to-server. A reverse proxy must not bypass these handlers by sending all `/api/*` directly to NestJS. Configure the frontend Traefik hostname to point to Next.js; keep the separate API hostname routed to NestJS. No browser CORS change is required for this same-origin setup.

Login routes: GET `/api/auth/login` (optional `signup=1`, safe local `returnTo`), GET `/api/auth/callback`; POST `/api/auth/logout` with JSON `{all:false}` or `{all:true}`; GET/PATCH `/api/me`. Mutations require a matching Origin and JSON. Cookies are HttpOnly, SameSite=Lax and Secure with `__Host-` names on HTTPS. Session IDs are random; tokens remain AES-GCM encrypted in PostgreSQL, including refresh tokens. Authentication transactions expire after 10 minutes and are consumed once. Sessions have an absolute eight-hour lifetime, refresh under a database lock and survive application restarts. Expired rows are cleaned on login. All replicas need the same encryption secret and database.

The existing browser profile contract uses `role` for profession; `/api/me` maps it to NestJS `profession` and exposes membership separately as `workspaceRole`. Never use profession for authorization. Staff status and plan remain database-authorized fields. Verified email comes from the provider's signed-token/subject-checked UserInfo flow; local display name remains API-owned, including an explicitly cleared null value; the API may additionally persist email claims when supplied in its access JWT. Local name/timezone/preferences/onboarding are API-owned. New users redirect to `/welcome`; existing users return to a safe requested page. ZITADEL provides password/signup/recovery UI; no application password endpoints exist.

Logout everywhere revokes all **CalMasta application sessions** for the authenticated subject, attempts provider token revocation and then redirects through provider logout. It does not claim global logout from unrelated applications or devices' entire ZITADEL sessions. Local revocation works even during an IdP outage; the response reports provider-revocation failure separately. A failed application logout stays visible with an error rather than pretending to clear an HttpOnly cookie. Previously issued access tokens may remain valid until their expiry; keep token lifetime bounded.

The proxy authenticates supported application API prefixes, forwards only its server-held bearer token and selected headers (including Idempotency-Key), rejects path traversal, and bounds JSON bodies. It does not implement missing dashboard/calendar/commerce endpoints: those still return the API's real status. Public booking APIs are not added by this authentication change.

Verification: `pnpm typecheck`, `pnpm test`, `pnpm build`. Authentication tests use local signed OIDC fixtures and make no live ZITADEL calls. Real provider login/logout, production certificate and deployment acceptance remain separate checks.
