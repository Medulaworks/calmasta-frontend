# MyJooba frontend

API consumption handoff: start at [docs/implementation/README.md](docs/implementation/README.md) and [HANDOFF](docs/implementation/HANDOFF.md); follow [AGENTS.md](AGENTS.md). These trackers distinguish implemented local contracts from unavailable APIs and live-provider gates.

The user interface for MyJooba (formerly CalMasta): a conversation-to-action workspace. Capture a meeting or voice note, get a transcript, turn it into an editable document.

Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, Tiptap 3, lucide-react.

## What is here

- `src/app/`: pages. `auth/` (login, verification, recovery and password change), `dashboard/welcome` (onboarding), `deleted`, the signed-in app under `dashboard/(app)/` (dashboard, capture with voice and meeting bot, library, recording and document detail, calendar, booking, plan and usage, settings), the public guest booking pages under `(public)/` (`book/`, `manage/`), and the separate staff area under `dashboard/admin/`.
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

The backend owns email/password, verification/recovery and Google sign-in. The frontend uses same-origin Next handlers, opaque HttpOnly cookies and encrypted backend-persisted sessions; no browser token storage or frontend OAuth secrets.

1. Apply backend migrations through010 with reviewed runtime permissions; no production migration is performed by tests. Existing users keep their UUIDs/workspaces. Old provider sessions require login again; legacy users without passwords recover via verified email.
2. Set APP_URL, CALMASTA_API_URL and SESSION_SECRET in .env.local/server environment. The backend BFF store requires the same SESSION_SECRET. No frontend DATABASE_URL, Google client secret or external IdP settings are required. Use localhost:3006 locally.
3. For HTTPS production, set AUTH_TRUST_PROXY=true only after confirming that the trusted platform proxy overwrites/appends the real client IP as the final X-Forwarded-For value and clients cannot bypass that proxy. Missing trusted client IP fails closed. Backend accepts per-client rate identity only with the BFF secret; public callers cannot spoof it. Verify this contract on the actual deployment, rather than assuming a platform implementation.
4. Set backend AUTH_JWT_SECRET (64 random hex characters), APP_PUBLIC_URL, SMTP_HOST/PORT/SECURE/USER/PASS/EMAIL_FROM and matching SESSION_SECRET. SMTP is required outside tests; no verification/reset links are logged.
5. Optional Google: backend GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI. Register exact <APP_URL>/api/auth/callback in Google Cloud as a Web application redirect. Configure consent screen/test users or publish appropriately. Google calendar permissions are separate and are not requested by login.

POST /api/auth/login and /api/auth/register accept email/password. GET /api/auth/login starts backend-owned Google PKCE/state/nonce; callback exchanges via backend and establishes an internal session. /auth/verify-email and /auth/reset-password provide explicit token confirmation forms; /auth/change-password is linked from profile. Anonymous recovery/verification use explicit same-origin endpoints. Unverified users must verify before using capture/library/dashboard. Existing same-email password accounts are never silently Google-linked; sign in or recover that account. Backend profile emailVerified is authoritative.

Profile role means profession; workspaceRole is membership. Logout revokes backend sessions before clearing browser state. Password changes/resets revoke all internal sessions; frontend refresh leases prevent concurrent instances reusing rotated refresh tokens. Tokens stay server-side.

Run pnpm typecheck, pnpm test, pnpm build and focused eslint checks. Tests use local fixtures; real Google/SMTP and production proxy checks remain manual. Full plan and progress: ../calmasta-api/docs/implementation/modules/M1.md and ../calmasta-api/docs/implementation/HANDOFF.md.
