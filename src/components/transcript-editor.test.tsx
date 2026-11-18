import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";
import { TranscriptEditor } from "./transcript-editor";
import type { CaptureView } from "../lib/upload-client";
const h = vi.hoisted(() => ({ buttons: [] as ComponentProps<"button">[] }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams() }));
vi.mock("./ui/button", () => ({ Button: (props: ComponentProps<"button">) => { h.buttons.push(props); return createElement("button", props); } }));
const cap = { id: "text", title: "Notes", source: "transcript_upload", state: "completed", transcriptVersion: 1, transcript: [{ id: "segment", startMs: 0, endMs: 0, text: "Plan\nNext step", speakerId: null, editedByUser: false }], speakerNames: {}, documents: [] } as unknown as CaptureView;
afterEach(() => { h.buttons = []; vi.unstubAllGlobals(); });
it("renders and exports imported text without audio time labels, SRT or invented speakers", async () => {
 const html = renderToStaticMarkup(createElement(TranscriptEditor, { cap, active: false, statusLabel: "Ready", onChanged: vi.fn() }));
 expect(html).toContain("Plan\nNext step"); expect(html).toContain("Edit transcript"); expect(html).not.toContain("SRT"); expect(html).not.toContain("0:00"); expect(html).not.toContain("Speakers");
 let content: Blob | undefined;
 vi.stubGlobal("URL", { createObjectURL: (blob: Blob) => { content = blob; return "blob:fixture"; }, revokeObjectURL: vi.fn() });
 vi.stubGlobal("document", { createElement: () => ({ click: vi.fn() }) });
 h.buttons.find(button => button.title === "Export as text")!.onClick?.({} as never);
 expect(await content!.text()).toBe("Plan\nNext step");
});
it("keeps time labels and SRT export for audio transcripts", () => {
 const html = renderToStaticMarkup(createElement(TranscriptEditor, { cap: { ...cap, source: "audio_upload" }, active: false, statusLabel: "Ready", onChanged: vi.fn() }));
 expect(html).toContain("SRT"); expect(html).toContain("0:00");
});
it("concatenates imported chunks without altering split words or existing newlines", async () => {
 const imported = { ...cap, transcript: [{ ...cap.transcript[0], text: "antidisestab" }, { ...cap.transcript[0], id: "segment-2", text: "lishment\nNext step" }] };
 renderToStaticMarkup(createElement(TranscriptEditor, { cap: imported, active: false, statusLabel: "Ready", onChanged: vi.fn() }));
 let content: Blob | undefined;
 vi.stubGlobal("URL", { createObjectURL: (blob: Blob) => { content = blob; return "blob:fixture"; }, revokeObjectURL: vi.fn() });
 vi.stubGlobal("document", { createElement: () => ({ click: vi.fn() }) });
 h.buttons.find(button => button.title === "Export as text")!.onClick?.({} as never);
 expect(await content!.text()).toBe("antidisestablishment\nNext step");
});
