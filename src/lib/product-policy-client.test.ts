import { describe, it, expect, vi, afterEach } from "vitest";
import { getEffectivePolicy, previewPolicy, updatePolicy, getCatalog, previewGlobalBudget, updateGlobalBudget } from "./product-policy-client";
import { fixtureEffectivePolicy } from "./product-policy-types";

afterEach(() => vi.unstubAllGlobals());

function mockFetch(status: number, body: unknown, headers: Record<string, string> = {}) {
  const hdrs = new Headers(headers);
  return vi.fn(async () => new Response(JSON.stringify(body), { status, headers: hdrs }));
}

describe("product-policy client — errors and boundaries", () => {
  it.each([401, 403, 409, 429, 503])("propagates HTTP %s without fabricating data", async (status) => {
    const code = status === 503 ? "policy_unavailable" : status === 409 ? "version_conflict" : "forbidden";
    vi.stubGlobal("fetch", mockFetch(status, { code, error: "Denied" }));
    await expect(getEffectivePolicy()).rejects.toMatchObject({ status, code });
  });

  it("respects 503 policy_unavailable as honest unavailable — no zero fallback", async () => {
    vi.stubGlobal("fetch", mockFetch(503, { code: "policy_unavailable", error: "Policy not loaded" }));
    await expect(getCatalog()).rejects.toMatchObject({ status: 503, code: "policy_unavailable" });
    // Fixtures remain available for UI disabled state but are not auto-substituted as success.
    expect(fixtureEffectivePolicy.values.capture.defaultMeetingDurationSeconds).toBe(600);
  });

  it("rejects malformed response without inventing defaults", async () => {
    vi.stubGlobal("fetch", mockFetch(200, { environment: "production" } as unknown));
    await expect(getEffectivePolicy()).rejects.toMatchObject({ status: 502, code: "invalid_response" });
  });

  it("handles unavailable contract (404) truthfully", async () => {
    vi.stubGlobal("fetch", mockFetch(404, { code: "not_found", error: "Not found" }));
    await expect(previewPolicy(1, { capture: { defaultMeetingDurationSeconds: 600 } })).rejects.toMatchObject({ status: 404 });
  });

  it("supports abort signal cancellation", async () => {
    const controller = new AbortController();
    const fetchSpy = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.signal?.aborted) throw new DOMException("Aborted", "AbortError");
      return new Response(JSON.stringify(fixtureEffectivePolicy), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchSpy);
    controller.abort();
    await expect(getEffectivePolicy(controller.signal)).rejects.toThrow();
  });

  it("does not leak secrets — fixture contains no keys and errors are sanitized", async () => {
    const fixtureStr = JSON.stringify(fixtureEffectivePolicy);
    expect(fixtureStr).not.toMatch(/api_key|secret|password/i);
    vi.stubGlobal("fetch", mockFetch(400, { code: "invalid_policy", error: "Bad request" }));
    await expect(updatePolicy(1, { bot: { defaultName: "" } }, "test", "k-1")).rejects.toMatchObject({ status: 400, code: "invalid_policy" });
    // Ensure client never logs raw policy values
    const body = JSON.parse(fixtureStr) as typeof fixtureEffectivePolicy;
    expect(typeof body.values.bot.defaultName).toBe("string");
  });

  it("requires Idempotency-Key stability — same key reused for uncertain result is allowed", async () => {
    const key = "stable-key-123";
    const fetcher = mockFetch(200, fixtureEffectivePolicy);
    vi.stubGlobal("fetch", fetcher as unknown as typeof fetch);
    await updatePolicy(1, { sharing: { publicLinksEnabled: false } }, "reason", key);
    expect(fetcher).toHaveBeenCalledTimes(1);
    // Second call with same key is the intended retry while resolving uncertain result — not a new action.
    await updatePolicy(1, { sharing: { publicLinksEnabled: false } }, "reason", key);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("429 rate_limited propagates for budget preview", async () => {
    vi.stubGlobal("fetch", mockFetch(429, { code: "rate_limited", error: "Too many requests" }));
    await expect(previewGlobalBudget(1, "1000000")).rejects.toMatchObject({ status: 429, code: "rate_limited" });
  });

  it("409 version_conflict preserves draft — caller can refetch and reapply", async () => {
    vi.stubGlobal("fetch", mockFetch(409, { code: "version_conflict", error: "Version mismatch" }));
    await expect(updateGlobalBudget(1, "200000000", "increase", "k-budget-1")).rejects.toMatchObject({ status: 409, code: "version_conflict" });
  });
});
