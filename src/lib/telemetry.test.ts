import { afterEach, beforeEach, expect, it, vi } from "vitest";

let browser: EventTarget & { fetch: typeof fetch; location: { origin: string } };
let outgoing: ReturnType<typeof vi.fn<typeof fetch>>;
let beacon: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.stubEnv("NEXT_PUBLIC_TELEMETRY_ENABLED", "true");
  vi.stubEnv("TELEMETRY_ENABLED", "true");
  vi.spyOn(Math, "random").mockReturnValue(0);
  outgoing = vi.fn<typeof fetch>(async () => new Response(null, { status: 404 }));
  beacon = vi.fn(() => true);
  browser = Object.assign(new EventTarget(), { fetch: outgoing, location: { origin: "https://app.example.test" } });
  vi.stubGlobal("window", browser);
  vi.stubGlobal("fetch", outgoing);
  vi.stubGlobal("navigator", { sendBeacon: beacon });
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it("does not install browser collectors or wrap fetch while ingestion is unavailable", async () => {
  const listen = vi.spyOn(browser, "addEventListener");
  const { registerBrowserTelemetry } = await import("@/instrumentation-client");
  registerBrowserTelemetry();
  expect(browser.fetch).toBe(outgoing);
  expect(listen).not.toHaveBeenCalled();
});

it("never emits browser errors or reports failed telemetry requests into themselves", async () => {
  await import("@/instrumentation-client");
  browser.dispatchEvent(Object.assign(new Event("error"), { message: "private meeting text", filename: "private URL" }));
  browser.dispatchEvent(Object.assign(new Event("unhandledrejection"), { reason: "private content" }));
  await browser.fetch("/api/admin/billing/plans");
  await browser.fetch("/api/telemetry");
  await vi.runAllTimersAsync();
  expect(beacon).not.toHaveBeenCalled();
  expect(outgoing.mock.calls.map(args => args[0])).toEqual(["/api/admin/billing/plans", "/api/telemetry"]);
});

it("keeps legacy telemetry APIs inert including explicit telemetry interactions", async () => {
  const { initTelemetry, trackApiInteraction } = await import("./telemetry");
  initTelemetry(); initTelemetry();
  trackApiInteraction("/api/admin/billing/plans", 404);
  trackApiInteraction("/api/telemetry", 503);
  browser.dispatchEvent(Object.assign(new Event("error"), { message: "private content" }));
  await vi.runAllTimersAsync();
  expect(outgoing).not.toHaveBeenCalled();
  expect(beacon).not.toHaveBeenCalled();
});
