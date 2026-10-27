/** Delete the application session before following provider logout. */
export async function signOut(everywhere = false): Promise<void> {
  const response = await fetch("/api/auth/logout", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ all: everywhere }),
  });
  if (!response.ok) throw new Error("Could not sign out. Please try again.");
  const body = await response.json() as { redirectTo?: string };
  if (!body.redirectTo) throw new Error("Sign-out redirect is unavailable. Please try again.");
  window.location.assign(body.redirectTo);
}
