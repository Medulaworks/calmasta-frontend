import { describe, expect, it } from "vitest";
import { formatSetting, fromDisplay, toDisplay } from "./admin-units";

describe("admin units", () => {
  it("shows seconds as minutes and converts back", () => {
    expect(toDisplay("seconds", 18_000)).toBe(300);
    expect(fromDisplay("seconds", "300")).toBe(18_000);
    expect(fromDisplay("seconds", "1.5")).toBe(90);
  });
  it("converts bytes, micro-dollars and daily dollars", () => {
    expect(fromDisplay("bytes", "100")).toBe(100_000_000);
    expect(fromDisplay("micros_per_hour", "6")).toBe(6_000_000);
    expect(toDisplay("micros_per_hour", 2_500_000)).toBe(2.5);
    expect(fromDisplay("usd_per_day", "150.456")).toBe(150.46);
  });
  it("rejects blanks and non-numbers instead of turning them into zero", () => {
    expect(fromDisplay("seconds", "")).toBeNull();
    expect(fromDisplay("seconds", "abc")).toBeNull();
    expect(fromDisplay(undefined, "  ")).toBeNull();
  });
  it("formats with a unit", () => {
    expect(formatSetting("seconds", 7200)).toBe("120 minutes");
    expect(formatSetting("micros_per_hour", 2_500_000)).toBe("2.5 USD per hour");
    expect(formatSetting(undefined, 3)).toBe("3");
  });
});
