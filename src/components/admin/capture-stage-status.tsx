"use client";
import { Badge } from "@/components/ui/badge";
import { fmtUtc } from "@/lib/admin-client";
import type { CaptureOperationalView } from "@/lib/capture-admin-types";

/** "waiting_for_admission" -> "Waiting to be let in". Anything unknown reads as a sentence. */
const WORDS: Record<string, string> = {
  waiting_for_admission: "Waiting to be let in", joining: "Joining", admitted: "In the meeting", recording: "Recording", ended: "Ended", completed: "Finished",
  failed: "Failed", ready: "Ready", unknown: "Not known", requested: "Requested", pending: "Waiting", not_started: "Not started", processing: "In progress",
};
export const stateLabel = (state: string) => WORDS[state] ?? state.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
export const stateTone = (state: string) => (state === "failed" ? "danger" : state === "ready" || state === "recording" || state === "admitted" || state === "completed" ? "success" : state === "unknown" || state === "ended" ? "neutral" : "info") as "danger" | "success" | "neutral" | "info";

function StageCard({ title, state, label, at, extra }: { title: string; state: string; label?: string; at?: string | null; extra?: string | null }) {
  return (
    <div className="rounded-2xl border border-border bg-background p-5 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">{title}</p>
        <Badge tone={stateTone(state)}>{label ?? stateLabel(state)}</Badge>
      </div>
      <p className="mt-3 text-xs text-muted">{at ? fmtUtc(at) : "No time recorded"}</p>
      {extra && <p className="mt-1 text-xs text-muted">{extra}</p>}
    </div>
  );
}

export function CaptureStageStatus({ cap }: { cap: CaptureOperationalView }) {
  const overdue = cap.freshness.stale;
  const deadline = cap.meeting.recordingDeadlineAt;
  return (
    <div className="space-y-3">
      {overdue && <p role="status" className="rounded-xl border border-warning/30 bg-warning/5 px-4 py-3 text-sm text-warning">This information may be out of date. Last checked {fmtUtc(cap.freshness.asOf)}.</p>}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <StageCard title="Meeting bot" state={cap.meeting.state} at={cap.meeting.recordingStartedAt ?? cap.meeting.admittedAt ?? cap.meeting.botSentAt} extra={cap.meeting.stopReason ?? (deadline ? `Stops by ${fmtUtc(deadline)}` : null)} />
        <StageCard title="Audio" state={cap.audio.state} />
        <StageCard title="Video" state={cap.video.state} />
        <StageCard title="Transcript" state={cap.transcription.state} at={cap.transcription.completedAt ?? cap.transcription.startedAt} />
        <StageCard title="Automatic title" state={cap.title.state} />
        <StageCard title="Meeting insights" state={cap.insights.failed > 0 ? "failed" : cap.insights.pending > 0 ? "pending" : cap.insights.ready > 0 ? "ready" : "unknown"} label={`${cap.insights.ready} ready · ${cap.insights.pending} waiting · ${cap.insights.failed} failed`} />
      </div>
      {cap.meeting.leaveRequestedAt && <p className="text-xs text-muted">Stop requested at {fmtUtc(cap.meeting.leaveRequestedAt)}. The meeting isn’t marked as ended until that is confirmed.</p>}
    </div>
  );
}
