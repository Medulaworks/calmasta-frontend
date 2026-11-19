import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CaptureTile } from "./ui/platform-logo";
import { kindLabelFor, tileKindFor } from "./transcript-library";

const html = (el: React.ReactElement) => renderToStaticMarkup(el);

describe("library card icons", () => {
  it("maps each card type to its own tile and label", () => {
    expect(tileKindFor({ kind: "meeting", source: "meeting_url" })).toBe("meeting");
    expect(tileKindFor({ kind: "recording", source: "audio_upload" })).toBe("recording");
    expect(tileKindFor({ kind: "recording", source: "transcript" })).toBe("document");
    expect(tileKindFor({ kind: "document" })).toBe("document");
    expect(kindLabelFor({ kind: "meeting", source: "meeting_url" })).toBe("Meeting");
    expect(kindLabelFor({ kind: "recording", source: "audio_upload" })).toBe("Recording");
    expect(kindLabelFor({ kind: "recording", source: "transcript" })).toBe("Transcript");
    expect(kindLabelFor({ kind: "document" })).toBe("Document");
  });
  it("renders the meeting app logo once the server sends the platform", () => {
    for (const [platform, name] of [["zoom", "Zoom"], ["google_meet", "Google Meet"], ["microsoft_teams", "Microsoft Teams"]] as const) {
      const out = html(createElement(CaptureTile, { kind: tileKindFor({ kind: "meeting" }), platform, hint: "Team sync" }));
      expect(out).toContain(`aria-label="${name}"`);
    }
    expect(html(createElement(CaptureTile, { kind: tileKindFor({ kind: "meeting" }), hint: "Team sync" }))).not.toContain("<img");
  });
  it("gives imported transcripts the page icon instead of the microphone", () => {
    const out = html(createElement(CaptureTile, { kind: tileKindFor({ kind: "recording", source: "transcript" }) }));
    expect(out).not.toContain("<img");
    expect(out).toContain("file-text");
  });
});
