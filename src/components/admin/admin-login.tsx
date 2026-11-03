"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Eye, EyeOff, LoaderCircle, ShieldCheck, TriangleAlert } from "lucide-react";
import { Brand } from "@/components/ui/brand";
import { buttonClass } from "@/components/ui/button";
import { ADMIN_PREVIEW } from "@/lib/admin-preview";

const FIELD =
  "h-11 w-full rounded-xl border border-border bg-background px-4 text-base shadow-sm transition focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent-solid/20";

/** Only staff pages are valid places to return to from here. */
const safeReturn = (p: string | null) => (p && p.startsWith("/dashboard/admin") && !p.includes("//") && !p.includes("\\") ? p : "/dashboard/admin");

const post = (path: string, body: unknown) =>
  fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

/**
 * Staff sign-in. It is its own screen with its own cookie: it always asks for the email and password, even when the person is
 * already signed in to Jooba, and signing in to Jooba never opens the staff area. The server only accepts accounts on the
 * staff list, and checks again on every staff request, so this screen is a front door, not the lock.
 */
export function AdminLogin() {
  const router = useRouter();
  const returnTo = safeReturn(useSearchParams().get("returnTo"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);


  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (ADMIN_PREVIEW) return router.replace(returnTo);
    setBusy(true);
    try {
      const res = await post("/api/auth/staff", { email, password });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPassword("");
        setError(
          res.status === 429 ? "Too many attempts. Please wait a few minutes."
          : data.code === "not_staff" ? "This account isn't an admin."
          : data.error === "invalid_credentials" ? "That email or password isn't right."
          : "We couldn't sign you in. Please try again.",
        );
        return;
      }
      router.replace(returnTo);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden bg-surface px-4 py-10">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,color-mix(in_srgb,var(--accent-solid)_16%,transparent),transparent_55%)]" />
      <div className="relative w-full max-w-[26rem]">
        <div className="mb-6 flex items-center justify-center gap-3 text-xl">
          <Brand size={36} />
          <span className="rounded-md bg-danger-solid px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-white">Admin</span>
        </div>

        <div className="rounded-2xl border border-border bg-background p-7 shadow-[0_24px_60px_-28px_rgb(0_0_0/0.35)]">
          <span aria-hidden className="grid size-11 place-items-center rounded-xl bg-accent/10 text-accent">
            <ShieldCheck className="size-6" />
          </span>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">Sign in to admin</h1>

          {ADMIN_PREVIEW && (
            <p role="note" className="mt-5 flex items-start gap-2.5 rounded-xl border border-warning/30 bg-warning/10 px-3.5 py-3 text-sm text-warning">
              <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
              <span><span className="font-medium">Preview.</span> Any email and password works.</span>
            </p>
          )}

          {error && (
            <p role="alert" className="mt-5 rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-sm text-danger">
              {error}
            </p>
          )}

          <form onSubmit={submit} className="mt-6 space-y-4">
            <>
                <div>
                  <label htmlFor="staff-email" className="mb-1.5 block text-sm font-medium">Work email</label>
                  <input id="staff-email" type="email" required autoFocus autoComplete="username" disabled={busy} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" className={FIELD} />
                </div>
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <label htmlFor="staff-password" className="text-sm font-medium">Password</label>
                    <Link href="/auth/login" className="text-sm text-muted hover:text-foreground hover:underline">Forgot password?</Link>
                  </div>
                  <div className="relative">
                    <input id="staff-password" type={show ? "text" : "password"} required minLength={ADMIN_PREVIEW ? undefined : 8} autoComplete="current-password" disabled={busy} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Your password" className={`${FIELD} pr-12`} />
                    <button type="button" aria-label={show ? "Hide password" : "Show password"} aria-pressed={show} onClick={() => setShow((s) => !s)} className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-xl text-muted transition-colors hover:text-foreground">
                      {show ? <EyeOff aria-hidden className="size-5" /> : <Eye aria-hidden className="size-5" />}
                    </button>
                  </div>
                </div>
            </>
            <button type="submit" disabled={busy} className={`${buttonClass("primary", "group min-h-11! w-full rounded-xl text-base", "lg")}${busy ? " pointer-events-none opacity-60" : ""}`}>
              {busy ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : null}
              {busy ? "Signing in…" : "Sign in"}
              {!busy && <ArrowRight aria-hidden className="size-4 transition-transform group-hover:translate-x-1" />}
            </button>
          </form>
        </div>

        <p className="mt-5 text-center text-sm text-muted">
          Not an admin? <Link href="/auth/login" className="font-medium text-foreground underline hover:no-underline">Go to Jooba</Link>
        </p>
      </div>
    </main>
  );
}
