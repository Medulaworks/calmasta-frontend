import { afterEach, expect, it, vi } from "vitest";
import { signOut } from "./auth-client";
afterEach(() => vi.unstubAllGlobals());
it("clears the current application session before returning an unverified user to sign-in", async () => {
  const assign = vi.fn();
  vi.stubGlobal("window", { location: { assign } });
  const fetch = vi.fn(async () => {
    expect(assign).not.toHaveBeenCalled();
    return Response.json({ redirectTo: "http://localhost:3006/auth/login" });
  });
  vi.stubGlobal("fetch", fetch);
  await signOut();
  expect(fetch).toHaveBeenCalledExactlyOnceWith("/api/auth/logout", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ all: false }),
  });
  expect(assign).toHaveBeenCalledExactlyOnceWith("http://localhost:3006/auth/login");
});
it("stays on the current screen if session clearing fails", async () => {
  const assign = vi.fn();
  vi.stubGlobal("window", { location: { assign } });
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({}, { status: 503 })));
  await expect(signOut()).rejects.toThrow("Could not sign out");
  expect(assign).not.toHaveBeenCalled();
});
