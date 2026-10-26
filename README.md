# Mojooba frontend

The user interface for Mojooba (formerly CalMasta): a conversation-to-action workspace. Capture a meeting or voice note, get a transcript, turn it into an editable document.

Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, Tiptap 3, lucide-react.

## What is here

- `src/app/`: pages. `login`, `welcome` (onboarding), `deleted`, the signed-in app under `(app)/` (dashboard, capture with voice and meeting bot, library, recording and document detail, calendar, booking, plan and usage, settings), the public guest booking pages under `(public)/` (`book/`, `manage/`), and the separate staff area under `admin/`.
- `src/components/`: shared UI kit (`ui/`), app shell, dashboard, Document Studio editor, voice recorder, forms.
- `src/lib/`: browser-side helpers that call the API (`*-client.ts`), status wording, roles, audio, the header search palette rules, theme and sidebar boot, plan pricing and calendar/booking rules (all with tests).
- `src/server/domain/`: the document template definitions and shared types the UI reads. UI-only copy; the backend owns the real ones.

## What is not here

The backend: API routes (`/api/*`), database, sign-in (ZITADEL over OIDC), job worker and provider adapters. The pages call `/api/dashboard`, `/api/uploads`, `/api/captures`, `/api/documents`, `/api/library`, `/api/calendar`, `/api/booking`, `/api/public`, `/api/plan`, `/api/account`, `/api/admin` and `/api/me`, so they need the Calmaster backend running at the same origin (or a proxy to it) to show real data.

## Develop

```bash
npm install
npm run dev        # http://localhost:3000
npm run typecheck
npm test
```

Design tokens live in `src/app/globals.css` (Light and Dark). Fills that carry white text use `accent-solid` / `danger-solid`; check new colour pairs against WCAG AA (4.5:1) in both themes. The Figma screens match these tokens.
