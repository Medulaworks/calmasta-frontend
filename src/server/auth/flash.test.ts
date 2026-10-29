import { expect, it } from "vitest";
import { authErrorRedirect, consumeAuthError } from "./flash";

it("redirects to a clean login URL and delivers a short-lived HttpOnly error once", async () => {
  const response = authErrorRedirect("invalid_response", false);
  expect(response.headers.get("location")).toBe("/auth/login");
  const cookie = response.headers.get("set-cookie")!;
  expect(cookie).toContain("HttpOnly");
  expect(cookie).toContain("SameSite=Lax");
  expect(cookie).toContain("Max-Age=60");
  const consumed = consumeAuthError(new Request("http://localhost/api/auth/error", { headers: { cookie: cookie.split(";")[0] } }), false);
  expect(await consumed.json()).toEqual({ error: "invalid_response" });
  expect(consumed.headers.get("set-cookie")).toContain("Max-Age=0");
  expect(consumed.headers.get("cache-control")).toBe("no-store");
  expect(await consumeAuthError(new Request("http://localhost/api/auth/error"), false).json()).toEqual({ error: null });
});

it("rejects unknown error codes and uses secure cookies on HTTPS", async () => {
  expect(authErrorRedirect("not_configured", true).headers.get("set-cookie")).toContain("; Secure");
  for (const code of ["private", "constructor", "__proto__"]) {
    const request = new Request("https://localhost/api/auth/error", { headers: { cookie: `calmasta_auth_error=${code}` } });
    expect(await consumeAuthError(request, true).json()).toEqual({ error: null });
  }
});
