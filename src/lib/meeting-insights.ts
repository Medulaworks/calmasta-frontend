import { ApiError } from "./upload-client";
import type { InsightArtifact, InsightKind, InsightRequest, MeetingInsights, MeetingQuestion } from "./meeting-insights-client";

const active = new Set(["pending", "queued", "running"]);
const reasons: Record<string, string> = {
  insight_provider_not_configured: "Meeting insights need to be configured by the service owner.",
  insight_cost_not_configured: "Meeting insights need to be configured by the service owner.",
  insight_cost_limit_exceeded: "This request exceeds the processing limit. Contact support.",
  insight_input_too_large: "This transcript is too large for meeting insights.",
  quota_exceeded: "Your processing allowance is used up.",
  quota_parent_unavailable: "Your processing allowance is temporarily unavailable.",
  spend_guard_exceeded: "Processing is temporarily paused by the service owner.",
  usage_reconciliation_required: "Processing needs operator review before more work can start.",
  insight_admission_failed: "Processing could not be admitted. Contact support if this continues.",
  transcript_not_ready: "The transcript is not ready yet.",
  meeting_insights_disabled: "Meeting insights are currently unavailable.",
  email_not_verified: "Verify your email address to use meeting insights.",
  workspace_owner_required: "Only the workspace owner can change this preference.",
};
export function insightErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return "Your session ended. Please sign in again.";
    const reason = error.code ?? error.message;
    if (Object.hasOwn(reasons, reason)) return reasons[reason];
    if (error.status === 403) return "A verified email and access to this workspace are required.";
    if (error.status === 404) return "This recording or meeting insights service is unavailable.";
    if (error.status === 409) return reasons.transcript_not_ready;
    if (error.status === 503) return "Meeting insights are temporarily unavailable. Try refreshing later.";
  }
  return "Could not load or save meeting insights. Please try again.";
}
export function insightMessage(artifact: Pick<InsightRequest, "state" | "failureReason">): string {
  switch (artifact.state) {
    case "pending": return "Awaiting processing admission.";
    case "queued": return "Queued for processing.";
    case "running": return "Processing meeting insights.";
    case "ready": return "Ready to review.";
    case "blocked": return artifact.failureReason && Object.hasOwn(reasons, artifact.failureReason) ? reasons[artifact.failureReason] : "Processing needs attention. Contact support before trying again.";
    case "failed": return artifact.failureReason==="insight_summary_format_changed"?"A newer summary format is available. Generate a current recap when you are ready.":"Generation stopped. This transcript version will not be retried automatically.";
    case "reconciliation_required": return "The processing outcome is uncertain. Operator review is required; no request will be retried automatically.";
    default: return "Processing status is unavailable. Refresh to check again.";
  }
}
export function canRequestInsight(data: MeetingInsights, kind: InsightKind): boolean {
  if (!data.enabled || !data.liveProcessingEnabled || !data.transcriptReady || (kind === "questions" && !data.questionsOnDemand)) return false;
  const artifact = data[kind];
  if(artifact&&["queued","running","reconciliation_required"].includes(artifact.state))return false;
  return !artifact || artifact.isStale || artifact.state === "blocked";
}
export function insightsPollInterval(data: MeetingInsights | undefined, failures: number, error?: unknown): number | false {
  if (error instanceof ApiError && [401, 403, 404, 409, 503].includes(error.status)) return false;
  if (!data?.enabled || !data.liveProcessingEnabled || ![data.recap, data.questions].some(a => a && active.has(a.state))) return false;
  return Math.min(3000 * 2 ** Math.min(failures, 4), 30000);
}
export function questionStartMs(question: MeetingQuestion): number | null {
  return question.sources.find(s => Number.isFinite(s.startMs) && s.startMs >= 0)?.startMs ?? null;
}
export function seekInsightAudio(audio: Pick<HTMLMediaElement, "readyState" | "duration" | "currentTime" | "focus"> | null, startMs: number): boolean {
  if (!audio || audio.readyState < 1 || !Number.isFinite(startMs) || startMs < 0) return false;
  audio.currentTime = Math.min(startMs / 1000, Number.isFinite(audio.duration) ? audio.duration : Infinity);
  audio.focus();
  return true;
}
export const emailStatusMessage: Record<InsightArtifact<unknown>["emailStatus"], string | null> = {
  not_requested: null,
  pending: "Completion email is pending.",
  sending: "Completion email is being sent.",
  sent: "Completion email was sent.",
  unknown: "Email delivery is uncertain and will not be retried automatically.",
  skipped: "Completion email was skipped.",
};
