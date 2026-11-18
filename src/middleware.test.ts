import { NextRequest } from "next/server";
import { expect, it } from "vitest";
import { middleware } from "./middleware";

function request(path: string, sessionCookie?: string) {
  const req = new NextRequest(new URL(path, "http://localhost:3006"));
  if (sessionCookie) req.cookies.set(sessionCookie, "fixture-session-id");
  return req;
}

it("sends cookie-less dashboard visits straight to sign-in with returnTo", () => {
  for (const path of ["/dashboard", "/dashboard/voice", "/dashboard/capture?focus=link"]) {
    const res = middleware(request(path));
    expect(res.status).toBe(307);
    const to = new URL(res.headers.get("location")!);
    expect(to.pathname).toBe("/auth/login");
    expect(to.searchParams.get("returnTo")).toBe(path);
  }
});

it("lets requests carrying either session cookie through to the shell", () => {
  for (const cookie of ["calmasta_session", "__Host-calmasta_session"]) {
    const res = middleware(request("/dashboard/voice", cookie));
    // NextResponse.next() has no redirect location.
    expect(res.headers.get("location")).toBeNull();
  }
});
