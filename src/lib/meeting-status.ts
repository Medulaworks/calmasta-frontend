// What each stage of a meeting capture means, in the words the user sees. Plain, and never promising:
// admission is up to the host, and nothing is recorded until the assistant is actually in the meeting.

export const MEETING_STEPS = [
  { status: "requested", label: "Requested", text: "Your request is in. The CalMasta Assistant has not joined yet." },
  { status: "joining", label: "Joining", text: "The CalMasta Assistant is joining the meeting." },
  { status: "waiting_for_admission", label: "Waiting to be let in", text: "The host needs to admit the CalMasta Assistant. Nothing is being recorded yet." },
  { status: "recording", label: "Recording", text: "The CalMasta Assistant is in the meeting and recording." },
  { status: "processing", label: "Processing", text: "The meeting has ended. The recording is being processed." },
] as const;

export const MEETING_OUTCOMES: Record<string, { title: string; text: string }> = {
  denied: {
    title: "The host declined",
    text: "The host did not let the CalMasta Assistant in, so nothing was recorded. If that was a mistake, ask the host to admit “CalMasta Assistant” and send it again. It will not try again on its own.",
  },
  timed_out: {
    title: "Not let in in time",
    text: "The host did not admit the CalMasta Assistant before the wait ended, so nothing was recorded. Ask the host to watch for it, then send it again. It will not try again on its own.",
  },
  failed: {
    title: "The capture stopped",
    text: "Something went wrong joining or recording this meeting. You can send the assistant again.",
  },
  cancelled: { title: "Cancelled", text: "You cancelled this capture. Nothing is being recorded." },
};

export const RETRYABLE = ["denied", "timed_out", "failed", "cancelled"];
