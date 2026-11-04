import { existsSync } from "node:fs";
import { expect, it } from "vitest";
import nextConfig from "../../next.config";
import { safeReturnTo } from "../server/auth/security";
import { dashboardPath } from "./app-routes";

it("redirects legacy authenticated page URLs into the dashboard namespace and legacy admin into /admin", async () => {
  const redirects = await nextConfig.redirects?.();
  for (const root of ["voice", "capture", "captures", "library", "calendar", "booking", "plan", "profile", "settings", "welcome"]) {
    expect(redirects).toContainEqual({ source: `/${root}/:path*`, destination: `/dashboard/${root}/:path*`, permanent: false });
  }
  expect(redirects).toContainEqual({ source: "/dashboard/admin/:path*", destination: "/admin/:path*", permanent: false });
  expect(redirects).not.toContainEqual({ source: "/admin/:path*", destination: "/dashboard/admin/:path*", permanent: false });
});

it("keeps authenticated workspace and onboarding under dashboard, and staff screens under admin", () => {
  for (const file of ["(app)/page.tsx", "(app)/voice/page.tsx", "(app)/library/recordings/[id]/page.tsx", "(app)/layout.tsx", "welcome/page.tsx"]) {
    expect(existsSync(`src/app/dashboard/${file}`), file).toBe(true);
  }
  expect(existsSync("src/app/admin/(protected)/layout.tsx")).toBe(true);
  expect(existsSync("src/app/admin/auth/login/page.tsx")).toBe(true);
  for (const page of ["login", "reset-password", "verify-email"]) expect(existsSync(`src/app/auth/${page}/page.tsx`)).toBe(true);
  expect(existsSync("src/app/(public)/book/[slug]/page.tsx")).toBe(true);
});

it("canonicalizes safe legacy login destinations while preserving query strings and fragments", () => {
  expect(safeReturnTo("/library/recordings/example?q=budget#transcript")).toBe("/dashboard/library/recordings/example?q=budget#transcript");
  expect(safeReturnTo("/dashboard/voice")).toBe("/dashboard/voice");
  expect(safeReturnTo("/dashboard/admin/customers/example?filter=active#details")).toBe("/admin/customers/example?filter=active#details");
  expect(safeReturnTo("/admin/customers")).toBe("/admin/customers");
  expect(safeReturnTo("/admin/auth/login")).toBe("/dashboard");
  expect(safeReturnTo("/dashboard/admin/auth/login")).toBe("/dashboard");
  expect(safeReturnTo("https://outside.invalid/voice")).toBe("/dashboard");
  expect(safeReturnTo("/api/auth/login")).toBe("/dashboard");
  expect(safeReturnTo("/api/admin/overview")).toBe("/dashboard");
});

it("normalizes backend app links without changing public, API or external URLs", () => {
  expect(dashboardPath("/library/recordings/example?tab=audio#player")).toBe("/dashboard/library/recordings/example?tab=audio#player");
  expect(dashboardPath("/dashboard/admin/customers")).toBe("/admin/customers");
  expect(dashboardPath("/admin/customers")).toBe("/admin/customers");
  for (const href of ["/api/calendar/agenda", "/book/example", "/manage/example", "/auth/verify-email?token=example", "https://store.example/plan", "/dashboard/voice", "/library-extra"]) {
    expect(dashboardPath(href)).toBe(href);
  }
});
