// Browser side of the upload flow: ask the API for a signed URL, PUT the file
// with progress, tell the API it finished, then poll processing status.

export interface TranscriptSegmentView {
  id: string;
  startMs: number;
  endMs: number;
  text: string;
  speakerId: string | null;
  editedByUser: boolean;
}

export type ActionStatus = "suggested" | "confirmed" | "dismissed" | "done";
export interface ActionItemView {
  id: string;
  text: string;
  status: ActionStatus;
  createdBy: "ai" | "user";
  /** The transcript line it came from, if that line still exists. */
  sourceSegmentId: string | null;
  sourceStartMs: number | null;
}
export interface ActionsView {
  state: "none" | "extracting" | "ready" | "failed";
  error: string | null;
  items: ActionItemView[];
}

export interface CaptureView {
  id: string;
  title: string | null;
  filename: string | null;
  createdAt: string;
  documents: Array<{ id: string; title: string; template: string; status: string; editedByUser: boolean; updatedAt: string }>;
  source: string;
  platform: string | null;
  status: string;
  provider: string | null;
  state: string;
  failureReason: string | null;
  transcript: TranscriptSegmentView[];
  /** Action items found in the conversation, for the Actions tab. */
  actions: ActionsView;
  /** The meeting assistant's timeline (meeting captures only). */
  events: Array<{ status: string; detail: string | null; at: string }>;
  /** Counter used to detect that someone else edited the transcript first; null until there is a transcript. */
  transcriptVersion: number | null;
  /** The user's names for the provider's speaker labels, e.g. { S1: "Maya" }. */
  speakerNames: Record<string, string>;
  /** A short-lived link to play the recording; null when there is none to play. */
  audio: { url: string; contentType: string; sizeBytes: number } | null;
  /** "unavailable" = the file is gone (removed or expired); the transcript and documents remain. */
  audioStatus: "available" | "unavailable" | "none";
  /** Whether video was asked for on this meeting. */
  recordVideo: boolean;
  /** A short-lived link to watch the meeting; null until it is saved (or if it has been removed). */
  video: { url: string; contentType: string; sizeBytes: number } | null;
  /** none: not asked for. requested/processing: on its way. ready. failed (see videoFailure). unavailable: removed, as the privacy settings say. */
  videoStatus: "none" | "requested" | "processing" | "ready" | "failed" | "unavailable";
  videoFailure: string | null;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    /** A machine-readable reason from the server, e.g. "version_conflict". */
    readonly code?: string,
  ) {
    super(message);
  }
}

export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      res.status === 401
        ? "You're not signed in. Sign-in isn't set up yet; for local development set DEV_AUTH_EMAIL."
        : ((body as { error?: string }).error ?? "Something went wrong. Please try again.");
    throw new ApiError(res.status, message, (body as { code?: string }).code);
  }
  return body as T;
}

function putWithProgress(url: string, blob: Blob, contentType: string, onProgress: (fraction: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total);
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new ApiError(xhr.status, xhr.status === 413 ? "The file is too large." : "The upload failed. Please try again."));
    xhr.onerror = () => reject(new ApiError(0, "The upload was interrupted. Check your connection and try again."));
    xhr.send(blob);
  });
}

export async function uploadAudio(
  input: { blob: Blob; filename: string; title: string; source: "voice_recording" | "audio_upload" },
  onProgress: (fraction: number) => void,
): Promise<string> {
  const contentType = input.blob.type || "application/octet-stream";
  const { captureId, uploadUrl } = await api<{ captureId: string; uploadUrl: string }>("/api/uploads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filename: input.filename,
      contentType: input.blob.type, // the server validates the browser-reported type (may be empty for some m4a files)
      sizeBytes: input.blob.size,
      title: input.title,
      source: input.source,
    }),
  });
  await putWithProgress(uploadUrl, input.blob, contentType, onProgress);
  await api(`/api/uploads/${captureId}/complete`, { method: "POST" });
  return captureId;
}

export interface CaptureListItem {
  id: string;
  source: string;
  title: string | null;
  platform: string | null;
  status: string;
  state: string;
  failureReason: string | null;
  createdAt: string;
}

export const listCaptures = (limit?: number, kind?: "meetings" | "recordings") => {
  const p = new URLSearchParams();
  if (limit) p.set("limit", String(limit));
  if (kind) p.set("kind", kind);
  const qs = p.toString();
  return api<{ captures: CaptureListItem[] }>(qs ? `/api/captures?${qs}` : "/api/captures").then((r) => r.captures);
};

export const requestMeetingCapture = (meetingUrl: string, consentConfirmed: boolean, title?: string, recordVideo = false) =>
  api<{ captureId: string; duplicate: boolean }>("/api/captures", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ meetingUrl, consentConfirmed, ...(title?.trim() ? { title: title.trim() } : {}), ...(recordVideo ? { recordVideo: true } : {}) }),
  });

export const cancelMeetingCapture = (id: string) => api<{ state: string }>(`/api/captures/${id}/cancel`, { method: "POST" });

export const getCapture = (id: string) => api<CaptureView>(`/api/captures/${id}`);

export const deleteCapture = (id: string) => api<void>(`/api/captures/${id}`, { method: "DELETE" });

const STATE_LABELS: Record<string, string> = {
  uploading: "Uploading",
  uploaded: "Uploaded",
  queued: "Queued",
  processing_audio: "Processing audio",
  transcribing: "Transcribing",
  generating_output: "Generating output",
  ready_to_review: "Ready to review",
  completed: "Completed",
  failed: "Failed",
  cancelled: "Cancelled",
};

const STATUS_LABELS: Record<string, string> = {
  requested: "Requested",
  scheduled: "Scheduled",
  joining: "Joining the meeting",
  waiting_for_admission: "Waiting to be let in",
  recording: "Recording",
  processing: "Processing",
  completed: "Completed",
  failed: "Failed",
  cancelled: "Cancelled",
};

export const statusLabel = (status: string) => STATUS_LABELS[status] ?? status;
const MEETING_ACTIVE = new Set(["requested", "scheduled", "joining", "waiting_for_admission", "recording", "processing"]);
export const isMeetingActive = (status: string) => MEETING_ACTIVE.has(status);

export const PLATFORM_LABELS: Record<string, string> = {
  google_meet: "Google Meet",
  microsoft_teams: "Microsoft Teams",
  zoom: "Zoom",
};

export const stateLabel = (state: string) => STATE_LABELS[state] ?? state;
export const isTerminal = (state: string) => state === "ready_to_review" || state === "completed" || state === "failed" || state === "cancelled";

export interface TranscriptEditInput {
  baseVersion: number;
  /** Only the lines that changed. */
  segments?: Array<{ id: string; text: string }>;
  /** Provider label -> display name; an empty name removes it. */
  speakers?: Record<string, string>;
}

/** Saves corrections. Throws ApiError with code "version_conflict" (409) if someone else edited first. */
export const saveTranscript = (id: string, edit: TranscriptEditInput) =>
  api<{ version: number; speakerNames: Record<string, string> }>(`/api/captures/${id}/transcript`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(edit),
  });

/** Sends the assistant again after a denial, timeout or failure. The user must confirm they may record, again. */
export const retryMeeting = (id: string, consentConfirmed: boolean) =>
  api<{ captureId: string; duplicate: boolean }>(`/api/captures/${id}/retry`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ consentConfirmed }),
  });

/** Development only: pretend the meeting provider reported this status. */
/** Development only: pretend the meeting provider says the video is ready (the worker then fetches it). */
export const simulateVideoReady = (id: string) =>
  api<{ queued: boolean }>(`/api/dev/captures/${id}/simulate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ media: "video" }) });

export const simulateMeetingStatus = (id: string, status: string) =>
  api<{ applied: boolean }>(`/api/dev/captures/${id}/simulate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });

/** Starts looking through the conversation for action items (runs in the background). */
export const findActions = (id: string) => api<{ state: string; alreadyRunning: boolean }>(`/api/captures/${id}/actions`, { method: "POST" });

export const setActionStatus = (id: string, status: ActionStatus) =>
  api<{ id: string; status: ActionStatus }>(`/api/actions/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
