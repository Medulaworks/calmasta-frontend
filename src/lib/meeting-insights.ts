import { ApiError } from "./upload-client";
import type { InsightArtifact, InsightKind, InsightRequest, MeetingInsights, MeetingQuestion } from "./meeting-insights-client";

const active = new Set(["pending", "queued", "running"]);
const reasons: Record<string, string> = {
  summary_templates_not_ready:"Summary formats aren’t available yet.",
  insight_generation_in_progress:"Another summary is still processing. You can view a saved format while it finishes.",
  invalid_summary_template:"This summary format is unavailable.",
  insight_provider_not_configured: "Meeting insights aren’t set up yet. Please contact support.",
  insight_cost_not_configured: "Meeting insights aren’t set up yet. Please contact support.",
  insight_cost_limit_exceeded: "This is more than we can process at once. Please contact support.",
  insight_input_too_large: "This transcript is too long for meeting insights.",
  quota_exceeded: "You’ve used all your processing time for this month.",
  quota_parent_unavailable: "We can’t check your processing time right now. Please try again shortly.",
  spend_guard_exceeded: "Processing is paused for a short while.",
  usage_reconciliation_required: "Processing is on hold while we look into it. Please try again later.",
  insight_admission_failed: "We couldn’t start processing. Contact support if this keeps happening.",
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
    if (error.status === 403) return "Verify your email address to use this.";
    if (error.status === 404) return "Meeting insights aren’t available for this recording right now.";
    if (error.status === 409) return reasons.transcript_not_ready;
    if (error.status === 503) return "Meeting insights are temporarily unavailable. Try refreshing later.";
  }
  return "We couldn’t load or save meeting insights. Please try again.";
}
export function insightMessage(artifact: Pick<InsightRequest, "state" | "failureReason">): string {
  switch (artifact.state) {
    case "pending": return "Waiting to start.";
    case "queued": return "Queued for processing.";
    case "running": return "Processing meeting insights.";
    case "ready": return "Ready to review.";
    case "blocked": return artifact.failureReason && Object.hasOwn(reasons, artifact.failureReason) ? reasons[artifact.failureReason] : "Something needs attention. Please contact support before trying again.";
    case "failed": return artifact.failureReason==="insight_dispatch_blocked"?"Processing did not start. You can try again.":artifact.failureReason==="insight_summary_format_changed"?"A newer summary format is available. Generate a current recap when you are ready.":"This stopped before it finished, and it won’t be retried automatically.";
    case "reconciliation_required": return "We’re not sure whether this finished. We’re looking into it and won’t retry automatically.";
    default: return "Processing status is unavailable. Refresh to check again.";
  }
}
export function canRequestInsight(data: MeetingInsights, kind: InsightKind): boolean {
  if (!data.enabled || !data.liveProcessingEnabled || !data.transcriptReady || (kind === "questions" && !data.questionsOnDemand)) return false;
  const artifact = data[kind];
  if(artifact&&["queued","running","reconciliation_required"].includes(artifact.state))return false;
  return !artifact || artifact.isStale || artifact.state === "blocked" || (artifact.state === "failed" && artifact.failureReason === "insight_dispatch_blocked");
}
export function insightsPollInterval(data: MeetingInsights | undefined, failures: number, error?: unknown): number | false {
  if (error instanceof ApiError && [401, 403, 404, 409, 503].includes(error.status)) return false;
  if (!data?.enabled || !data.liveProcessingEnabled || (![data.recap, data.questions,data.summary?.artifact].some(a => a && active.has(a.state))&&!active.has(data.activeRecap?.state??""))) return false;
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
  unknown: "We’re not sure the email was delivered, and we won’t send it again automatically.",
  skipped: "Completion email was skipped.",
};
