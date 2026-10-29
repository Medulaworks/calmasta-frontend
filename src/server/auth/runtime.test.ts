import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fixtures = vi.hoisted(() => ({ config: vi.fn(), register: vi.fn(), proxy: vi.fn(), action: vi.fn() }));
vi.mock("./config", () => ({ authConfig: fixtures.config }));
vi.mock("./store", () => ({ ApiAuthStore: class {} }));
vi.mock("./service", () => ({ AuthService: class {
  register = fixtures.register;
  proxy = fixtures.proxy;
  action = fixtures.action;
} }));

describe("auth route failure logging", () => {
  beforeEach(() => {
    vi.resetModules();
    fixtures.config.mockReset().mockReturnValue({});
    fixtures.register.mockReset();
    fixtures.proxy.mockReset();
    fixtures.action.mockReset();
  });
  afterEach(() => vi.restoreAllMocks());

  it("logs the method and endpoint for a returned backend failure without request secrets", async () => {
    const logs = vi.spyOn(console, "error").mockImplementation(() => {});
    fixtures.register.mockResolvedValue(Response.json({ error: "private" }, { status: 500 }));
    const { authRoute } = await import("./runtime");
    const response = await authRoute("register", new Request("http://localhost/api/auth/register?token=private", { method: "POST", body: "private" }));
    expect(response.status).toBe(500);
    expect(JSON.parse(logs.mock.calls[0][0])).toEqual({ event: "auth_request_failed", method: "POST", endpoint: "/api/auth/register", status: 500 });
    expect(JSON.stringify(logs.mock.calls)).not.toContain("private");
  });

  it("logs configuration exceptions without exposing their message", async () => {
    const logs = vi.spyOn(console, "error").mockImplementation(() => {});
    fixtures.config.mockImplementation(() => { throw new Error("private"); });
    const { authRoute } = await import("./runtime");
    const response = await authRoute("register", new Request("http://localhost/api/auth/register", { method: "POST" }));
    expect(response.status).toBe(503);
    expect(JSON.parse(logs.mock.calls[0][0])).toMatchObject({ endpoint: "/api/auth/register", status: 503 });
    expect(JSON.stringify(logs.mock.calls)).not.toContain("private");
  });

  it("catches asynchronous exceptions and logs proxy route templates without dynamic values", async () => {
    const logs = vi.spyOn(console, "error").mockImplementation(() => {});
    fixtures.proxy.mockRejectedValue(new Error("private"));
    const { authRoute } = await import("./runtime");
    const response = await authRoute("proxy", new Request("http://localhost/api/library/private?token=private"), ["library", "private"]);
    expect(response.status).toBe(503);
    expect(JSON.parse(logs.mock.calls[0][0])).toMatchObject({ method: "GET", endpoint: "/api/[...path]", status: 503 });
    expect(JSON.stringify(logs.mock.calls)).not.toContain("private");
  });

  it("does not log successful or expected client-error responses", async () => {
    const logs = vi.spyOn(console, "error").mockImplementation(() => {});
    const { authRoute } = await import("./runtime");
    for (const status of [200, 400, 401, 409]) {
      fixtures.register.mockResolvedValue(Response.json({}, { status }));
      await authRoute("register", new Request("http://localhost/api/auth/register", { method: "POST" }));
    }
    expect(logs).not.toHaveBeenCalled();
  });
});
