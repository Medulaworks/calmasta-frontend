# Frontend Video/Playback Backend Request

## Symptom
Frontend `POST /api/captures/meetings` with `{ recordVideo: true }` returns:

```
400 Video recording is not enabled for this account yet.
code: video_not_enabled
```

Backend `capture.service.ts` guards with `config.videoEnabled` which is `env.CAPTURE_VIDEO_ENABLED === 'true'` (see `common/config.ts`).

Also: when `recordVideo:true` succeeds, the capture detail page
`GET /api/library/captures/:id` should expose a playable video, and the generic
`GET /api/library/captures/:id` audio link should also resolve.

## What frontend already does
- `src/lib/upload-client.ts:requestMeetingCapture` checks `policy.videoEnabled` from `GET /api/uploads/policy` and sends `recordVideo:true` when checked.
- `src/components/capture-form.tsx` "Also record the video" checkbox now sends 30 min default.
- `src/components/capture-detail.tsx` recording tab:
  - if `cap.recordVideo` and `cap.video.url` → `<video controls src=…>` via `MeetingVideo`.
  - if `cap.audio?.url` → `<audio controls src=…>` for voice uploads; meeting branch currently shows meeting-only text.
- `src/lib/upload-client.ts:getCapture` now preserves `video`, `videoStatus`, `audio`, `platform`, `botName`, `meetingUrl`, `durationSeconds`, `events`.

## Requested backend changes (all non-breaking)

1. **Enable flag** – set `CAPTURE_VIDEO_ENABLED=true` in the deployed API environment (staging + prod) and verify `GET /api/uploads/policy` returns `videoEnabled:true`.

2. **Meeting capture with video** – ensure `POST /captures/meetings` with `recordVideo:true` creates a `captures.record_video=true` row and a recall job that requests video, when `videoEnabled` is true. Return the same shape as non-video.

3. **Capture detail playback contract** – ensure `GET /library/captures/:id` for a meeting capture returns (when available):
   - `platform` (`google_meet` | `microsoft_teams` | `zoom` …)
   - `botName`, `meetingUrl`/`meeting_url`, `durationSeconds`/`duration_seconds`
   - `participants?: Array<{name, role}>`, `metadata?: Record<string,unknown>`
   - `events: Array<{status, detail, at}>`
   - `audio: {url, contentType, sizeBytes} | null` + `audioStatus` (`available`|`unavailable`|`none`)
   - `video: {url, contentType, sizeBytes} | null` + `videoStatus` (`none`|`requested`|`processing`|`ready`|`failed`|`unavailable`) + `videoFailure`
   Signed URLs must be short-lived and via the same BFF proxy as audio (`/api/captures/:id/audio` style, or inline in `video.url` as today).

4. **Video lifecycle** – Recall webhook should transition `videoStatus` `requested → processing → ready` (with `video.url`) or `failed`/`unavailable` per privacy retention. Detail page already handles all those states in `MeetingVideo`.

5. **Playback page expectations** – frontend already shows:
   - `_if video_:` `<video controls>` when `recordVideo && video.url`
   - `_if audio_:` `<audio controls>` for any capture with `audio.url`
   No new backend endpoint needed if detail continues to embed `video`/`audio`.

## How to verify
- `GET /api/uploads/policy` → `{"videoEnabled": true, ...}`
- Create meeting with checkbox ticked → 201, no `video_not_enabled`
- `GET /api/library/captures/<id>` after worker → `videoStatus:"ready"` + `video.url` works in `<video>`, and `audio.url` works in `<audio>`
- Privacy expiry → `videoStatus:"unavailable"` and `audioStatus:"unavailable"` still leaves transcript/documents.

## Toggle suggestion if permanent enable is not desired
Add a per-workspace toggle or keep the global flag but expose it so operator can flip it without deploy (e.g., admin UI or env). Frontend does not need a new contract; policy already drives the checkbox.
