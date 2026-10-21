import { describe, expect, it } from "vitest";
import { addDays, dayKey, dayRange, formatTime, todayIn } from "./tz";

describe("tz helpers for the browser", () => {
  it("knows today's date in a zone, which may differ from UTC's", () => {
    expect(todayIn("Asia/Muscat", new Date("2026-10-19T21:00:00Z"))).toBe("2026-10-20");
    expect(todayIn("America/Los_Angeles", new Date("2026-10-19T02:00:00Z"))).toBe("2026-10-18");
    expect(dayKey("2026-10-19T21:00:00Z", "Asia/Muscat")).toBe("2026-10-20");
  });
  it("adds days across months and years", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
  it("a day is 24 hours except on a clock-change day", () => {
    const normal = dayRange("Europe/London", "2026-10-19");
    expect(normal.to.getTime() - normal.from.getTime()).toBe(24 * 3600_000);
    const forward = dayRange("Europe/London", "2026-03-29"); // clocks go forward: 23 hours
    expect(forward.to.getTime() - forward.from.getTime()).toBe(23 * 3600_000);
    const back = dayRange("Europe/London", "2026-10-25"); // clocks go back: 25 hours
    expect(back.to.getTime() - back.from.getTime()).toBe(25 * 3600_000);
  });
  it("formats a time in the requested zone, not the machine's", () => {
    expect(formatTime("2026-10-19T05:00:00Z", "Asia/Muscat")).toMatch(/9:00/);
    expect(formatTime("2026-10-19T05:00:00Z", "America/New_York")).toMatch(/1:00/);
  });
});
