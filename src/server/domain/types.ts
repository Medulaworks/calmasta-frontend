// MyJooba-owned domain model (blueprint §14). Provider IDs are references,
// never primary keys. Keep these types provider-neutral.

export type Id = string;
export type IsoInstant = string; // UTC instant, e.g. 2026-10-15T09:30:00Z

/** Processing states shown to the user (blueprint §12.3). */
export type ProcessingState =
  | "draft"
  | "uploading"
  | "uploaded"
  | "queued"
  | "processing_audio"
  | "transcribing"
  | "generating_output"
  | "ready_to_review"
  | "completed"
  | "needs_attention"
  | "failed"
  | "deleting";

/** MeetingBot lifecycle (blueprint §4.5). */
export type CaptureStatus =
  | "requested"
  | "scheduled"
  | "joining"
  | "waiting_for_admission"
  | "recording"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled";

export type CaptureSource = "meeting_url" | "voice_recording" | "audio_upload";

export type MeetingPlatform = "google_meet" | "microsoft_teams" | "zoom";

export interface Capture {
  id: Id;
  ownerId: Id;
  workspaceId: Id | null;
  source: CaptureSource;
  meetingUrl: string | null;
  platform: MeetingPlatform | null;
  provider: string | null;
  status: CaptureStatus;
  state: ProcessingState;
  createdAt: IsoInstant;
}

export interface TranscriptSegment {
  id: Id;
  startMs: number;
  endMs: number;
  text: string;
  speakerId: string | null;
  confidence: number | null;
  language: string | null;
  editedByUser: boolean;
}

export interface Transcript {
  id: Id;
  captureId: Id;
  provider: string;
  model: string | null;
  version: number;
  language: string | null;
  segments: TranscriptSegment[];
}

export type DocumentTemplate =
  | "clean_notes"
  | "summary_and_actions"
  | "consultant_brief"
  | "project_brief"
  | "meeting_minutes"
  | "follow_up_email"
  | "content_draft";

/** Actions start as suggestions; user confirms before any external side effect (blueprint §7.4). */
export type ActionItemStatus = "suggested" | "confirmed" | "done" | "dismissed";

export interface ActionItem {
  id: Id;
  documentId: Id;
  description: string;
  owner: string | null; // only when identifiable in the source
  dueDate: string | null; // only when explicit in the source
  status: ActionItemStatus;
  sourceSegmentId: Id | null;
  createdBy: "ai" | "user";
}
