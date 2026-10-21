"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { authErrorMessage } from "@/lib/auth-errors";
import { buttonClass } from "@/components/ui/button";

/** Only same-site paths survive; mirrors the server's check so the link we build is already safe. */
const safePath = (p: string | null) => (p && p.startsWith("/") && !p.startsWith("//") && !p.includes("\\") && !p.startsWith("/login") && !p.startsWith("/api/auth") ? p : "/dashboard");

export function Login() {
  const params = useSearchParams();
  const returnTo = safePath(params.get("returnTo"));
  const error = authErrorMessage(params.get("error"));
  const expired = params.get("reason") === "expired" && !error;
  const [checking, setChecking] = useState(true);

  // Already signed in? Go straight to where they were headed.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/me").then(
      (res) => {
        if (cancelled) return;
        if (res.ok) window.location.replace(returnTo);
        else setChecking(false);
      },
      () => !cancelled && setChecking(false),
    );
    return () => {
      cancelled = true;
    };
  }, [returnTo]);

  const q = `returnTo=${encodeURIComponent(returnTo)}`;
  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <main className="flex flex-col justify-center px-6 py-12 sm:px-12 md:px-16">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5 text-lg font-semibold tracking-tight">
            <span aria-hidden className="grid h-8 w-8 place-items-center rounded-lg bg-accent-solid text-sm font-bold text-white">C</span>
            CalMasta
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">Welcome</h1>
          <p className="mt-2 text-muted">Sign in to turn your conversations into useful work.</p>

          {expired && (
            <p role="status" className="mt-6 rounded-lg border border-border bg-surface px-4 py-3 text-sm">
              Your session ended, so we signed you out. Signing in again picks up where you left off: your recordings and documents are safe.
            </p>
          )}
          {error && (
            <p role="alert" className="mt-6 rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
              {error}
            </p>
          )}

          {/* Plain links (not next/link): these are full-page navigations to the identity provider, and must never be prefetched. */}
          <div className="mt-8 space-y-3">
            <a href={`/api/auth/login?${q}`} aria-disabled={checking} className={buttonClass("primary", "w-full py-3")}>
              Sign in
            </a>
            <a href={`/api/auth/login?${q}&signup=1`} className={buttonClass("secondary", "w-full py-3")}>
              Create an account
            </a>
          </div>
          <p className="mt-6 text-sm text-muted">Forgot your password? Choose &ldquo;Sign in&rdquo;, then use the reset link on the next page.</p>
          <p className="mt-10 text-xs text-muted">
            CalMasta never sees your password. Sign-in is handled by a dedicated identity provider.
          </p>
        </div>
      </main>
      <aside aria-hidden className="hidden items-center justify-center bg-surface p-12 md:flex">
        <ul className="max-w-sm space-y-4 text-sm">
          {[
            ["Capture", "Meetings and voice notes, with a visible assistant and your consent."],
            ["Transcribe", "A transcript you can read, search and correct."],
            ["Write", "Briefs, minutes and follow-ups you can edit freely."],
          ].map(([t, b]) => (
            <li key={t} className="rounded-xl border border-border bg-background p-5">
              <p className="font-medium">{t}</p>
              <p className="mt-1 text-muted">{b}</p>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
