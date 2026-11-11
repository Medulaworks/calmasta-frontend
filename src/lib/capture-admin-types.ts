export type MeetingState = "requested" | "queued" | "dispatched" | "joining" | "waiting_for_admission" | "admitted" | "recording" | "leave_requested" | "ended" | "failed" | "unknown";
export type MediaState = "none" | "not_requested" | "requested" | "processing" | "ready" | "failed" | "expired" | "unavailable";
export type TranscriptState = "queued" | "processing" | "ready" | "failed" | "skipped_empty" | "unknown";
export type TitleState = "pending" | "ready" | "failed" | "skipped_empty" | "unknown";
export type TitleMode = "auto" | "manual";

export type RosterState = "pending" | "ready" | "unavailable" | "expired" | "failed";

export interface RosterParticipant {
  id: string;
  displayName: string;
  role: string | null;
  joinedAt: string | null;
  leftAt: string | null;
}

export interface RosterView {
  rosterState: RosterState;
  participants: RosterParticipant[];
  rosterAsOf: string | null;
}

/** Sanitize untrusted provider displayName — strip markup chars, trim, clamp to 200. */
export function sanitizeDisplayName(value: string): string {
  return value.replace(/[<>'"`]/g, "").slice(0, 200).trim();
}

export function isRosterState(value: string): value is RosterState {
  return ["pending", "ready", "unavailable", "expired", "failed"].includes(value);
}

// Minimal fixture participants — safe text only, no provider secrets or emails.
export const fixtureRoster: RosterView = {
  rosterState: "ready",
  rosterAsOf: "2026-11-10T12:00:00.000Z",
  participants: [
    { id: "p_abc123", displayName: "Alex Rivera", role: "host", joinedAt: "2026-11-10T12:01:00.000Z", leftAt: "2026-11-10T12:31:00.000Z" },
    { id: "p_def456", displayName: "Sam Chen", role: "guest", joinedAt: "2026-11-10T12:02:00.000Z", leftAt: null },
  ],
};

export const fixtureCost: CostSummary = {
  currency: "USD",
  estimatedMicros: "2500000",
  reservedMicros: "10000000",
  providerReportedMicros: null,
  reconciledMicros: null,
  completeness: "partial",
  missingComponentCount: 1,
  asOf: "2026-11-10T12:00:00.000Z",
  items: [
    {
      operationId: "00000000-0000-4000-8000-000000000001",
      attemptId: "00000000-0000-4000-8000-000000000002",
      kind: "bot",
      templateId: null,
      provider: "recall",
      model: null,
      units: null,
      inputTokens: null,
      outputTokens: null,
      estimatedMicros: "2500000",
      reservedMicros: "10000000",
      providerReportedMicros: null,
      reconciledMicros: null,
      state: "reserved",
      basis: "ceiling_micros_per_hour",
      occurredAt: "2026-11-10T12:00:00.000Z",
    },
  ],
};

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
  participants: { state: RosterState; count: number | null; rosterState?: RosterState; participants?: RosterParticipant[] };
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
