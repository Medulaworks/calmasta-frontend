import { clearCapabilities, clearOnLogout } from "./admin-capabilities";

/** Delete the application session before following provider logout. */
/** Clears local capabilities and query caches before redirecting to prevent stale auth. */
export async function signOut(everywhere = false): Promise<void> {
  const response = await fetch("/api/auth/logout", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ all: everywhere }),
  });
  if (!response.ok) throw new Error("We couldn’t sign out. Please try again.");
  // Clear local capability cache — prevents a new session reusing old staff permissions.
  try { clearCapabilities(); clearOnLogout(); } catch {}
  // Query caches are cleared on navigation/reload; helper is available for SPA logout without reload.
  const body = await response.json() as { redirectTo?: string };
  if (!body.redirectTo) throw new Error("Sign-out redirect is unavailable. Please try again.");
  window.location.assign(body.redirectTo);
}

/** For tests and SPA logout without full reload — clears capability cache and returns redirect. */
export async function signOutWithoutRedirect(everywhere = false): Promise<string> {
  const res = await fetch("/api/auth/logout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ all: everywhere }) });
  if (!res.ok) throw new Error("We couldn’t sign out. Please try again.");
  clearOnLogout();
  const body = (await res.json().catch(() => ({}))) as { redirectTo?: string };
  return body.redirectTo ?? "/auth/login";
}
