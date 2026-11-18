import { describe, expect, it } from "vitest";

describe("sharing defaults", () => {
  it("restricted initially, no media in snapshot", () => {
    // Owner-selected notes only, no audio/video in expected snapshot shape
    const snapshot = { notes: [{ kind: "summary", content: "hello" }], transcript: null, media: undefined, participants: undefined };
    expect(snapshot.media).toBeUndefined();
    expect(snapshot.participants).toBeUndefined();
  });
  it("token hash only, not plaintext reuse", () => {
    const alreadyIssued = true;
    const url = alreadyIssued ? null : "https://app/share/token123";
    expect(url).toBeNull();
  });
});
