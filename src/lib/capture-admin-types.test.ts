import { describe, expect, it } from "vitest";
import { isValidDuration } from "./capture-admin-types";

describe("capture admin duration validation", () => {
  it("accepts valid durations including below 30 minutes", () => {
    expect(isValidDuration(600, 1200)).toBeNull();
    expect(isValidDuration(30, 30)).toBeNull();
    expect(isValidDuration(180, 300)).toBeNull();
  });
  it("rejects default > max", () => {
    expect(isValidDuration(1800, 1200)).toMatch(/Default cannot exceed/);
  });
  it("rejects below 30s or above 7200s", () => {
    expect(isValidDuration(10, 100)).toMatch(/at least 30/);
    expect(isValidDuration(30, 8000)).toMatch(/cannot exceed 7200/);
  });
  it("rejects non-integer", () => {
    expect(isValidDuration(30.5, 60)).toMatch(/whole seconds/);
  });
});
