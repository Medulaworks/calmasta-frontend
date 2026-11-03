import { api } from "./upload-client";

export type InsightKind = "recap" | "questions";
export type InsightState = "pending" | "queued" | "running" | "ready" | "blocked" | "failed" | "reconciliation_required";
export type EmailStatus = "not_requested" | "pending" | "sending" | "sent" | "unknown" | "skipped";
export interface RecapResult {
  briefSummary: string;
  detailedSummary: string;
  highlights: string[];
  decisions: string[];
  nextSteps: string[];
}
export interface MeetingQuestion {
  text: string;
  sources: { segmentId: string; startMs: number; endMs: number; speakerId: string | null }[];
}
export interface QuestionsResult {
  coverage: "ai_extraction_not_guaranteed_exhaustive";
  questions: MeetingQuestion[];
}
/** UI projection; provider accounting fields deliberately stay out of normal UI. */
export interface InsightArtifact<Result> {
  id: string;
  state: InsightState;
  transcriptVersion: number;
  isStale: boolean;
  result: Result | null;
  failureReason: string | null;
  emailStatus: EmailStatus;
  updatedAt: string;
}
export interface MeetingInsights {
  captureId: string;
  transcriptVersion: number | null;
  transcriptReady: boolean;
  enabled: boolean;
  liveProcessingEnabled: boolean;
  autoRecapEnabled: boolean;
  questionsOnDemand: boolean;
  recap: InsightArtifact<RecapResult> | null;
  questions: InsightArtifact<QuestionsResult> | null;
}
export interface InsightRequest {
  id: string;
  state: InsightState;
  failureReason: string | null;
}
export interface MeetingPreferences {
  recapEmailEnabled: boolean;
  emailVerified: boolean;
  canReceiveRecapEmail: boolean;
}
export const getMeetingInsights = (id: string, signal?: AbortSignal) =>
  api<MeetingInsights>(`/api/captures/${encodeURIComponent(id)}/insights`, { signal });
export const requestMeetingInsight = (id: string, kind: InsightKind) =>
  api<InsightRequest>(`/api/captures/${encodeURIComponent(id)}/${kind}`, { method: "POST" });
export const getMeetingPreferences = (signal?: AbortSignal) =>
  api<MeetingPreferences>("/api/account/me/meeting-preferences", { signal });
export const saveMeetingPreferences = (recapEmailEnabled: boolean) =>
  api<MeetingPreferences>("/api/account/me/meeting-preferences", {
    method: "PATCH", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ recapEmailEnabled }),
  });
