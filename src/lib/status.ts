// One place that turns internal states into the words and colours users see.
// Never show a success state until the work is really done (blueprint §12.3).

import type { Indicator } from "@/components/ui/status-indicator";

export type Tone = "neutral" | "info" | "success" | "warning" | "danger";
export interface StatusView {
  label: string;
  tone: Tone;
  /** True while work is still happening, so lists can show activity and keep refreshing. */
  active: boolean;
  /** Which animated mark the badge shows for this stage, if it has one. */
  indicator?: Indicator;
}

const MEETING_ACTIVE = new Set(["requested", "queued", "scheduled", "joining", "waiting_for_admission", "recording", "processing"]);

const MEETING_LABELS: Record<string, string> = {
  queued: "Queued",
  requested: "Requested",
  scheduled: "Scheduled",
  joining: "Joining the meeting",
  waiting_for_admission: "Waiting to be let in",
  recording: "Recording",
  processing: "Meeting ended",
};

const RECORDING_LABELS: Record<string, string> = {
  uploading: "Uploading",
  uploaded: "Uploaded",
  queued: "Queued",
  processing_audio: "Processing audio",
  transcribing: "Transcribing",
  processing: "Transcribing",
  media_pending: "Saving recording",
  recorded: "Waiting for transcription",
};

export function captureStatus(c: { source: string; state: string; status: string }): StatusView {
  if(c.state==="reconciliation_required")return {label:"Needs attention",tone:"warning",active:false};
  if(c.state==="transcription_failed")return {label:"Transcription failed",tone:"danger",active:false};
  if(c.state==="host_denied")return {label:"Host declined",tone:"warning",active:false};
  if(c.state==="admission_timeout")return {label:"Not let in in time",tone:"warning",active:false};
  if(["media_pending","recorded"].includes(c.state))return {label:c.state==="recorded"?"Waiting for transcription":"Saving recording",tone:"info",active:true,indicator:"spinner"};
  if (c.state === "cancelled" || c.status === "cancelled") return { label: "Cancelled", tone: "neutral", active: false };
  if (c.state === "failed" || c.status === "failed") return { label: "Failed", tone: "danger", active: false };

  if (c.source === "meeting_url") {
    if (c.status === "denied") return { label: "Host declined", tone: "warning", active: false };
    if (c.status === "timed_out") return { label: "Not let in in time", tone: "warning", active: false };
    if (c.status === "recording") return { label: "Recording", tone: "danger", active: true, indicator: "recording" }; // red on purpose: recording must be obvious
    if (c.status === "waiting_for_admission") return { label: MEETING_LABELS.waiting_for_admission, tone: "warning", active: true, indicator: "dots" };
    if (c.status === "joining") return { label: MEETING_LABELS.joining, tone: "info", active: true, indicator: "spinner" };
    if (c.status === "processing") return { label: MEETING_LABELS.processing, tone: "info", active: true, indicator: "spinner" };
    if (MEETING_ACTIVE.has(c.status)) return { label: MEETING_LABELS[c.status] ?? c.status, tone: "info", active: true, indicator: "pulse" };
    if (c.status === "completed") return { label: "Ready", tone: "success", active: false, indicator: "check" };
    return { label: c.status, tone: "neutral", active: false };
  }

  if (c.state in RECORDING_LABELS) return { label: RECORDING_LABELS[c.state], tone: "info", active: true, indicator: "spinner" };
  if (c.state === "ready_to_review" || c.state === "completed") return { label: "Ready", tone: "success", active: false, indicator: "check" };
  return { label: c.state, tone: "neutral", active: false };
}

export function documentStatus(d: { status: string; failureReason?: string | null; editedByUser?: boolean }): StatusView {
  if (d.status === "generating") return { label: "Writing", tone: "info", active: true };
  if (d.status === "failed") return { label: "Failed", tone: "danger", active: false };
  if (d.failureReason) return { label: "Rewrite failed", tone: "warning", active: false };
  if (d.editedByUser) return { label: "Edited", tone: "info", active: false };
  return { label: "Ready", tone: "success", active: false };
}

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const h = minutes / 60;
  return `${h >= 10 ? Math.round(h) : h.toFixed(1)} h`;
}

/** "5 min ago", "Yesterday", or a date: short and honest for lists. */
export function timeAgo(iso: string | Date, now = new Date()): string {
  const then = new Date(iso);
  const diff = (now.getTime() - then.getTime()) / 1000;
  if (diff < 45) return "Just now";
  if (diff < 3600) return `${Math.round(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)} h ago`;
  if (diff < 172800) return "Yesterday";
  return then.toLocaleDateString(undefined, { day: "numeric", month: "short", year: then.getFullYear() === now.getFullYear() ? undefined : "numeric" });
}

export function greeting(hour: number): string {
  if (hour < 5) return "Working late";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}
