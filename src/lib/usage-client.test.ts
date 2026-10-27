import { afterEach, expect, it, vi } from "vitest";
import { UsageError, fetchUsageSummary } from "./usage-client";

const fetcher = vi.fn();
afterEach(() => {
  vi.unstubAllGlobals();
  fetcher.mockReset();
});

it("consumes GET /api/usage/summary and maps quota metrics accurately", async () => {
  vi.stubGlobal("fetch", fetcher);
  fetcher.mockResolvedValue(
    new Response(
      JSON.stringify({
        plan: "plan_free",
        processingPaused: false,
        limitSeconds: 7200,
        usedSeconds: 1800,
        reservedSeconds: 600,
        remainingSeconds: 4800,
      }),
      { status: 200 },
    ),
  );

  const summary = await fetchUsageSummary();
  expect(fetcher).toHaveBeenCalledWith("/api/usage/summary");
  expect(summary).toEqual({
    plan: "plan_free",
    processingPaused: false,
    limitSeconds: 7200,
    usedSeconds: 1800,
    reservedSeconds: 600,
    remainingSeconds: 4800,
  });
});

it("handles processingPaused, zero quota, and fallback defaults", async () => {
  vi.stubGlobal("fetch", fetcher);
  fetcher.mockResolvedValue(
    new Response(
      JSON.stringify({
        plan: "plan_free",
        processingPaused: true,
        limitSeconds: 3600,
        usedSeconds: 3600,
        reservedSeconds: 0,
        remainingSeconds: 0,
      }),
      { status: 200 },
    ),
  );

  const summary = await fetchUsageSummary();
  expect(summary.processingPaused).toBe(true);
  expect(summary.remainingSeconds).toBe(0);
});

it("handles 401 unauthenticated session and API error responses", async () => {
  vi.stubGlobal("fetch", fetcher);
  fetcher.mockResolvedValueOnce(new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }));

  await expect(fetchUsageSummary()).rejects.toMatchObject({
    status: 401,
    message: "Your session ended. Please sign in again.",
  });

  fetcher.mockResolvedValueOnce(new Response(JSON.stringify({ error: "Server error" }), { status: 500 }));
  await expect(fetchUsageSummary()).rejects.toBeInstanceOf(UsageError);
});
