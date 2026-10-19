/** Ends the session and follows the server's instruction to where the browser goes next (the provider's logout, then /login). */
export async function signOut(everywhere = false): Promise<void> {
  let redirectTo = "/login";
  try {
    const res = await fetch("/api/auth/logout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: everywhere }),
    });
    if (res.ok) redirectTo = ((await res.json()) as { redirectTo?: string }).redirectTo ?? "/login";
  } catch {
    /* even if the request failed, leave the app: the cookie is HttpOnly so the server is the only one who can clear it */
  }
  window.location.assign(redirectTo);
}
