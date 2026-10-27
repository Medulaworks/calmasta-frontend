# Frontend structure

Next.js 16 App Router, React 19, TypeScript, Tailwind v4 and pnpm; Vitest tests run in Node. `@/` resolves into src. Reuse the current components/tokens and do not reorganize the project for consumption work.

| Area | Responsibility / entry points |
| --- | --- |
| src/app/layout.tsx + globals.css | Root shell, fonts, metadata, theme boot and shared styles |
| src/app/login + welcome | Public UI wrappers for components/login.tsx and onboarding.tsx; /welcome is outside AppShell and must handle its own bootstrap/session state |
| src/app/(app) | AppShell-provided signed-in UI: dashboard, voice, capture, profile, library, settings, calendar, booking, plan |
| src/app/(public) | Guest booking/manage pages; their APIs are not implemented or anonymously forwarded yet |
| src/app/admin | AdminShell/staff UI; current backend has no corresponding staff HTTP endpoints |
| src/app/api/auth/* + api/me | Real BFF login, callback, logout and profile handlers |
| src/app/api/[...path] | Authenticated origin-checked allowlisted proxy; an allowed prefix is not proof of backend implementation |
| src/server/auth | OIDC configuration/runtime, encrypted DB sessions, state/PKCE/nonce, refresh and proxy logic |
| src/server/domain | Shared domain/template/type utilities; not an implemented document/calendar/booking API |
| src/lib/*-client.ts | Browser request contracts/adapters; upload-client.ts is the shared ApiError/fetch helper, library-client delegates detail/edit to it |
| src/components/shell | AppShell/ProfileProvider, top bar, navigation, usage/plan banners and global search |
| src/components + nested feature directories | Existing UI; map direct fetch/admin helper calls too, not just client files |
| src/components/ui + theme | Established visual primitives; keep appearance changes outside ordinary consumption tasks |
| src/hooks/use-capture-policy.ts | Configured policy state; zero/disabled is expected until allowance/configuration is approved |
| src/lib/*.test.ts + src/server/auth/*.test.ts | Existing contract, pure logic and local OIDC/DB checks |

## Core flows already present

- Login links perform full-page redirects to /api/auth/login; signup adds signup=1. The BFF authenticates with ZITADEL, persists encrypted sessions and provisions/reads API /account/me. New users go to /welcome.
- Welcome reads /api/me; role selection PATCHes profession via the BFF mapping, timezone is best-effort, complete:true persists onboarded. Role selections are professions, never permissions.
- Voice/upload checks policy/consent, hashes bounded bytes, signs immutable R2 PUT, then completes by upload ID with a separate key. Processing is asynchronous.
- Meeting creation/cancel/retry uses the consented Recall API. Actual bot name comes from policy; video is unsupported.
- /library and /library/recordings/:id browse/search/edit persisted transcripts. /captures/:id now uses the same detail component; older capture-detail/library-list components remain in the tree and must not accidentally reintroduce unavailable controls.
- PrivateAudio obtains an expiring link on demand, holds it only in memory and preserves transcript UI after audio expiry.

## Current integration traps

AppShell also requests plan/deletion data; TopBar requests notifications; /dashboard requests /api/dashboard. These services are not ready. Some failure handling is silent; empty/unsupported is not equivalent to a successful empty dataset. No current frontend runtime handler implements those services behind the catch-all.

ProfileView declares avatarUrl/passwordUrl but the real /api/me response does not currently guarantee them. Avatar calls use /api/me/avatar paths rejected by the generic proxy. Public booking, notifications, avatar, actions and /api/transcripts aliases also need explicit route design/allowlist changes when their backend contracts exist.

The branding says Mojooba while repositories/auth cookie/config prefixes remain CalMasta. Backend policy currently names the actual bot CalMasta Notetaker; avoid hardcoded false bot names. Several welcome/document examples are illustrative and not generated output.
