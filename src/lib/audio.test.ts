import { describe, expect, it } from "vitest";
import { MAX_UPLOAD_BYTES, checkAudioFile, formatBytes, formatDuration } from "./audio";

describe("checkAudioFile", () => {
  it("accepts a normal mp3", () => {
    expect(checkAudioFile({ name: "a.mp3", type: "audio/mpeg", size: 1000 })).toEqual({ ok: true });
  });
  it("accepts webm with codec parameters (MediaRecorder output)", () => {
    expect(
      checkAudioFile({ name: "rec.webm", type: "audio/webm;codecs=opus", size: 1000 }),
    ).toEqual({ ok: true });
  });
  it("accepts an empty type when the extension is known", () => {
    expect(checkAudioFile({ name: "memo.m4a", type: "", size: 1000 })).toEqual({ ok: true });
  });
  it("rejects an empty type with an unknown extension", () => {
    expect(checkAudioFile({ name: "memo.xyz", type: "", size: 1000 }).ok).toBe(false);
  });
  it("rejects non-audio types", () => {
    expect(checkAudioFile({ name: "a.pdf", type: "application/pdf", size: 1000 }).ok).toBe(false);
  });
  it("rejects empty and oversized files", () => {
    expect(checkAudioFile({ name: "a.mp3", type: "audio/mpeg", size: 0 }).ok).toBe(false);
    expect(
      checkAudioFile({ name: "a.mp3", type: "audio/mpeg", size: MAX_UPLOAD_BYTES + 1 }).ok,
    ).toBe(false);
  });
});

describe("formatDuration", () => {
  it.each([
    [0, "0:00"],
    [5, "0:05"],
    [65, "1:05"],
    [3600, "1:00:00"],
    [3725, "1:02:05"],
    [-3, "0:00"],
  ])("%s -> %s", (input, expected) => {
    expect(formatDuration(input)).toBe(expected);
  });
});

describe("formatBytes", () => {
  it("formats KB and MB", () => {
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
  });
});

it("rejects formats not supported by the capture API and honors its byte limit",()=>{
 for(const [name,type] of [["a.aac","audio/aac"],["a.flac","audio/flac"]])expect(checkAudioFile({name,type,size:1}).ok).toBe(false);
 expect(checkAudioFile({name:"a.mp3",type:"audio/mpeg",size:101},100).ok).toBe(false);
});
