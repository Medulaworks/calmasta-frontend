import { describe, expect, it } from "vitest";
import { centsToInput, fmtMoney, toCents, yearlySavings } from "./admin-money";

describe("plan money", () => {
  it("formats whole dollars calmly and keeps cents when there are some", () => {
    expect(fmtMoney(1200)).toBe("$12");
    expect(fmtMoney(1299)).toBe("$12.99");
    expect(fmtMoney(0)).toBe("$0");
  });
  it("reads a typed price into cents without rounding errors", () => {
    expect(toCents("12")).toBe(1200);
    expect(toCents(" $12.5 ")).toBe(1250);
    expect(toCents("0.29")).toBe(29);
    expect(toCents("19.99")).toBe(1999);
  });
  it("rejects things that are not prices", () => {
    for (const bad of ["", "abc", "-5", "12.999", "1e3", "12,50", "1234567"]) expect(toCents(bad), bad).toBeNull();
  });
  it("round-trips for the price box", () => {
    expect(centsToInput(1200)).toBe("12");
    expect(centsToInput(1250)).toBe("12.50");
    expect(toCents(centsToInput(1999))).toBe(1999);
  });
  it("works out the yearly saving", () => {
    expect(yearlySavings(1200, 12000)).toBe(17);
    expect(yearlySavings(1200, 14400)).toBe(0);
    expect(yearlySavings(0, 0)).toBe(0);
    expect(yearlySavings(1200, 15000)).toBe(0);
  });
});
