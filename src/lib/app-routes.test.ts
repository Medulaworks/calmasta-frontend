import { existsSync } from "node:fs";
import { expect, it } from "vitest";
import nextConfig from "../../next.config";
import { safeReturnTo } from "../server/auth/security";
import { dashboardPath } from "./app-routes";

it("redirects legacy authenticated page URLs into the dashboard namespace", async () => {
  const redirects = await nextConfig.redirects?.();
  for (const root of ["voice", "capture", "captures", "library", "calendar", "booking", "plan", "profile", "settings", "welcome"]) {
    expect(redirects).toContainEqual({ source: `/${root}/:path*`, destination: `/dashboard/${root}/:path*`, permanent: false });
  }
  // The staff area moves under /dashboard too, except /admin/login, which is the staff sign-in page itself.
  expect(redirects).toContainEqual({ source: "/admin", destination: "/dashboard/admin", permanent: false });
  expect(redirects).toContainEqual({ source: "/admin/:path((?!login$).+)", destination: "/dashboard/admin/:path", permanent: false });
  expect(redirects).not.toContainEqual(expect.objectContaining({ source: "/admin/:path*" }));
});

it("keeps authenticated workspace, onboarding and staff layouts under dashboard", () => {
  for (const file of ["(app)/page.tsx", "(app)/voice/page.tsx", "(app)/library/recordings/[id]/page.tsx", "(app)/layout.tsx", "welcome/page.tsx", "admin/layout.tsx"]) {
    expect(existsSync(`src/app/dashboard/${file}`), file).toBe(true);
  }
  for (const page of ["login", "reset-password", "verify-email"]) expect(existsSync(`src/app/auth/${page}/page.tsx`)).toBe(true);
  expect(existsSync("src/app/(public)/book/[slug]/page.tsx")).toBe(true);
});

it("canonicalizes safe legacy login destinations while preserving query strings and fragments", () => {
  expect(safeReturnTo("/library/recordings/example?q=budget#transcript")).toBe("/dashboard/library/recordings/example?q=budget#transcript");
  expect(safeReturnTo("/dashboard/voice")).toBe("/dashboard/voice");
  expect(safeReturnTo("https://outside.invalid/voice")).toBe("/dashboard");
  expect(safeReturnTo("/api/auth/login")).toBe("/dashboard");
});

it("normalizes backend app links without changing public, API or external URLs", () => {
  expect(dashboardPath("/library/recordings/example?tab=audio#player")).toBe("/dashboard/library/recordings/example?tab=audio#player");
  for (const href of ["/api/calendar/agenda", "/book/example", "/manage/example", "/auth/verify-email?token=example", "https://store.example/plan", "/dashboard/voice", "/library-extra"]) {
    expect(dashboardPath(href)).toBe(href);
  }
});
