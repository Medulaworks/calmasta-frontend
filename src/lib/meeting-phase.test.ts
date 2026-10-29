import { describe, expect, it } from "vitest";
import { meetingPhase, phaseToast } from "./meeting-phase";

const meeting = (status: string, state = "processing_audio") => ({ source: "meeting_url", state, status });

describe("meetingPhase", () => {
  it("names each stage of a meeting, and waiting is never recording", () => {
    expect(meetingPhase(meeting("requested"))).toBe("queued");
    expect(meetingPhase(meeting("joining"))).toBe("joining");
    expect(meetingPhase(meeting("waiting_for_admission"))).toBe("waiting");
    expect(meetingPhase(meeting("recording"))).toBe("recording");
    expect(meetingPhase(meeting("processing"))).toBe("ended");
    expect(meetingPhase(meeting("completed"))).toBe("ready");
  });
  it("outcomes win over the stage: declined, not let in, failed and cancelled", () => {
    expect(meetingPhase(meeting("denied", "ended"))).toBe("declined");
    expect(meetingPhase(meeting("timed_out", "ended"))).toBe("timed_out");
    expect(meetingPhase(meeting("recording", "failed"))).toBe("failed");
    expect(meetingPhase(meeting("recording", "cancelled"))).toBe("cancelled");
  });
  it("ignores things that are not meetings", () => {
    expect(meetingPhase({ source: "audio_upload", state: "transcribing", status: "transcribing" })).toBeNull();
    expect(meetingPhase(meeting("something_new"))).toBeNull();
  });
});

describe("phaseToast", () => {
  it("says nothing when nothing changed", () => {
    expect(phaseToast("recording", "recording", "Standup", "1")).toBeNull();
  });
  it("tells the person each step, with the right look", () => {
    expect(phaseToast("queued", "joining", "Standup", "1")).toMatchObject({ indicator: "spinner", tone: "info" });
    expect(phaseToast("joining", "waiting", "Standup", "1")).toMatchObject({ indicator: "dots", tone: "warning" });
    expect(phaseToast("waiting", "recording", "Standup", "1")).toMatchObject({ indicator: "recording", tone: "recording" });
    expect(phaseToast("recording", "ended", "Standup", "1")?.message).toContain("has ended");
  });
  it("links to the conversation when it is ready", () => {
    expect(phaseToast("ended", "ready", "Standup", "abc")).toMatchObject({ tone: "success", href: "/dashboard/captures/abc", actionLabel: "Open" });
  });
  it("explains a decline or timeout as nothing recorded, and a failure as retryable", () => {
    expect(phaseToast("waiting", "declined", "Standup", "1")?.message).toContain("Nothing was recorded");
    expect(phaseToast("waiting", "timed_out", "Standup", "1")?.message).toContain("Nothing was recorded");
    expect(phaseToast("recording", "failed", "Standup", "1")).toMatchObject({ tone: "danger" });
  });
  it("only announces a capture it hasn't seen before if it is live", () => {
    expect(phaseToast(undefined, "ready", "Old one", "1")).toBeNull();
    expect(phaseToast(undefined, "declined", "Old one", "1")).toBeNull();
    expect(phaseToast(undefined, "recording", "Calendar meeting", "1")).not.toBeNull();
    expect(phaseToast(undefined, "waiting", "Calendar meeting", "1")).not.toBeNull();
  });
  it("does not toast for the request the person just made", () => {
    expect(phaseToast("joining", "queued", "Standup", "1")).toBeNull();
  });
});
