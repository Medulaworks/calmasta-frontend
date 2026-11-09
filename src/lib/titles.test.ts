import { describe, expect, it } from "vitest";
import { displayTitle, isGenericTitle } from "./titles";

describe("display titles", () => {
  it("knows the placeholder names", () => {
    for (const t of ["Meeting", " recording ", "", null, undefined, "Untitled"]) expect(isGenericTitle(t)).toBe(true);
    expect(isGenericTitle("Quarterly planning")).toBe(false);
  });
  it("keeps a real title and dates a placeholder one", () => {
    expect(displayTitle({ title: "Quarterly planning", kind: "meeting", at: "2026-10-29T10:15:00Z" }, "UTC")).toBe("Quarterly planning");
    const m = displayTitle({ title: "Meeting", kind: "meeting", at: "2026-10-29T10:15:00Z" }, "UTC");
    expect(m).toMatch(/^Meeting on /);
    expect(m).toContain("10:15");
    expect(displayTitle({ title: "Recording", source: "voice_recording", createdAt: "2026-10-29T10:15:00Z" }, "UTC")).toMatch(/^Recording on /);
    expect(displayTitle({ title: "Meeting", source: "meeting_url", createdAt: "2026-10-29T10:15:00Z" }, "UTC")).toMatch(/^Meeting on /);
    expect(displayTitle({ title: "", kind: "recording" }, "UTC")).toBe("Recording");
  });
});
