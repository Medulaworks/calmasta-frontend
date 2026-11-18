import { describe, expect, it } from "vitest";
import { annualPrice, formatPrice, yearlyTotal } from "./pricing";

describe("pricing", () => {
  it("takes the yearly discount off the monthly price, to the cent", () => {
    expect(annualPrice(12, 20)).toBe(9.6);
    expect(annualPrice(39, 20)).toBe(31.2);
    expect(annualPrice(12, 0)).toBe(12);
    expect(annualPrice(9.99, 33)).toBe(6.69);
  });
  it("shows whole amounts without decimals and others with two", () => {
    expect(formatPrice("$", 12)).toBe("$12");
    expect(formatPrice("$", 9.6)).toBe("$9.60");
    expect(formatPrice("EUR", 0)).toBe("EUR0");
  });
  it("works out a year’s cost without floating-point dust", () => {
    expect(yearlyTotal(9.6)).toBe(115.2);
    expect(yearlyTotal(31.2)).toBe(374.4);
  });
});
