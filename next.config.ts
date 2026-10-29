import type { NextConfig } from "next";
import { AUTHENTICATED_PAGE_ROOTS, AUTH_PAGE_ROOTS } from "./src/lib/app-routes";

// Baseline browser protections for every response. (A Content-Security-Policy is a worthwhile next step,
// but it needs nonces for Next's inline scripts and should be added and tested on its own.)
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" }, // the app can't be framed: blocks clickjacking
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Recording needs the microphone; nothing else needs camera or location.
  { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=(self)" },
  ...(process.env.NODE_ENV === "production" ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }] : []),
];

const nextConfig: NextConfig = {
  async redirects() {
    return [...AUTHENTICATED_PAGE_ROOTS.map((page) => ({
      source: `/${page}/:path*`,
      destination: `/dashboard/${page}/:path*`,
      permanent: false,
    })), ...AUTH_PAGE_ROOTS.map((page) => ({
      source: `/${page}/:path*`,
      destination: `/auth/${page}/:path*`,
      permanent: false,
    })), { source: "/dashboard/change-password/:path*", destination: "/auth/change-password/:path*", permanent: false }];
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
