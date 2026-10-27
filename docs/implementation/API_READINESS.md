# API readiness and consumption map

Every READY_LOCAL row below is checked against backend OpenAPI and controller wiring, not a running deployment. Browser calls use the BFF cookie/session; no bearer/provider tokens in browser storage. Existing working consumers should be reused.

## READY_LOCAL browser contracts

| Method | Backend path | Browser/BFF path | Usage / boundary |
| --- | --- | --- | --- |
| GET | `/account/me` | `GET /api/me` | profile-client.ts; BFF enriches identity and maps role |
| PATCH | `/account/me` | `PATCH /api/me` | Browser role→profession; complete:true; name/timezone/outputsOnly |
| GET | `/usage/summary` | `GET /api/usage/summary` | Ready but no dedicated quota consumer yet: FE-U01 |
| GET | `/uploads/policy` | `GET /api/uploads/policy` | Existing policy hook; disabled/zero is expected |
| POST | `/uploads` | `POST /api/uploads` | sha256, contentType, sizeBytes, consent:true, optional title + operation key |
| POST | `/uploads/{id}/complete` | `POST /api/uploads/:uploadId/complete` | Upload ID, not capture ID; separate stable key; {} |
| GET | `/jobs/{id}` | `GET /api/jobs/:id` | Optional durable-job polling; unknown never auto-resubmits |
| POST | `/captures/meetings` | `POST /api/captures/meetings` | Explicit bounded duration/consent + stable key; returns id |
| GET | `/captures/{id}` | `GET /api/captures/:id` | Meeting state only; use library detail for full transcript |
| POST | `/captures/{id}/cancel` | `POST /api/captures/:id/cancel` | Cancellation request; preserve its pending state |
| POST | `/captures/{id}/retry` | `POST /api/captures/:id/retry` | Renewed consent/key; new capture; original preserved |
| GET | `/captures/{id}/audio` | `GET /api/captures/:id/audio` | Private url/expiresAt/contentType/sizeBytes; handle 410 |
| GET | `/library/search` | `GET /api/library/search` | Cursor, q/type/status/from/to/limit; English full-text |
| GET | `/library/captures/{id}` | `GET /api/library/captures/:id` | Current persisted transcript/version/speakers; survives raw expiry |
| PATCH | `/library/captures/{id}/transcript` | `PATCH /api/library/captures/:id/transcript` | Editor baseVersion→expectedVersion; exact retries and 409 |

The GET /transcripts/{captureId} alias also exists in Nest but `transcripts` is not in the BFF proxy allowlist; use library detail unless deliberately extending and testing the gateway. /health, /ready, /implementation and /implementation/data are operational/read-only routes, not browser product data. /webhooks/recall and /webhooks/assemblyai are provider-to-server callbacks, never browser consumers. Billing reconciliation is CLI-only.

## BFF-only auth routes

| Method/path | Owner |
| --- | --- |
| GET /api/auth/login | Next server/auth; returnTo and optional signup=1 |
| GET /api/auth/callback | Next server/auth; configured OIDC callback |
| POST /api/auth/logout | Next server/auth; JSON {all:boolean}, matching Origin |
| GET/PATCH /api/me | Next server/auth adapter to API /account/me |

## Not ready: do not claim consumption is complete

| Frontend demand / files | Actual boundary | Backend owner / request |
| --- | --- | --- |
| dashboard-client, dashboard widgets: GET /api/dashboard | No /dashboard endpoint. Full totals/upcoming/docs stats cannot be synthesized from a paginated library page. A separate quota widget can consume /usage/summary now. | B-DASH-01, M8 G02/G03 |
| avatar-client: POST /api/me/avatar, POST .../complete, DELETE .../avatar | No avatar API and `me/*` is not generically forwarded | B-AUTH-02, M1 A02 |
| ProfileView.avatarUrl/passwordUrl | Not guaranteed by backend profile or BFF view | B-AUTH-01, M1 A02/A03 |
| documents-client: captures/:id/documents, documents CRUD/versions/regenerate/section-regenerate | No document/LLM HTTP implementation; apparent editor/export UI is not generation support | M6 L01–L04; preserve gpt-4o-mini/redaction/budget gates |
| upload-client legacy delete/actions/dev/video calls | No DELETE capture, action extraction/update, simulation or video API; actions/dev not in proxy allowlist | M9 S02, M6 scope decision; leave unavailable |
| calendar-client + connections panel OAuth/agenda | No calendar API; connectDevCalendar is not real OAuth | M7 C01–C04/C09; direct Google/Microsoft OAuth + Recall, not Nylas |
| booking-client host CRUD/slots/bookings | No booking API; provider side effects must be idempotent | M7 C03/C05–C08 |
| booking-client anonymous public page/slots/book/manage/ICS | No public booking API; `public` proxy prefix rejected and generic proxy requires a session | M7 C05–C07; explicit anonymous capability-token route design required |
| plan-client /plan and account/deletion | No paid plan or account deletion API; /usage/summary is not a paid entitlement substitute | M2 E01–E07 blocked; M9 S02 |
| notifications-client + TopBar | No notifications API; prefix also not forwarded | B-NOTIFY-01, M9 planning |
| admin components /admin/* helper calls | No staff API; proxy allowlist does not authorize staff | M9/M2; signed operator billing CLI is not an admin endpoint |
| plan/test-checkout and /api/dev/checkout | No real checkout/dev handler; `dev` rejected by gateway | M2 blocked; never fake purchases/credits |

## Integration rules

- No local success fallback for missing endpoints, quota, purchases, recording/deletion or booking confirmation. Use explicit unavailable/loading/error states.
- Preserve async 202 semantics: queued is not transcribed. Keep consent, immutable bytes/checksum, ownership and retry keys.
- API sources are upload/meeting; UI adapter maps to audio_upload/meeting_url. Keep native admission_timeout/host_denied/reconciliation states distinct.
- Full transcript saves use expectedVersion; the current editor sends only changed lines/names. Handle 409 without discarding drafts. Transcript PATCH limit is 256 KiB end-to-end; normal JSON requests retain 16 KiB.
- Calendar/plan/admin/docs screens may be designed but remain BLOCKED, not IMPLEMENTED consumption. Record backend dependencies instead of filling them with fixture data in production.
