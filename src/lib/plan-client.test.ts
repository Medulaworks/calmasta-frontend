import { afterEach, expect, it, vi } from "vitest";
import {
  cancelDeletion,
  fetchDeletion,
  fetchPlan,
  formatNullableMinutes,
  normalizePlan,
  requestDeletion,
  totalRemainingMinutes,
} from "./plan-client";

afterEach(() => vi.unstubAllGlobals());

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

function setup(body: unknown, status = 200) {
  const fetch: ReturnType<typeof vi.fn> = vi.fn(async () => json(body, status));
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

it("unimplemented deletion operations report unavailable without making requests", async () => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  for (const operation of [fetchDeletion, () => requestDeletion("DELETE"), cancelDeletion]) {
    await expect(operation()).rejects.toMatchObject({ status: 503, code: "feature_unavailable" });
  }
  expect(fetch).not.toHaveBeenCalled();
});

const projection = {
  entitlementsVersion: "woo-entitlements-v1",
  plan: { plan: "free", rawPlan: "plan_free", status: "active", renewsAt: null, graceUntil: null },
  allowanceMinutes: 60,
  usedMinutes: 0,
  reservedMinutes: 0,
  includedUsedMinutes: 0,
  includedRemainingMinutes: 60,
  purchasedMinutes: 60,
  remainingMinutes: 120,
  resetsAt: "2026-12-01T00:00:00.000Z",
  inProgress: 0,
  exhausted: false,
  paused: false,
  timezone: "UTC",
  creditPacks: [
    {
      grantId: "f1a2b3c4-1111-4111-8111-111111111111",
      sku: "calmasta-pack-1h",
      creditsSeconds: 3600,
      availableSeconds: 3600,
      reservedSeconds: 0,
      consumedSeconds: 0,
      refundedSeconds: 0,
      expiresAt: "2027-02-12T20:00:00.000Z",
      state: "active",
    },
  ],
  creditPacksTruncated: false,
  purchasedCredits: {
    availableSeconds: 3600,
    reservedSeconds: 0,
    consumedSeconds: 0,
    refundedSeconds: 0,
    periodUsedSeconds: 0,
    nextExpiryAt: "2027-02-12T20:00:00.000Z",
  },
  subscriptionPeriod: null,
  freeAllowanceMinutes: 60,
  proAllowanceMinutes: null,
  pricing: null,
  placeholder: false,
};

it("consumes the plan projection with packs, credits and nullable pricing", async () => {
  const fetch = setup(projection);
  const plan = await fetchPlan();
  expect(fetch.mock.calls[0][0]).toBe("/api/plan");
  expect(plan.entitlementsVersion).toBe("woo-entitlements-v1");
  expect(plan.includedRemainingMinutes).toBe(60);
  expect(plan.purchasedMinutes).toBe(60);
  expect(plan.remainingMinutes).toBe(120);
  expect(plan.creditPacks).toHaveLength(1);
  expect(plan.creditPacks[0]).toMatchObject({
    sku: "calmasta-pack-1h",
    availableSeconds: 3600,
    reservedSeconds: 0,
    consumedSeconds: 0,
    refundedSeconds: 0,
    expiresAt: "2027-02-12T20:00:00.000Z",
    state: "active",
  });
  expect(plan.pricing).toBeNull();
  expect(plan.paused).toBe(false);
});

it("preserves backend nulls instead of inventing balances", async () => {
  setup({ ...projection, includedRemainingMinutes: null, purchasedMinutes: null, remainingMinutes: null, creditPacks: null });
  const plan = await fetchPlan();
  expect(plan.includedRemainingMinutes).toBeNull();
  expect(plan.purchasedMinutes).toBeNull();
  expect(plan.remainingMinutes).toBeNull();
  expect(plan.creditPacks).toEqual([]);
});

it("propagates expired sessions without inventing a plan", async () => {
  setup({ error: "Signed out", code: "unauthorized" }, 401);
  await expect(fetchPlan()).rejects.toMatchObject({ status: 401 });
});

it("preserves grace, paused, refund and pending-cancel subscription states", () => {
  const grace = normalizePlan({
    plan: { plan: "pro", rawPlan: "plan_pro", status: "grace", renewsAt: null, graceUntil: "2026-11-19T00:00:00.000Z" },
    paused: true,
    purchasedMinutes: 60,
    creditPacks: [
      {
        grantId: "g1",
        sku: "calmasta-pack-1h",
        creditsSeconds: 3600,
        availableSeconds: 0,
        reservedSeconds: 0,
        consumedSeconds: 1800,
        refundedSeconds: 1800,
        expiresAt: "2027-02-12T20:00:00.000Z",
        state: "partially_refunded",
      },
    ],
  });
  expect(grace.plan.status).toBe("grace");
  expect(grace.plan.graceUntil).toBe("2026-11-19T00:00:00.000Z");
  expect(grace.paused).toBe(true);
  expect(grace.creditPacks[0]).toMatchObject({ consumedSeconds: 1800, refundedSeconds: 1800, state: "partially_refunded" });

  const pendingCancel = normalizePlan({
    plan: { plan: "pro", rawPlan: "plan_pro", status: "pending-cancel", renewsAt: "2026-12-01T00:00:00.000Z", graceUntil: null },
  });
  expect(pendingCancel.plan.status).toBe("pending-cancel");
  expect(pendingCancel.plan.renewsAt).toBe("2026-12-01T00:00:00.000Z");

  // Pack-only workspace stays Free: purchased credits stack, plan does not flip.
  const packOnly = normalizePlan({ plan: { plan: "free", status: "active" }, purchasedMinutes: 60, includedRemainingMinutes: 60 });
  expect(packOnly.plan.plan).toBe("free");
  expect(totalRemainingMinutes(packOnly)).toBe(120);
});

it("keeps recurring capability unavailable when the store lacks subscriptions", () => {
  const plan = normalizePlan({ capabilities: { usage: true, commerce: false, checkout: false, paidEntitlements: true, purchasedCredits: true, subscriptions: false, refunds: true, portal: false } });
  expect(plan.capabilities).toMatchObject({ subscriptions: false, portal: false });
  expect(normalizePlan({}).capabilities).toBeNull();
});

it("totals remaining minutes as included plus purchased", () => {
  expect(totalRemainingMinutes({ includedRemainingMinutes: 60, purchasedMinutes: 60, remainingMinutes: 120 })).toBe(120);
  expect(totalRemainingMinutes({ includedRemainingMinutes: 60, purchasedMinutes: null, remainingMinutes: 60 })).toBe(60);
  // Pack-only workspace: no included allowance, purchased packs still count.
  expect(totalRemainingMinutes({ includedRemainingMinutes: null, purchasedMinutes: 30, remainingMinutes: 30 })).toBe(30);
  expect(totalRemainingMinutes({ includedRemainingMinutes: null, purchasedMinutes: null, remainingMinutes: null })).toBeNull();
  expect(normalizePlan({}).remainingMinutes).toBeNull();
});

it("renders unknown minutes as unknown, never as zero", () => {
  expect(formatNullableMinutes(null)).toBe("—");
  expect(formatNullableMinutes(0)).toBe("0 min");
  expect(formatNullableMinutes(90)).toContain("h");
});
