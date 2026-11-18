import { afterEach, beforeEach, expect, it, vi } from "vitest";

const hooks = vi.hoisted(() => ({ effects: [] as Array<() => unknown>, cleanups: [] as unknown[], setState: vi.fn(), replace: vi.fn() }));
vi.mock("react", async (original) => ({
  ...await original<typeof import("react")>(),
  useEffect: (effect: () => unknown) => { hooks.effects.push(effect); },
  useState: (initial: unknown) => [initial, hooks.setState],
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: hooks.replace }), usePathname: () => "/admin" }));
import { AdminShell } from "./admin-shell";
import { capability, clearCapabilities, setCapabilities, type CapabilitiesResponse } from "@/lib/admin-capabilities";
const grants = { capabilities: { settings_edit: { allowed: true, reason: null } }, permissionVersion: "db_per_request", scope: "global_staff" } as CapabilitiesResponse;

beforeEach(() => {
  vi.clearAllMocks();
  clearCapabilities();
  hooks.effects = [];
  hooks.cleanups = [];
  vi.stubGlobal("window", { location: { pathname: "/admin" } });
});
afterEach(() => vi.unstubAllGlobals());

async function checkAccess(status: number, capabilityStatus = 200) {
  const principal = { id: "staff-fixture", name: "Admin", email: "admin@example.test", role: "admin", permissions: [] };
  const fetchMock = vi.fn(async (url: string) => new Response(JSON.stringify(url === "/api/admin/me" ? principal : grants), { status: url === "/api/admin/me" ? status : url === "/api/admin/capabilities" ? capabilityStatus : 401 }));
  vi.stubGlobal("fetch", fetchMock);
  AdminShell({ children: null });
  hooks.effects.forEach((effect) => hooks.cleanups.push(effect()));
  await vi.waitFor(() => expect(hooks.setState.mock.calls.length + hooks.replace.mock.calls.length).toBeGreaterThan(0));
  return { fetchMock, principal };
}

it("accepts the isolated admin session without a customer session", async () => {
  const { fetchMock, principal } = await checkAccess(200);
  expect(fetchMock).toHaveBeenCalledWith("/api/admin/me", expect.objectContaining({ credentials: "same-origin", cache: "no-store" }));
  expect(hooks.setState).toHaveBeenCalledWith({ state: "ready", profile: principal });
  expect(hooks.replace).not.toHaveBeenCalled();
});
it("redirects an expired admin session to admin login", async () => {
  await checkAccess(401);
  expect(hooks.replace).toHaveBeenCalledWith("/admin/auth/login?returnTo=%2Fadmin");
});
it("shows denied access for a forbidden admin session", async () => {
  await checkAccess(403);
  expect(hooks.setState).toHaveBeenCalledWith({ state: "denied" });
  expect(hooks.replace).not.toHaveBeenCalled();
});
it("keeps service failures retryable without sending the user to login", async () => {
  await checkAccess(503);
  expect(hooks.setState).toHaveBeenCalledWith({ state: "failed" });
  expect(hooks.replace).not.toHaveBeenCalled();
});

it("loads settings permissions before making the admin area ready", async () => {
  const { fetchMock } = await checkAccess(200);
  expect(fetchMock).toHaveBeenCalledWith("/api/admin/capabilities", expect.objectContaining({ cache: "no-store" }));
  expect(capability("settings_edit")).toEqual({ allowed: true, reason: null });
});
it("blocks the admin area when capabilities cannot be loaded", async () => {
  setCapabilities(grants);
  await checkAccess(200, 503);
  expect(hooks.setState).toHaveBeenCalledWith({ state: "failed" });
  expect(capability("settings_edit").allowed).toBe(false);
});
it("clears cached permissions when leaving the admin shell", async () => {
  await checkAccess(200);
  for (const cleanup of hooks.cleanups) {
    if (typeof cleanup === "function") cleanup();
  }
  expect(capability("settings_edit").allowed).toBe(false);
});
