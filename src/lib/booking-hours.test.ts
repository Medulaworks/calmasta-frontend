import { describe, expect, it } from "vitest";
import { summarizeWeek } from "./booking-hours";

const nine = [{ start: "09:00", end: "17:00" }];

describe("summarizeWeek", () => {
  it("groups consecutive days that share the same hours", () => {
    expect(summarizeWeek({ mon: nine, tue: nine, wed: nine, thu: nine, fri: nine })).toBe("Mon–Fri 09:00–17:00");
  });
  it("keeps split days together and lists several ranges", () => {
    const split = [{ start: "09:00", end: "12:30" }, { start: "13:30", end: "17:00" }];
    expect(summarizeWeek({ mon: split, tue: split, wed: split })).toBe("Mon–Wed 09:00–12:30, 13:30–17:00");
  });
  it("says two days with 'and' and a single day by itself", () => {
    expect(summarizeWeek({ tue: nine, wed: nine })).toBe("Tue and Wed 09:00–17:00");
    expect(summarizeWeek({ wed: [{ start: "14:00", end: "16:00" }] })).toBe("Wed 14:00–16:00");
  });
  it("does not join days that aren’t next to each other, or that differ", () => {
    expect(summarizeWeek({ mon: nine, wed: nine })).toBe("Mon 09:00–17:00 · Wed 09:00–17:00");
    expect(summarizeWeek({ mon: nine, tue: nine, wed: [{ start: "10:00", end: "12:00" }], thu: nine })).toBe("Mon and Tue 09:00–17:00 · Wed 10:00–12:00 · Thu 09:00–17:00");
  });
  it("puts a weekend after the week and handles an empty or gap-only week", () => {
    expect(summarizeWeek({ fri: nine, sat: nine, sun: nine })).toBe("Fri–Sun 09:00–17:00");
    expect(summarizeWeek({})).toBe("No days set");
    expect(summarizeWeek({ mon: [] })).toBe("No days set");
  });
});
