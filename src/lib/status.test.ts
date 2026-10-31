import { describe, expect, it } from "vitest";
import { captureStatus, documentStatus, formatMinutes, greeting, timeAgo } from "./status";

describe("captureStatus", () => {
  it("never reports success for work that is not finished", () => {
    for (const state of ["uploading", "uploaded", "queued", "processing_audio", "transcribing"]) {
      const s = captureStatus({ source: "audio_upload", state, status: "processing" });
      expect(s.active, state).toBe(true);
      expect(s.tone, state).not.toBe("success");
    }
    for (const status of ["requested", "scheduled", "joining", "waiting_for_admission", "recording", "processing"]) {
      const s = captureStatus({ source: "meeting_url", state: "queued", status });
      expect(s.active, status).toBe(true);
      expect(s.tone, status).not.toBe("success");
    }
  });
  it("reports ready only when the transcript is ready", () => {
    expect(captureStatus({ source: "audio_upload", state: "ready_to_review", status: "completed" })).toMatchObject({ label: "Ready", tone: "success", active: false });
  });
  it("failure and cancellation win over everything else and are not active", () => {
    expect(captureStatus({ source: "meeting_url", state: "failed", status: "failed" })).toMatchObject({ label: "Failed", tone: "danger", active: false });
    expect(captureStatus({ source: "meeting_url", state: "cancelled", status: "cancelled" })).toMatchObject({ label: "Cancelled", active: false });
    expect(captureStatus({ source: "audio_upload", state: "queued", status: "failed" }).label).toBe("Failed");
  });
  it("uses human wording for meeting stages", () => {
    expect(captureStatus({ source: "meeting_url", state: "processing_audio", status: "waiting_for_admission" }).label).toBe("Waiting to be let in");
  });
});

describe("meeting outcomes", () => {
  it("says a host decline or a timeout plainly, never as success or as a generic failure", () => {
    expect(captureStatus({ source: "meeting_url", state: "ended", status: "denied" })).toMatchObject({ label: "Host declined", tone: "warning", active: false });
    expect(captureStatus({ source: "meeting_url", state: "ended", status: "timed_out" })).toMatchObject({ label: "Not let in in time", tone: "warning", active: false });
  });
  it("waiting to be let in never looks like recording", () => {
    const waiting = captureStatus({ source: "meeting_url", state: "processing_audio", status: "waiting_for_admission" });
    const recording = captureStatus({ source: "meeting_url", state: "processing_audio", status: "recording" });
    expect(waiting.label).toBe("Waiting to be let in");
    expect(waiting.tone).not.toBe(recording.tone);
    expect(recording).toMatchObject({ label: "Recording", active: true });
  });
});

describe("documentStatus", () => {
  it("distinguishes writing, failed, rewrite-failed and ready", () => {
    expect(documentStatus({ status: "generating" })).toMatchObject({ label: "Writing", active: true });
    expect(documentStatus({ status: "failed" })).toMatchObject({ label: "Failed", tone: "danger" });
    expect(documentStatus({ status: "ready", failureReason: "x" })).toMatchObject({ label: "Rewrite failed", tone: "warning" });
    expect(documentStatus({ status: "ready" })).toMatchObject({ label: "Ready", tone: "success" });
    expect(documentStatus({ status: "ready", editedByUser: true })).toMatchObject({ label: "Edited", tone: "info" });
    // A failed rewrite is the more important thing to say, even on an edited document.
    expect(documentStatus({ status: "ready", editedByUser: true, failureReason: "x" })).toMatchObject({ label: "Rewrite failed" });
  });
});

describe("formatting", () => {
  it.each([[0, "0 min"], [12.4, "12 min"], [59, "59 min"], [60, "1.0 h"], [90, "1.5 h"], [600, "10 h"], [1234, "21 h"]])("formatMinutes(%s)", (m, out) => {
    expect(formatMinutes(m)).toBe(out);
  });
  it("timeAgo", () => {
    const now = new Date("2026-10-19T12:00:00Z");
    expect(timeAgo("2026-10-19T11:59:50Z", now)).toBe("Just now");
    expect(timeAgo("2026-10-19T11:30:00Z", now)).toBe("30 min ago");
    expect(timeAgo("2026-10-19T09:00:00Z", now)).toBe("3 h ago");
    expect(timeAgo("2026-10-18T09:00:00Z", now)).toBe("Yesterday");
  });
  it("greeting by hour", () => {
    expect([2, 8, 14, 21].map(greeting)).toEqual(["Working late", "Good morning", "Good afternoon", "Good evening"]);
  });
});

it("adds stage indicators without overriding attention/failure outcomes", () => {
  const meeting = (state: string, status: string) => ({ source: "meeting_url", state, status });
  expect(captureStatus(meeting("processing_audio", "recording"))).toMatchObject({ label: "Recording", indicator: "recording", active: true });
  expect(captureStatus(meeting("processing_audio", "waiting_for_admission"))).toMatchObject({ indicator: "dots" });
  expect(captureStatus(meeting("processing_audio", "joining"))).toMatchObject({ indicator: "spinner" });
  expect(captureStatus(meeting("completed", "completed"))).toMatchObject({ indicator: "check", active: false });
  for (const state of ["reconciliation_required", "failed", "transcription_failed", "cancelled"]) {
    const view = captureStatus(meeting(state, "recording"));
    expect(view.active).toBe(false);expect(view.indicator).toBeUndefined();
  }
});
