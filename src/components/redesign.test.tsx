import { createElement } from "react";
import { UploadProgress } from "./upload-progress";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ActionDock, CalendarPrompt, CaptureBar, SampleResult } from "./dashboard/parts";
import { EmptyState } from "./ui/empty-state";
import { CalendarIllustration, ChecklistIllustration, DocumentIllustration, InboxIllustration, MeetingIllustration, SpineIllustration, VoiceIllustration } from "./ui/illustrations";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => undefined, replace: () => undefined }), usePathname: () => "/dashboard", useSearchParams: () => new URLSearchParams() }));

const html = (el: React.ReactElement) => renderToStaticMarkup(el);

describe("redesign pieces", () => {
  it("every illustration draws and is hidden from screen readers", () => {
    for (const I of [VoiceIllustration, MeetingIllustration, DocumentIllustration, InboxIllustration, ChecklistIllustration, CalendarIllustration, SpineIllustration]) {
      const out = html(createElement(I));
      expect(out).toContain("<svg");
      expect(out).toContain('aria-hidden="true"');
    }
  });
  it("an empty state shows its illustration, title and next step", () => {
    const out = html(createElement(EmptyState, { illustration: createElement(InboxIllustration), title: "Your folder is empty", body: "Record something.", action: createElement("a", { href: "/x" }, "Go") }));
    expect(out).toContain("Your folder is empty");
    expect(out).toContain("<svg");
    expect(out).toContain('href="/x"');
  });
  it("the sample result is clearly labelled as dummy data", () => {
    const out = html(createElement(SampleResult));
    expect(out).toContain("Sample · dummy data");
    expect(out).toContain("Not your recording");
  });
  it("the cold dashboard offers all four ways in, with exactly one solid primary action", () => {
    const out = html(createElement(ActionDock));
    for (const t of ["Start Recording", "Capture a meeting", "Upload audio", "Create a document"]) expect(out).toContain(t);
    expect(out).not.toContain("Record a thought");
    expect(out).toContain("Paste a Zoom, Teams or Google Meet link");
  });
  it("the slim capture bar and calendar prompt use the agreed wording", () => {
    expect(html(createElement(CaptureBar))).toContain("Send Jooba to the call");
    expect(html(createElement(CalendarPrompt))).toContain("You will approve each one");
  });
});

describe("upload progress", () => {
  it("says what is happening at each stage, with the real percentage while uploading", () => {
    const up = html(createElement(UploadProgress, { stage: "uploading", progress: 0.5, totalBytes: 2_000_000 }));
    expect(up).toContain("Uploading your recording");
    expect(up).toContain("50%");
    expect(up).toContain('aria-current="step"');
    expect(html(createElement(UploadProgress, { stage: "processing", totalBytes: 1, state: "processing_audio" }))).toContain("Preparing your audio");
    expect(html(createElement(UploadProgress, { stage: "processing", totalBytes: 1, state: "transcribing" }))).toContain("Transcribing");
    expect(html(createElement(UploadProgress, { stage: "done", totalBytes: 1 }))).toContain("Transcript ready");
    const bad = html(createElement(UploadProgress, { stage: "failed", totalBytes: 1, message: "Network lost." }));
    expect(bad).toContain('role="alert"');
    expect(bad).toContain("Network lost.");
  });
});
