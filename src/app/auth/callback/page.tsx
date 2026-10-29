"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

function CallbackInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = params.get("code");
    const state = params.get("state");
    const stored = (() => { try { return sessionStorage.getItem("microsoft_oauth_state") || sessionStorage.getItem("oauth_state"); } catch { return null; } })();
    if (!code || !state) { setError("Missing code or state. Please try signing in again."); return; }
    if (stored && stored !== state) { setError("Invalid state. Please try signing in again."); return; }
    // Prefer BFF POST that sets HttpOnly session cookie, then route to dashboard
    fetch("/api/auth/microsoft/callback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, state }),
    }).then(async (res) => {
      if (res.redirected || res.status === 303 || res.headers.get("location")) {
        const loc = res.headers.get("location") || "/dashboard";
        window.location.assign(loc);
        return;
      }
      if (res.ok) {
        // Clear stored state on success
        try { sessionStorage.removeItem("microsoft_oauth_state"); sessionStorage.removeItem("oauth_state"); } catch {}
        // Backend BFF sets session cookie; also handles tokens internally. Route to dashboard.
        router.replace("/dashboard");
        return;
      }
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Microsoft sign-in failed. Please try again.");
    }).catch(() => setError("Network error. Please try again."));
  }, [params, router]);

  if (error) return <div className="p-8 text-center text-sm text-danger" role="alert">{error}</div>;
  return <div className="p-8 text-center text-sm text-muted">Completing Microsoft sign-in…</div>;
}

export default function CallbackPage() {
  return <Suspense fallback={<div className="p-8 text-center text-sm text-muted">Loading…</div>}><CallbackInner /></Suspense>;
}
