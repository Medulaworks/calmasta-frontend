"use client";
import { Badge } from "@/components/ui/badge";
import { fmtUtc } from "@/lib/admin-client";
import type { CaptureOperationalView } from "@/lib/capture-admin-types";

function StageCard({ title, state, at, extra }: { title: string; state: string; at?: string | null; extra?: string | null }) {
  const tone = state === "failed" ? "danger" : state === "ready" || state === "recording" || state === "admitted" ? "success" : state === "unknown" ? "neutral" : "info";
  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">{title}</p>
        <Badge tone={tone as never}>{state}</Badge>
      </div>
      {at ? <p className="mt-2 text-xs text-muted">{fmtUtc(at)}</p> : <p className="mt-2 text-xs text-muted">Not observed</p>}
      {extra && <p className="mt-1 text-xs text-muted">{extra}</p>}
    </div>
  );
}

export function CaptureStageStatus({ cap }: { cap: CaptureOperationalView }) {
  const overdue = cap.freshness.stale;
  const deadline = cap.meeting.recordingDeadlineAt;
  return (
    <div className="space-y-3">
      {overdue && <p role="status" className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">Provider observation is stale (as of {fmtUtc(cap.freshness.asOf)}).</p>}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        <StageCard title="Meeting / Bot" state={cap.meeting.state} at={cap.meeting.recordingStartedAt ?? cap.meeting.admittedAt ?? cap.meeting.botSentAt} extra={cap.meeting.stopReason ?? (deadline ? `Deadline ${fmtUtc(deadline)}` : null)} />
        <StageCard title="Audio" state={cap.audio.state} />
        <StageCard title="Video" state={cap.video.state} />
        <StageCard title="Transcript" state={cap.transcription.state} at={cap.transcription.completedAt ?? cap.transcription.startedAt} />
        <StageCard title="Auto title" state={cap.title.state} extra={`Mode ${cap.title.mode}`} />
        <StageCard title="Insights" state={`${cap.insights.ready} ready · ${cap.insights.pending} pending · ${cap.insights.failed} failed`} />
      </div>
      {cap.meeting.leaveRequestedAt && <p className="text-xs text-muted">Stop requested at {fmtUtc(cap.meeting.leaveRequestedAt)} — not “Meeting ended”.</p>}
      {cap.freshness.providerObservedAt && <p className="text-xs text-muted">Provider observed {fmtUtc(cap.freshness.providerObservedAt)} · local {fmtUtc(cap.freshness.asOf)}</p>}
    </div>
  );
}
