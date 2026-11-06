import { afterEach, expect, it, vi } from "vitest";
vi.mock("next/server", () => ({ connection: vi.fn(async () => undefined) }));
import { POST } from "./route";
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
it("does not forward arbitrary browser content or report collection success when telemetry is enabled", async () => {
  vi.stubEnv("TELEMETRY_ENABLED", "true");
  vi.stubEnv("OTEL_EXPORTER_OTLP_ENDPOINT", "https://collector.example.test");
  const outgoing = vi.fn();
  vi.stubGlobal("fetch", outgoing);
  const handler: (request: Request) => Promise<Response> = POST;
  const response = await handler(new Request("https://app.example.test/api/telemetry", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ type: "error", message: "fixture-secret private meeting URL" }) }));
  expect(response.status).toBe(503);
  expect((await response.json()).ok).toBe(false);
  expect(outgoing).not.toHaveBeenCalled();
});
