import { existsSync } from "node:fs";
import { expect, it } from "vitest";
import nextConfig from "../../next.config";
import { safeReturnTo } from "../server/auth/security";

it("serves authentication screens under auth and redirects legacy URLs", async () => {
  const redirects = await nextConfig.redirects?.();
  for (const page of ["login", "reset-password", "verify-email", "change-password"]) {
    expect(existsSync(`src/app/auth/${page}/page.tsx`)).toBe(true);
    expect(redirects).toContainEqual({ source: `/${page}/:path*`, destination: `/auth/${page}/:path*`, permanent: false });
  }
  expect(redirects).toContainEqual({ source: "/dashboard/change-password/:path*", destination: "/auth/change-password/:path*", permanent: false });
});

it("prevents login redirect loops while allowing the authenticated password-change destination", () => {
  expect(safeReturnTo("/auth/login?returnTo=/dashboard")).toBe("/dashboard");
  expect(safeReturnTo("/login?returnTo=/dashboard")).toBe("/dashboard");
  expect(safeReturnTo("/dashboard/change-password")).toBe("/auth/change-password");
});
