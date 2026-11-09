"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Eye, EyeOff, LoaderCircle, ShieldCheck } from "lucide-react";
import { Brand } from "@/components/ui/brand";
import { buttonClass } from "@/components/ui/button";

const FIELD =
  "h-10 w-full rounded-xl border border-border bg-background px-4 text-base shadow-sm transition focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent-solid/20";

const safeReturn = (p: string | null) => (p && p.startsWith("/admin") && !p.includes("//") && !p.includes("\\") ? p : "/admin");

const post = (path: string, body: unknown) =>
  fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

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
    setBusy(true);
    try {
      const res = await post("/api/admin/auth/login", { email, password });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPassword("");
        const corr = data.correlationId ? ` (ref ${String(data.correlationId).slice(0, 8)})` : "";
        setError(
          res.status === 429 ? "Too many attempts. Please wait a few minutes." + corr
          : res.status === 403 || data.code === "not_staff" ? "This account isn't an admin." + corr
          : res.status === 401 || data.code === "invalid_credentials" ? "That email or password isn't right." + corr
          : (data.code ? String(data.code) : data.error ? String(data.error) : "We couldn't sign you in. Please try again.") + corr,
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
          <span className="rounded-md bg-danger-solid px-2 py-1 text-xs font-medium uppercase tracking-wide text-white">Admin</span>
        </div>

        <div className="rounded-2xl border border-border bg-background p-7 shadow-[0_24px_60px_-28px_rgb(0_0_0/0.35)]">
          <span aria-hidden className="grid size-11 place-items-center rounded-xl bg-accent/10 text-accent">
            <ShieldCheck className="size-6" />
          </span>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">Sign in to admin</h1>

          {error && (
            <p role="alert" className="mt-5 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
              {error}
            </p>
          )}

          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="staff-email" className="mb-2 block text-sm font-medium">Work email</label>
              <input id="staff-email" type="email" required autoFocus autoComplete="username" disabled={busy} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" className={FIELD} />
            </div>
            <div>
              <label htmlFor="staff-password" className="mb-2 block text-sm font-medium">Password</label>
              <div className="relative">
                <input id="staff-password" type={show ? "text" : "password"} required minLength={8} autoComplete="current-password" disabled={busy} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Your password" className={`${FIELD} pr-12`} />
                <button type="button" aria-label={show ? "Hide password" : "Show password"} aria-pressed={show} onClick={() => setShow((s) => !s)} className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-xl text-muted transition-colors hover:text-foreground">
                  {show ? <EyeOff aria-hidden className="size-5" /> : <Eye aria-hidden className="size-5" />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={busy} className={`${buttonClass("primary", "group min-h-10! w-full rounded-xl text-base", "lg")}${busy ? " pointer-events-none opacity-60" : ""}`}>
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
