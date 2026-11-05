import { describe, expect, it } from "vitest";
import { DEFAULT_PERIOD, parsePeriod, periodDays, periodQuery, periodSpan, periodTitle, spanText, validDay } from "./admin-period";

const NOW = new Date("2026-11-03T10:00:00Z");
const get = (q: string) => { const p = new URLSearchParams(q); return (k: string) => p.get(k); };

describe("admin period", () => {
  it("reads the four named windows and falls back to the last 7 days", () => {
    for (const k of ["day", "week", "month", "all"] as const) expect(parsePeriod(get(`period=${k}`), NOW)).toEqual({ key: k });
    expect(parsePeriod(get(""), NOW)).toEqual(DEFAULT_PERIOD);
    expect(parsePeriod(get("period=forever"), NOW)).toEqual(DEFAULT_PERIOD);
  });
  it("accepts a real date range and rejects bad ones", () => {
    expect(parsePeriod(get("period=range&from=2026-10-01&to=2026-10-31"), NOW)).toEqual({ key: "range", from: "2026-10-01", to: "2026-10-31" });
    for (const q of ["period=range", "period=range&from=2026-10-31&to=2026-10-01", "period=range&from=2026-02-30&to=2026-03-01", "period=range&from=2026-10-01&to=2026-12-01", "period=range&from=nope&to=2026-10-01"]) expect(parsePeriod(get(q), NOW), q).toEqual(DEFAULT_PERIOD);
  });
  it("counts the days, inclusive", () => {
    expect(periodDays({ key: "day" })).toBe(1);
    expect(periodDays({ key: "week" })).toBe(7);
    expect(periodDays({ key: "month" })).toBe(30);
    expect(periodDays({ key: "all" })).toBeNull();
    expect(periodDays({ key: "range", from: "2026-10-01", to: "2026-10-31" })).toBe(31);
    expect(periodDays({ key: "range", from: "2026-11-03", to: "2026-11-03" })).toBe(1);
  });
  it("works out the first and last day in UTC", () => {
    expect(periodSpan({ key: "week" }, NOW)).toEqual({ from: "2026-10-28", to: "2026-11-03" });
    expect(periodSpan({ key: "day" }, NOW)).toEqual({ from: "2026-11-03", to: "2026-11-03" });
    expect(periodSpan({ key: "all" }, NOW)).toEqual({ from: null, to: "2026-11-03" });
  });
  it("describes it for people and for the address bar", () => {
    expect(periodTitle({ key: "month" }, NOW)).toBe("Last 30 days");
    expect(spanText({ key: "week" }, NOW)).toBe("Oct 28 – Nov 3, 2026");
    expect(spanText({ key: "all" }, NOW)).toBe("Up to Nov 3, 2026");
    expect(periodTitle({ key: "range", from: "2026-10-01", to: "2026-10-31" }, NOW)).toBe("Oct 1 – Oct 31, 2026");
    expect(periodQuery({ key: "week" })).toBe("?period=week");
    expect(periodQuery({ key: "range", from: "2026-10-01", to: "2026-10-31" })).toBe("?period=range&from=2026-10-01&to=2026-10-31");
  });
  it("only accepts today or earlier", () => {
    expect(validDay("2026-11-03", NOW)).toBe(true);
    expect(validDay("2026-11-04", NOW)).toBe(false);
    expect(validDay(null, NOW)).toBe(false);
  });
});
