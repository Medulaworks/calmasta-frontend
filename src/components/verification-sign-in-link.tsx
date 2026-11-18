"use client";

import { useState } from "react";
import { signOut } from "@/lib/auth-client";

/** Verification users still have a session: clear it so login cannot redirect them back here. */
export function VerificationSignInLink({ disabled = false }: { disabled?: boolean }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function back() {
    if (pending || disabled) return;
    setPending(true);
    setError("");
    try { await signOut(); }
    catch { setError("We couldn’t return to sign in. Please try again."); setPending(false); }
  }
  return <>
    <button type="button" disabled={pending || disabled} aria-busy={pending} onClick={back} className="mt-6 block w-full text-center text-xs font-medium text-foreground underline hover:no-underline disabled:opacity-50">
      {pending ? "Returning to sign in…" : "Back to sign in"}
    </button>
    {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
  </>;
}
