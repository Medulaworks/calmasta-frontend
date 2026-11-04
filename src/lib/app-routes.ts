export const AUTHENTICATED_PAGE_ROOTS = [
  "voice", "capture", "captures", "library", "calendar", "booking",
  "plan", "profile", "settings", "welcome",
] as const;

export const AUTH_PAGE_ROOTS = ["login", "reset-password", "verify-email", "change-password"] as const;

/** Canonicalizes legacy app links, including links supplied by the backend. */
export function dashboardPath(href: string): string {
  if (/^\/dashboard\/change-password(?:[/?#]|$)/.test(href)) return href.replace("/dashboard/change-password", "/auth/change-password");
  if (/^\/dashboard\/admin(?:[/?#]|$)/.test(href)) return href.replace("/dashboard/admin", "/admin");
  const root = href.split(/[/?#]/)[1];
  if (AUTH_PAGE_ROOTS.some((page) => page === root) && href.startsWith("/")) return `/auth${href}`;
  return AUTHENTICATED_PAGE_ROOTS.some((page) => page === root) && href.startsWith("/")
    ? `/dashboard${href}`
    : href;
}
