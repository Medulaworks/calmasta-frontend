# Backend Prompt: Capture Video Toggle + Title Props

**Copy this prompt to the backend agent (calmasta-api).**

---

## Prompt for `calmasta-api`

> **Task:** Add `recordVideo` and `title` support to `POST /captures/meetings`.
>
> **Context:**
> - Frontend `capture-form.tsx` (`/dashboard/voice?tab=bot`) and `capture-menu.tsx` ("Add to live meeting" dialog) now send:
>   ```json
>   {
>     "meetingUrl": "https://meet.google.com/abc-defg-hij",
>     "maxDurationSeconds": 1800,
>     "consent": true,
>     "title": "Quarterly planning",
>     "recordVideo": true
>   }
>   ```
>   - `title` is optional, `string` max 200 chars. When `titleMode === "auto"` frontend omits `title` entirely (server should auto-generate).
>   - `recordVideo` is optional `boolean`, defaults `false`. UI shows:
>     > **Also record the video** — Off unless you choose it. Private to you, and removed on the same schedule as audio.
>     The consent text dynamically includes “, including its video,” when `recordVideo` is true.
>   - `maxDurationSeconds` default on frontend is now `30 * 60 = 1800` (was `60`). Frontend still respects `policy.maxMeetingDurationSeconds`.
>   - For voice recordings, frontend `upload-client.ts` `uploadAudio` already supports `title` (empty string = auto). No change needed there except ensure empty title is treated as auto-generated, not stored as empty string.
>
> **Required backend changes:**
>
> 1. **DTO** `src/modules/capture/capture.dto.ts` — `MeetingDto`:
>    ```ts
>    @ApiPropertyOptional({ description: 'Optional meeting title, auto-generated when omitted', maxLength: 200 })
>    @ValidateIf((_o, v) => v !== undefined)
>    @IsString()
>    @MaxLength(200)
>    title?: string;
>
>    @ApiPropertyOptional({ description: 'Also record video when true. Requires videoEnabled policy.', default: false })
>    @IsOptional()
>    @IsBoolean()
>    recordVideo?: boolean;
>    ```
>    Keep `meetingUrl`, `maxDurationSeconds`, `consent` as today. `recordVideo` should default to `false` when undefined.
>
> 2. **Policy / Config**:
>    - Ensure `CapturePolicy` response (`GET /uploads/policy`) already exposes `videoEnabled: boolean` (frontend checks `policy.videoEnabled` to allow video). If not, add it from config / feature flag.
>    - If `recordVideo === true` and `videoEnabled === false`, reject with `domain(400, 'video_not_enabled')` or `403` with message "Video recording is not enabled for this account yet." so frontend can surface it.
>
> 3. **Service** `src/modules/capture/capture.service.ts` `create()`:
>    - Normalize `title?.trim()` — store `title || 'Meeting'` as before, but preserve distinction: if provided, use it; if omitted, let existing auto-generation remain (or store as provided title).
>    - Persist `recordVideo` boolean to `captures` table. Add column `record_video BOOLEAN DEFAULT FALSE` via migration (e.g., `014_capture_video.sql`) if not present:
>      ```sql
>      ALTER TABLE captures ADD COLUMN IF NOT EXISTS record_video BOOLEAN NOT NULL DEFAULT FALSE;
>      ```
>    - Include `recordVideo` in idempotency hash: `JSON.stringify([meetingUrl, maxDurationSeconds, consent, title, recordVideo])` so same URL with/without video are distinct operations.
>    - Insert: `INSERT INTO captures(..., title, record_video) VALUES(..., $5, $6)` with `recordVideo ?? false`.
>    - Pass `recordVideo` to Recall provider if supported; otherwise store for later worker handling. If Recall requires separate flag, forward it in job payload.
>    - For `retry()`, carry forward `record_video` and `title` from original capture unless overridden.
>
> 4. **Read model** `get()`:
>    - Select `record_video AS "recordVideo"` and expose in API response so frontend `CaptureView.recordVideo` can be hydrated.
>    - Keep existing fields `title`, `video`, `videoStatus` handling.
>
> 5. **OpenAPI** regeneration:
>    - Run `pnpm run openapi` (or equivalent) to update `openapi/calmasta-api.json`. Verify `MeetingDto` shows `recordVideo` optional boolean and title optional string.
>
> 6. **Validation & Tests**:
>    - Add `class-validator` tests for title length 201 → 400, recordVideo not boolean → 400, recordVideo true when videoEnabled false → 400/403.
>    - Update existing meeting creation tests to cover idempotency with different `recordVideo` values.
>
> **Frontend expectations after backend is ready:**
> - Frontend `src/lib/upload-client.ts` `requestMeetingCapture(..., recordVideo)` will send `recordVideo:true` — currently it throws `if(recordVideo && !policy.videoEnabled)`. After backend ships, remove/relax that guard so video can be queued.
> - Frontend will show `recordVideo` state in history if `videoStatus` is exposed, but no immediate UI change required beyond the create path.
>
> **Acceptance:**
> - `POST /captures/meetings` with `{meetingUrl, maxDurationSeconds:1800, consent:true, title:"My Meeting", recordVideo:true}` returns 202 when video enabled, 400/403 when not enabled.
> - `POST` without `title` or `recordVideo` still succeeds (backwards compatible).
> - `GET /uploads/policy` includes `videoEnabled`.
> - Migration adds `record_video` column, idempotent.
> - OpenAPI reflects new fields.

---

## Frontend already shipped

- `src/components/capture-form.tsx` — default `durationMinutes=30`, title selector (Auto-generated / Choose a title), video toggle with privacy note, consent extends wording, submit now passes `title` and `recordVideo`.
- `src/lib/upload-client.ts` — `requestMeetingCapture` now accepts `recordVideo` and forwards `recordVideo:true` in body when true, gated by `policy.videoEnabled`.
- `src/components/voice-recorder.tsx` — title now uses Auto-generated / Choose a title selector (auto omits title).
- `src/components/shell/capture-menu.tsx` — already had these controls in dialog; now consistent with page.

No further frontend work needed once backend lands the DTO + column + policy check.
