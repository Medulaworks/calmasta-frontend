import { describe, expect, it } from "vitest";
import { resolveDashboardState } from "./dashboard-state";

const NOW = new Date("2026-11-10T12:00:00Z");
const ago = (days: number, minutes = 0) => new Date(NOW.getTime() - days * 86_400_000 - minutes * 60_000).toISOString();
const run = (o: Partial<Parameters<typeof resolveDashboardState>[0]>) => resolveDashboardState({ captureCount: 0, captureDates: [], firstResultSeen: false, now: NOW, timeZone: "UTC", ...o });

describe("dashboard state", () => {
  it("is cold with nothing captured, even if the list is empty", () => {
    expect(run({})).toBe("cold");
  });
  it("shows the first result for one fresh capture that has not been opened", () => {
    expect(run({ captureCount: 1, captureDates: [ago(0, 3)] })).toBe("first_result");
  });
  it("stops showing the first result once it is opened, or after ten minutes", () => {
    expect(run({ captureCount: 1, captureDates: [ago(0, 3)], firstResultSeen: true })).toBe("warming");
    expect(run({ captureCount: 1, captureDates: [ago(0, 30)] })).toBe("warming");
  });
  it("is warming for two to four captures", () => {
    expect(run({ captureCount: 3, captureDates: [ago(1), ago(1), ago(2)] })).toBe("warming");
  });
  it("is active with five captures, or three different days this week", () => {
    expect(run({ captureCount: 5, captureDates: [ago(1), ago(1), ago(1), ago(1), ago(1)] })).toBe("active");
    expect(run({ captureCount: 3, captureDates: [ago(0, 60), ago(2), ago(4)] })).toBe("active");
  });
  it("is lapsed after ten days, and that beats active", () => {
    expect(run({ captureCount: 2, captureDates: [ago(10), ago(14)] })).toBe("lapsed");
    expect(run({ captureCount: 40, captureDates: [ago(11)] })).toBe("lapsed");
    expect(run({ captureCount: 2, captureDates: [ago(9)] })).toBe("warming");
  });
  it("never throws on bad dates", () => {
    expect(run({ captureCount: 2, captureDates: ["nope", ""] })).toBe("warming");
  });
});
