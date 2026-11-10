export type MeetingState = "requested" | "queued" | "dispatched" | "joining" | "waiting_for_admission" | "admitted" | "recording" | "leave_requested" | "ended" | "failed" | "unknown";
export type MediaState = "none" | "not_requested" | "requested" | "processing" | "ready" | "failed" | "expired" | "unavailable";
export type TranscriptState = "queued" | "processing" | "ready" | "failed" | "skipped_empty" | "unknown";
export type TitleState = "pending" | "ready" | "failed" | "skipped_empty" | "unknown";
export type TitleMode = "auto" | "manual";

export interface CaptureOperationalView {
  id: string;
  displayKey: string;
  source: "meeting_url" | "upload" | "voice_recording";
  user: { id: string; name: string | null; email: string };
  workspaceId: string;
  recordVideo: boolean;
  createdAt: string;
  requestedMaxDurationSeconds: number | null;
  policyVersion: number | null;
  version: number;
  meeting: {
    state: MeetingState;
    botSentAt: string | null;
    admittedAt: string | null;
    recordingStartedAt: string | null;
    recordingEndedAt: string | null;
    callEndedAt: string | null;
    recordingDeadlineAt: string | null;
    leaveRequestedAt: string | null;
    stopReason: string | null;
  };
  audio: { state: MediaState };
  video: { state: MediaState };
  participants: { state: "pending" | "ready" | "unavailable" | "expired" | "failed"; count: number };
  transcription: { state: TranscriptState; startedAt: string | null; completedAt: string | null; errorCode?: string | null };
  title: { mode: TitleMode; state: TitleState };
  insights: { pending: number; ready: number; failed: number; unknown: number; requests: Array<{ id: string; kind: string; templateId: string | null; state: string; requestedAt: string; completedAt: string | null }> };
  billing: { state: string };
  freshness: { asOf: string; providerObservedAt: string | null; stale: boolean };
}

export interface CaptureListResponse {
  items: CaptureOperationalView[];
  nextCursor: string | null;
}

export interface CaptureEvent {
  sequence: number;
  type: string;
  occurredAt: string;
  observedAt: string;
  source: string;
  reason: string | null;
  supportReference?: string | null;
}

export interface CostItem {
  operationId: string;
  attemptId: string;
  kind: string;
  templateId?: string | null;
  provider: string;
  model?: string | null;
  units?: number | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  estimatedMicros: string | null;
  reservedMicros: string | null;
  providerReportedMicros: string | null;
  reconciledMicros: string | null;
  state: string;
  basis?: string | null;
  occurredAt: string;
}

export interface CostSummary {
  currency: string;
  estimatedMicros: string | null;
  reservedMicros: string | null;
  providerReportedMicros: string | null;
  reconciledMicros: string | null;
  completeness: "partial" | "complete" | "unknown";
  missingComponentCount: number;
  asOf: string;
  items: CostItem[];
}

export interface ActivityEntry {
  id: string;
  at: string;
  actor: string | null;
  actorId?: string | null;
  scope: string;
  action: string;
  target: string | null;
  result: string;
}

export const DISPLAY_KEY_RE = /^JB-(MTG|REC)-\d{8}T\d{6,9}Z-[a-f0-9-]+$/i;

export function isValidDuration(defaultSeconds: number, maxSeconds: number): string | null {
  if (!Number.isInteger(defaultSeconds) || !Number.isInteger(maxSeconds)) return "Durations must be whole seconds.";
  if (defaultSeconds < 30) return "Default must be at least 30 seconds.";
  if (maxSeconds > 7200) return "Maximum cannot exceed 7200 seconds (120 minutes).";
  if (defaultSeconds > maxSeconds) return "Default cannot exceed maximum.";
  return null;
}
