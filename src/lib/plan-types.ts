// The plans Joobah sells, in one place for the server and the screens. Allowances and prices are configuration
// (server/billing/config.ts), never copy; this only names the plans and how they relate.

export const PLAN_IDS = ["free", "pro", "business"] as const;
export type PlanId = (typeof PLAN_IDS)[number];
export type PaidPlanId = Exclude<PlanId, "free">;

export const PLAN_LABEL: Record<PlanId, string> = {
  free: "Free",
  pro: "Pro",
  business: "Business",
};

/** True for a plan that is bought in the store (Pro or Business). */
export const isPaidPlan = (p: PlanId): p is PaidPlanId => p !== "free";
