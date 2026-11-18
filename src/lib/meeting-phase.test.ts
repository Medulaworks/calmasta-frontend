import { describe, expect, it } from "vitest";
import { meetingPhase, phaseToast, createMeetingToastTracker } from "./meeting-phase";

const meeting = (status: string, state = status) => ({ source: "meeting_url", state, status });

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
    expect(phaseToast("recording", "ended", "Standup", "1")?.message).toContain("finished recording");
  });
  it("links to the conversation when it is ready", () => {
    expect(phaseToast("ended", "ready", "Standup", "abc")).toMatchObject({ tone: "success", href: "/dashboard/captures/abc", actionLabel: "Open" });
  });
  it("explains declined, timeout and failed outcomes without claiming a retry will succeed", () => {
    expect(phaseToast("waiting", "declined", "Standup", "1")?.message).toContain("assistant");
    expect(phaseToast("waiting", "timed_out", "Standup", "1")?.message).toContain("assistant");
    expect(phaseToast("recording", "failed", "Standup", "1")).toMatchObject({ tone: "danger" });
  });
  it("only announces a capture it hasn’t seen before if it is live", () => {
    expect(phaseToast(undefined, "ready", "Old one", "1")).toBeNull();
    expect(phaseToast(undefined, "declined", "Old one", "1")).toBeNull();
    expect(phaseToast(undefined, "recording", "Calendar meeting", "1")).not.toBeNull();
    expect(phaseToast(undefined, "waiting", "Calendar meeting", "1")).not.toBeNull();
  });
  it("does not toast for the request the person just made", () => {
    expect(phaseToast("joining", "queued", "Standup", "1")).toBeNull();
  });
});

it("canonical attention and in-progress states override stale completed/recording status",()=>{
 expect(meetingPhase(meeting("completed","reconciliation_required"))).toBe("attention");
 expect(meetingPhase(meeting("recording","reconciliation_required"))).toBe("attention");
 expect(meetingPhase(meeting("completed","transcribing"))).toBe("ended");
 expect(meetingPhase(meeting("completed","unknown_future_state"))).toBeNull();
});
it("snapshot tracking stays quiet initially, emits one transition, and does not repeat on filter gaps",()=>{
 const track=createMeetingToastTracker();
 const capture=(status:string)=>({id:"1",title:"Standup",source:"meeting_url",state:status,status});
 expect(track(null)).toEqual([]);expect(track([capture("joining")])).toEqual([]);
 expect(track([capture("recording")])).toHaveLength(1);
 expect(track([capture("recording")])).toEqual([]);
 expect(track([])).toEqual([]);expect(track([capture("recording")])).toEqual([]);
 expect(track([capture("reconciliation_required")])[0]).toMatchObject({tone:"warning"});
});
