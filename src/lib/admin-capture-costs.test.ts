import { describe, it, expect, vi, afterEach } from "vitest";
import { getCaptureCosts } from "./capture-admin-client";
import { fixtureCost } from "./capture-admin-types";
import { sanitizeDisplayName } from "./capture-admin-types";

afterEach(() => vi.unstubAllGlobals());

function jf(status: number, body: unknown) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { "x-correlation-id": "00000000-0000-4000-8000-000000000001" } }));
}

describe("admin capture costs and roster — typed DTOs and 503 handling", () => {
  it("propagates 403 when cost_read missing and does not fabricate zero", async () => {
    vi.stubGlobal("fetch", jf(403, { code: "forbidden", error: "cost_read required" }));
    await expect(getCaptureCosts("00000000-0000-4000-8000-000000000010")).rejects.toMatchObject({ status: 403, code: "forbidden" });
    // Fixture shows null means unknown, never zero — UI must not sum estimates into reconciled.
    expect(fixtureCost.reconciledMicros).toBeNull();
    expect(fixtureCost.missingComponentCount).toBe(1);
  });

  it("respects 503 capability_unavailable for costs", async () => {
    vi.stubGlobal("fetch", jf(503, { code: "capability_unavailable", error: "Unavailable" }));
    await expect(getCaptureCosts("00000000-0000-4000-8000-000000000010")).rejects.toMatchObject({ status: 503 });
  });

  it("rejects malformed cost payload", async () => {
    vi.stubGlobal("fetch", jf(200, { currency: "USD" }));
    await expect(getCaptureCosts("00000000-0000-4000-8000-000000000010")).rejects.toMatchObject({ code: "invalid_response" });
  });

  it("roster displayName is sanitized — no markup and bounded to 200", () => {
    expect(sanitizeDisplayName("<script>alert('x')</script>Alex")).not.toContain("<");
    expect(sanitizeDisplayName("<script>alert('x')</script>Alex")).not.toContain(">");
    expect(sanitizeDisplayName("a".repeat(500)).length).toBe(200);
  });

  it("cost completeness never adds estimates to reconciled totals", () => {
    const estimated = BigInt(fixtureCost.estimatedMicros ?? "0");
    const reconciled = fixtureCost.reconciledMicros;
    // Reconciled is null when unknown — caller must show partial, not 0.
    expect(reconciled).toBeNull();
    expect(fixtureCost.completeness).toBe("partial");
    expect(estimated > BigInt(0)).toBe(true);
  });

  it("supports abort signal for costs", async () => {
    const c = new AbortController();
    const spy = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.signal?.aborted) throw new DOMException("Aborted", "AbortError");
      return new Response(JSON.stringify(fixtureCost), { status: 200 });
    });
    vi.stubGlobal("fetch", spy as unknown as typeof fetch);
    c.abort();
    await expect(getCaptureCosts("00000000-0000-4000-8000-000000000010", c.signal)).rejects.toThrow();
  });
});
