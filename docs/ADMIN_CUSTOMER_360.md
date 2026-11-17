# Admin Customer 360 — tabbed customer detail page

Page: `/admin/customers/:id` (frontend repo `calmasta-frontend`), data: `calmasta-api` admin endpoints.
Goal: when staff open a customer, one page answers *who is this user, what do they own, what have they done, what is stuck, and what have staff done to them* — without exposing private content.

## Privacy boundary (applies to every tab)

Admins see operational metadata only, matching the existing meeting-admin contract (`CaptureOperationalView`):
never transcript/document text, meeting URLs, audio/video URLs or playback, or generated note content.
Titles are represented by `displayKey` (`JB-REC-…` / `JB-MTG-…`), source, state and timings — not user title text.

## Page structure

Persistent header: name, email, badges (Active/Suspended, Email confirmed, Admin/staff, deletion pending),
joined, last active, and the existing Actions menu (edit profile, suspend/reactivate, revoke sessions, send verification/recovery).

### Tabs

| Tab | Contents | Source |
|---|---|---|
| Account | Identity: user id, email + verified, name, timezone, profession, onboarded, outputs-only, audio retention days, providers (`user_identities`), staff role. Security & lifecycle: suspended at/reason, active/total sessions, last session, deletion request (status, requested/completed). Preferences: recap-email enabled, capture preferences state. Summary tiles: captures by source, documents, insights ready, workspaces. | `users`, `user_profiles`, `user_identities`, `auth_sessions`, `deletion_requests`, `user_capture_preferences` |
| Workspaces | Per workspace: id, plan, role, owner, processing paused, created, member count; current-period usage (used/reserved/limit seconds); credit packs (sku, granted/consumed/reserved, expires, state); capture counts by state; calendar connection providers. | `workspaces`, `workspace_members`, `quota_periods`, `commerce_credit_grants`, `captures`, `calendar_connections` |
| Activities | Every capture/activity for the user across all owned/member workspaces, newest first: timestamp, activity id (`displayKey` + capture id), type — Meeting bot / Audio upload (incl. voice recording) / Transcript import — status (capture state + transcription stage + video stage), duration, workspace, failure reason, link to `/admin/captures/:id`. Below/beside: user-action timeline (`capture_requested`, `transcript_edited`, sharing, insight, booking actions) from the existing activity endpoint. Cursor pagination + Load more. | `GET /admin/captures?userId=` (operational view), `GET /admin/customers/:id/activity` (`capture_activity`) |
| Usage & Plan | Per workspace: current quota period, used/reserved minutes, credit grants history, recent commerce order ids/skus/states. Cost totals only when staff has `cost_read`. | `quota_periods`, `commerce_credit_grants`, `commerce_order_bindings` |
| Processing | Recent jobs (kind, state, attempts, last error, provider, updated) + counts of failed/unknown/dead-letter — the tab that explains stuck transcribing/bot/AI work. | `jobs` |
| More | Calendars (provider, account, status, calendar count), Booking (pages/types/bookings counts), Documents & insights counts by state (no content), Admin history (staff actions on this user: actor, action, reason, at). | `calendar_connections`, booking tables, `documents`, `meeting_insights`, `admin_audit_events` |

Suggestions included beyond the original ask: Usage & Plan, Processing, and Admin history tabs, plus account summary tiles, because support/debugging (“why is this user stuck / what did we do to their account”) needs them.

## API

- `GET /admin/customers/:id` — enriched in place, backward compatible (`{user, workspaces}` kept):
  adds `user.providers/preferences`, `sessions`, `deletion`, `totals`, `connections`, `recentJobs`, `adminHistory`,
  and per-workspace `usage`, `credits`, `captureCounts`, `memberCount`, `createdAt`.
- `GET /admin/captures?userId=<id>` — already exists (operational list). Frontend client parameter aligned: it previously sent `customerId`, which the backend ignores; it now sends `userId`. Backend also accepts `customerId` as an alias.
- `GET /admin/customers/:id/activity` — already exists (`capture_activity` stream); the page now uses it.

All reads require staff auth (`capture_read` where capture data is involved, `cost_read` for cost totals); responses are environment-scoped for captures/jobs exactly like the existing admin captures endpoints. No new write actions.

## Verification

Backend: `test/admin-customers.test.cjs` covers enriched detail shape, per-workspace usage/credits, activity captures filtering by user, and that private fields (title text, meeting URL, transcript text) never appear.
Frontend: typecheck/build; Activities tab renders captures + timeline, other tabs render from the enriched payload.
