import { NextResponse, type NextRequest } from "next/server";

/**
 * Instant gate for signed-out visitors: without a session cookie there is no
 * session to validate, so send them straight to sign-in before any dashboard
 * UI (not even a skeleton) renders. An expired cookie still passes through —
 * AppShell reads the profile, gets a 401, and redirects with reason=expired.
 */
export function middleware(request: NextRequest) {
  const hasSession =
    request.cookies.has("calmasta_session") ||
    request.cookies.has("__Host-calmasta_session");
  if (hasSession) return NextResponse.next();
  const here = request.nextUrl.pathname + request.nextUrl.search;
  const login = new URL("/auth/login", request.url);
  login.searchParams.set("returnTo", here);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
