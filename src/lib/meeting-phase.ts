// Where a meeting capture is in its life, and what to tell the person when it moves. Pure, so it is easy to test:
// the screens only decide when to call it. Nothing here promises more than is true (waiting is never "recording").

import type { Indicator } from "@/components/ui/status-indicator";

export type MeetingPhase = "queued" | "joining" | "waiting" | "recording" | "ended" | "ready" | "declined" | "timed_out" | "failed" | "cancelled";

export interface MeetingToast {
  message: string;
  tone: "info" | "success" | "warning" | "danger" | "recording";
  indicator?: Indicator;
  href?: string;
  actionLabel?: string;
}

/** The phase of a meeting capture, or null for anything that isn't one (a voice recording, an unknown state). */
export function meetingPhase(c: { source: string; state: string; status: string }): MeetingPhase | null {
  if (c.source !== "meeting_url") return null;
  if (c.state === "cancelled" || c.status === "cancelled") return "cancelled";
  if (c.state === "host_denied" || c.status === "denied") return "declined";
  if (c.state === "admission_timeout" || c.status === "timed_out") return "timed_out";
  if (c.state === "failed" || c.status === "failed" || c.state === "transcription_failed") return "failed";
  if (c.state === "media_pending" || c.state === "recorded") return "ended";
  switch (c.status) {
    case "recording": return "recording";
    case "waiting_for_admission": return "waiting";
    case "joining": return "joining";
    case "requested":
    case "queued":
    case "scheduled": return "queued";
    case "processing": return "ended";
    case "completed":
    case "ready_to_review": return "ready";
    default: return null;
  }
}

/**
 * The toast for a change from `previous` to `next`, or null when nothing needs saying. `previous` is undefined for a
 * capture we hadn't seen: that only deserves a toast if it is live (waiting or recording), not for old finished ones.
 */
export function phaseToast(previous: MeetingPhase | null | undefined, next: MeetingPhase, title: string, id: string): MeetingToast | null {
  if (previous === next) return null;
  if (previous === undefined && next !== "waiting" && next !== "recording") return null;
  const t = `“${title}”`;
  switch (next) {
    case "joining": return { message: `The assistant is joining ${t}.`, tone: "info", indicator: "spinner" };
    case "waiting": return { message: `Waiting to be let in to ${t}. Ask the host to admit the assistant.`, tone: "warning", indicator: "dots" };
    case "recording": return { message: `Recording ${t}. The assistant is in the meeting.`, tone: "recording", indicator: "recording" };
    case "ended": return { message: `${t} has ended. Processing the recording…`, tone: "info", indicator: "spinner" };
    case "ready": return { message: `${t} is ready. Your transcript is available.`, tone: "success", indicator: "check", href: `/dashboard/captures/${id}`, actionLabel: "Open" };
    case "declined": return { message: `The host declined the assistant in ${t}. Nothing was recorded.`, tone: "warning" };
    case "timed_out": return { message: `The assistant wasn't let in to ${t} in time. Nothing was recorded.`, tone: "warning" };
    case "failed": return { message: `The capture of ${t} stopped. You can send the assistant again.`, tone: "danger" };
    case "cancelled": return { message: `Capture of ${t} cancelled.`, tone: "info" };
    default: return null; // "queued" is what the person just did; no toast for it
  }
}
