import { describe, expect, it } from "vitest";
import { detectMeetingPlatform, meetingKey, redactMeetingUrl } from "./meeting-url";

describe("detectMeetingPlatform", () => {
  it.each([
    ["https://meet.google.com/abc-defg-hij", "google_meet"],
    ["https://teams.microsoft.com/l/meetup-join/xyz", "microsoft_teams"],
    ["https://us02web.zoom.us/j/123456789?pwd=abc", "zoom"],
    ["https://zoom.us/j/123456789", "zoom"],
  ])("accepts %s", (url, platform) => {
    expect(detectMeetingPlatform(url)).toBe(platform);
  });

  it.each([
    "http://meet.google.com/abc-defg-hij", // not https
    "https://meet.google.com.evil.example/abc", // lookalike host
    "https://notzoom.us/j/1",
    "https://example.com/meeting",
    "not a url",
    "",
  ])("rejects %s", (url) => {
    expect(detectMeetingPlatform(url)).toBeNull();
  });
});

describe("redactMeetingUrl", () => {
  it("drops query string and hash", () => {
    expect(redactMeetingUrl("https://us02web.zoom.us/j/123?pwd=secret#x")).toBe(
      "https://us02web.zoom.us/j/123",
    );
  });
  it("handles invalid input", () => {
    expect(redactMeetingUrl("nope")).toBe("[invalid-url]");
  });
});

describe("meetingKey", () => {
  it("ignores passcodes, hashes, trailing slashes and case", () => {
    const a = meetingKey("https://us02web.zoom.us/j/123456789?pwd=secret");
    expect(a).toBe("https://us02web.zoom.us/j/123456789");
    expect(meetingKey("https://US02WEB.zoom.us/j/123456789/#x")).toBe(a);
  });
  it("distinguishes different meetings", () => {
    expect(meetingKey("https://zoom.us/j/1")).not.toBe(meetingKey("https://zoom.us/j/2"));
  });
  it("returns null for invalid input", () => {
    expect(meetingKey("nope")).toBeNull();
  });
});
