import { describe, expect, it } from "vitest";
import { taskName } from "./admin-words";

describe("taskName", () => {
  it("turns server codes and old labels into plain words", () => {
    expect(taskName("video_ingest")).toBe("Importing a video");
    expect(taskName("Video ingest")).toBe("Importing a video");
    expect(taskName("Meeting capture")).toBe("Recording a meeting");
    expect(taskName("transcription")).toBe("Making a transcript");
    expect(taskName("Document generation")).toBe("Writing a document");
  });
  it("never shows a raw code for something new", () => {
    expect(taskName("calendar_sync")).toBe("Calendar sync");
  });
});
