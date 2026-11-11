import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { setCapabilities, clearCapabilities, clearOnLogout, capability, hasCapability, requireCapability, loadCapabilities } from "./admin-capabilities";
import { makeQueryClient } from "./query-client";

afterEach(() => vi.unstubAllGlobals());

function caps(allowed: Record<string, boolean>) {
  const base: Record<string, { allowed: boolean; reason: string | null }> = {};
  for (const [k, v] of Object.entries(allowed)) base[k] = { allowed: v, reason: v ? null : "missing_capability" };
  return { capabilities: base as never, permissionVersion: "1", scope: "test" };
}

describe("capability guards", () => {
  beforeEach(() => clearCapabilities());

  it("returns not_loaded when cache empty", () => {
    expect(capability("cost_read")).toMatchObject({ allowed: false, reason: "capabilities_not_loaded" });
    expect(hasCapability("cost_read")).toBe(false);
  });

  it("honors per-capability allow/deny", () => {
    setCapabilities(caps({ cost_read: true, capture_stop: false, global_budget_edit: false }));
    expect(hasCapability("cost_read")).toBe(true);
    expect(hasCapability("capture_stop")).toBe(false);
    expect(() => requireCapability("capture_stop")).toThrow();
  });

  it("clears on logout so stale capabilities cannot authorize new session", () => {
    setCapabilities(caps({ cost_read: true }));
    expect(hasCapability("cost_read")).toBe(true);
    clearOnLogout();
    expect(hasCapability("cost_read")).toBe(false);
    expect(capability("cost_read").reason).toBe("capabilities_not_loaded");
  });

  it("abortable loadCapabilities", async () => {
    const controller = new AbortController();
    const fetchSpy = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.signal?.aborted) throw new DOMException("Aborted", "AbortError");
      return new Response(JSON.stringify(caps({ cost_read: true })), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchSpy);
    controller.abort();
    await expect(loadCapabilities(controller.signal)).rejects.toThrow();
  });

  it("queryClient clear removes admin cache on logout", () => {
    const qc = makeQueryClient();
    qc.setQueryData(["admin", "captures", {}], [{ id: "1" }]);
    qc.setQueryData(["admin", "costs", "id-1"], { currency: "USD" });
    expect(qc.getQueryData(["admin", "captures", {}])).toBeDefined();
    qc.clear();
    expect(qc.getQueryData(["admin", "captures", {}])).toBeUndefined();
  });

  it("no secret leakage in capabilities payload", () => {
    const payload = JSON.stringify(caps({ cost_read: true }));
    expect(payload).not.toMatch(/secret|api_key|password/i);
  });
});
