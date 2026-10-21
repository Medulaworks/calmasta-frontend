import { describe, expect, it } from "vitest";
import { countUncertain } from "./uncertainty";

describe("countUncertain", () => {
  it("counts the ways a gap is written, any case, whole phrases only", () => {
    expect(countUncertain("Owner: Not specified. Date not stated. Budget TBC. Questions to confirm: who signs off?")).toBe(4);
    expect(countUncertain("Specified clearly. A tbcx word. Nothing missing.")).toBe(0);
    expect(countUncertain("")).toBe(0);
  });
});
