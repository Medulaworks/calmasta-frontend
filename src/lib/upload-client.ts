// Browser side of the upload flow: ask the API for a signed URL, PUT the file
// with progress, tell the API it finished, then poll processing status.

export interface TranscriptSegmentView {
  id: string;
  startMs: number;
  endMs: number;
  text: string;
  speakerId: string | null;
}

export interface CaptureView {
  id: string;
  title: string | null;
  filename: string | null;
  createdAt: string;
  documents: Array<{ id: string; title: string; template: string; status: string; updatedAt: string }>;
  source: string;
  platform: string | null;
  status: string;
  provider: string | null;
  state: string;
  failureReason: string | null;
  transcript: TranscriptSegmentView[];
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      res.status === 401
        ? "You're not signed in. Sign-in isn't set up yet; for local development set DEV_AUTH_EMAIL."
        : ((body as { error?: string }).error ?? "Something went wrong. Please try again.");
    throw new ApiError(res.status, message);
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

export const listCaptures = (limit?: number) =>
  api<{ captures: CaptureListItem[] }>(limit ? `/api/captures?limit=${limit}` : "/api/captures").then((r) => r.captures);

export const requestMeetingCapture = (meetingUrl: string, consentConfirmed: boolean) =>
  api<{ captureId: string; duplicate: boolean }>("/api/captures", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ meetingUrl, consentConfirmed }),
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
