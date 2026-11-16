import { expect, it } from "vitest";
import { bannersFor } from "./account-banners";
import { DUMMY_PLAN, type PlanSummary } from "@/lib/plan-client";

function mockPlan(overrides: Partial<PlanSummary> = {}): PlanSummary {
  return {
    ...DUMMY_PLAN,
    plan: { plan: "free", status: "active", renewsAt: null, graceUntil: null },
    allowanceMinutes: 60,
    usedMinutes: 0,
    includedRemainingMinutes: 60,
    purchasedMinutes: 0,
    remainingMinutes: 0,
    exhausted: true,
    ...overrides,
  };
}

it("reserved allowance is not described as consumed time", () => {
  const plan = mockPlan({ allowanceMinutes: 60, usedMinutes: 0, reservedMinutes: 90, remainingMinutes: 0, exhausted: true });
  const text = bannersFor(plan, null).find((b) => b.id === "exhausted")?.text;
  expect(text).toContain("reserved");
  expect(text).not.toContain("You've used");
  expect(text).toContain("billing");
});

it("consumed allowance still explains exhausted quota, while available purchased time has no warning", () => {
  const plan = mockPlan({ usedMinutes: 60, reservedMinutes: 0, remainingMinutes: 0, exhausted: true });
  expect(bannersFor(plan, null).find((b) => b.id === "exhausted")?.text).toContain("You've used");
  expect(bannersFor({ ...plan, exhausted: false, remainingMinutes: 60 }, null).some((b) => b.id === "exhausted")).toBe(false);
});
