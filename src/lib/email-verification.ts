/** Component-scoped request sharing prevents duplicate single-use token submissions in Strict Mode. */
export function createEmailVerifier() {
  let current: { token: string; request: Promise<void> } | undefined;
  return (token: string): Promise<void> => {
    if (!token) return Promise.reject(new Error("Open the link in your verification email."));
    if (current?.token === token) return current.request;
    const request = (async () => {
      let response: Response;
      try {
        response = await fetch("/api/auth/verify-email", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }),
        });
      } catch {
        throw new Error("We can’t connect right now. Check your connection and try again.");
      }
      if (!response.ok) throw new Error(response.status === 400
        ? "This verification link has expired or has already been used. Request a new verification email."
        : "Email verification is temporarily unavailable. Please try again later.");
    })();
    current = { token, request };
    return request;
  };
}
