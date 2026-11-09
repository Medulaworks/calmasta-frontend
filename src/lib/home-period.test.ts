import { describe, expect, it } from "vitest";
import { type HomePeriod, parseHomePeriod, previousWindow, versusText, windowOf, windowText } from "./home-period";
import { summarise } from "./home-metrics";

const NOW = new Date("2026-11-10T12:00:00Z");

describe("home period", () => {
  it("covers today, seven days, thirty days or a chosen range, inclusive", () => {
    expect(windowOf({ key: "day" }, "UTC", NOW)).toEqual({ from: "2026-11-10", to: "2026-11-10", days: 1 });
    expect(windowOf({ key: "week" }, "UTC", NOW)).toEqual({ from: "2026-11-04", to: "2026-11-10", days: 7 });
    expect(windowOf({ key: "month" }, "UTC", NOW)).toMatchObject({ from: "2026-10-12", days: 30 });
    expect(windowOf({ key: "range", from: "2026-10-01", to: "2026-10-31" }, "UTC", NOW)).toEqual({ from: "2026-10-01", to: "2026-10-31", days: 31 });
  });
  it("follows the person's own time zone for what 'today' is", () => {
    const late = new Date("2026-11-10T23:30:00Z");
    expect(windowOf({ key: "day" }, "UTC", late).to).toBe("2026-11-10");
    expect(windowOf({ key: "day" }, "Asia/Tokyo", late).to).toBe("2026-11-11");
  });
  it("compares with the same number of days just before", () => {
    expect(previousWindow({ from: "2026-11-04", to: "2026-11-10", days: 7 })).toEqual({ from: "2026-10-28", to: "2026-11-03", days: 7 });
  });
  it("accepts a good saved choice and falls back to the week for a bad one", () => {
    expect(parseHomePeriod({ key: "month" }, "UTC", NOW)).toEqual({ key: "month" });
    expect(parseHomePeriod({ key: "range", from: "2026-10-01", to: "2026-10-31" }, "UTC", NOW)).toEqual({ key: "range", from: "2026-10-01", to: "2026-10-31" });
    for (const bad of [null, {}, { key: "year" }, { key: "range", from: "2026-10-31", to: "2026-10-01" }, { key: "range", from: "2026-10-01", to: "2027-01-01" }, { key: "range", from: "nope", to: "x" }]) expect(parseHomePeriod(bad, "UTC", NOW), JSON.stringify(bad)).toEqual({ key: "week" });
  });
  it("describes the window in words", () => {
    const week = windowOf({ key: "week" }, "UTC", NOW);
    expect(windowText({ key: "week" }, week)).toBe("4 Nov – 10 Nov 2026");
    expect(windowText({ key: "day" }, windowOf({ key: "day" }, "UTC", NOW))).toBe("Today");
    expect(versusText({ key: "week" } as HomePeriod, week)).toBe("the 7 days before");
    expect(versusText({ key: "day" }, windowOf({ key: "day" }, "UTC", NOW))).toBe("yesterday");
  });
});

describe("summarise", () => {
  const w = { from: "2026-11-04", to: "2026-11-10", days: 7 };
  const row = (kind: "meeting" | "recording" | "document", at: string, extra: Record<string, unknown> = {}) => ({ kind, at, state: "completed", status: "completed", failureReason: null, ...extra }) as Parameters<typeof summarise>[0][number];
  it("counts finished meetings, recordings and documents inside the window, and adds up the minutes", () => {
    const s = summarise([
      row("meeting", "2026-11-05T10:00:00Z", { durationSeconds: 1800 }),
      row("meeting", "2026-11-06T10:00:00Z", { durationSeconds: 600 }),
      row("recording", "2026-11-10T08:00:00Z", { durationSeconds: 120 }),
      row("document", "2026-11-09T08:00:00Z"),
      row("meeting", "2026-10-30T10:00:00Z", { durationSeconds: 999 }),
    ], w, "UTC");
    expect(s).toEqual({ meetings: 2, recordings: 1, documents: 1, minutes: 42 });
  });
  it("ignores failed and unfinished captures", () => {
    const s = summarise([row("meeting", "2026-11-05T10:00:00Z", { state: "failed", status: "failed" }), row("recording", "2026-11-05T10:00:00Z", { state: "processing", status: "processing" })], w, "UTC");
    expect(s).toEqual({ meetings: 0, recordings: 0, documents: 0, minutes: null });
  });
  it("says minutes are unknown (not zero) when no item has a length", () => {
    expect(summarise([row("meeting", "2026-11-05T10:00:00Z")], w, "UTC").minutes).toBeNull();
  });
});
