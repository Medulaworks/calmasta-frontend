"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, LoaderCircle, Mail } from "lucide-react";
import { AuthLayout } from "@/components/auth-layout";
import { OtpInput } from "@/components/otp-input";
import { Toast } from "@/components/ui/toast";
import { createEmailVerifier } from "@/lib/email-verification";

const CODE_LENGTH = 6;
const NEXT = "/dashboard/welcome";

const post = (path: string, body: unknown) =>
  fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

/**
 * Email verification by 6-digit code: six boxes, checked as soon as the last digit is in. A verification link from an
 * older email still works (its token is read once, then removed from the address bar).
 */
export function VerifyEmail() {
  const router = useRouter();
  const params = useSearchParams();
  const [linkToken] = useState(() => params.get("token") ?? "");
  const [verifyLink] = useState(() => createEmailVerifier());
  const [email, setEmail] = useState<string | null>(null);
  const [signedOut, setSignedOut] = useState(false);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(Boolean(linkToken));
  const [error, setError] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);
  const [boxKey, setBoxKey] = useState(0);
  const [resendIn, setResendIn] = useState(0);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (params.has("token")) window.history.replaceState(null, "", window.location.pathname);
  }, [params]);

  // Who is verifying? Someone who is already verified has nothing to do here.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/me").then(
      async (res) => {
        if (cancelled) return;
        if (res.status === 401) return setSignedOut(true);
        const profile = (await res.json().catch(() => null)) as { email?: string; emailVerified?: boolean; onboarded?: boolean } | null;
        if (cancelled || !profile) return;
        if (profile.emailVerified) router.replace(profile.onboarded ? "/dashboard" : NEXT);
        else setEmail(profile.email ?? null);
      },
      () => undefined,
    );
    return () => { cancelled = true; };
  }, [router]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = window.setTimeout(() => setResendIn((n) => n - 1), 1000);
    return () => window.clearTimeout(t);
  }, [resendIn]);

  // An old verification link: verify it once.
  useEffect(() => {
    if (!linkToken) return;
    let cancelled = false;
    verifyLink(linkToken).then(
      () => { if (!cancelled) { setBusy(false); setDone(true); } },
      (e: unknown) => {
        if (cancelled) return;
        setBusy(false);
        setError(`${e instanceof Error ? e.message : "That link could not be used."} You can enter the code from your latest email instead.`);
      },
    );
    return () => { cancelled = true; };
  }, [linkToken, verifyLink]);

  // Verified: a moment to see it, then on to setup.
  useEffect(() => {
    if (!done) return;
    const t = window.setTimeout(() => router.replace(NEXT), 1600);
    return () => window.clearTimeout(t);
  }, [done, router]);

  async function verify(code: string) {
    if (busy || code.length !== CODE_LENGTH) return;
    setError(null);
    setBusy(true);
    try {
      const res = await post("/api/auth/verify-email", { code });
      if (res.ok) return setDone(true);
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) return setSignedOut(true);
      setInvalid(true);
      setBoxKey((k) => k + 1);
      setError(
        data.error === "expired_code"
          ? "That code has expired. Send a new one below."
          : data.error === "too_many_attempts" || res.status === 429
            ? "Too many attempts. Send a new code below."
            : "That code isn't right. Check the email and try again.",
      );
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    if (busy || resendIn > 0) return;
    setError(null);
    setBusy(true);
    try {
      const res = await post("/api/auth/verify-email/resend", {});
      if (res.ok) {
        setResendIn(60);
        setInvalid(false);
        setBoxKey((k) => k + 1);
        setToast(email ? `We sent a new code to ${email}.` : "We sent a new code.");
      } else if (res.status === 401) setSignedOut(true);
      else setError(res.status === 429 ? "Please wait a moment before asking for another code." : "We couldn't send a new code. Please try again later.");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    await post("/api/auth/logout", {}).catch(() => undefined);
    router.replace("/auth/login");
  }

  return (
    <AuthLayout>
      {toast && <Toast message={toast} tone="success" onClose={() => setToast(null)} />}

      <span aria-hidden className={`mb-4 grid size-12 place-items-center rounded-2xl ${done ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-accent/10 text-accent"}`}>
        {done ? <Check className="size-6" /> : <Mail className="size-6" />}
      </span>

      <h1 className="text-[clamp(2rem,5vh,3rem)] font-semibold leading-[1.1] tracking-tight">
        {done ? <>Email <span className="text-accent">verified</span>.</> : <>Verify your <span className="text-accent">email</span>.</>}
      </h1>
      <p className="mt-3 text-[clamp(0.9375rem,2.1vh,1.0625rem)] leading-[1.55] text-muted">
        {done
          ? "You're all set. Taking you to setup…"
          : signedOut
            ? "Sign in first, then you can enter your code."
            : email
              ? <>We sent a 6-digit code to <span className="font-medium text-foreground">{email}</span>. Enter it to start recording.</>
              : "Enter the 6-digit code we emailed you to start recording."}
      </p>

      {error && (
        <p role="alert" className="mt-5 rounded-xl border border-danger/30 bg-danger/10 px-4 py-2.5 text-sm text-danger">
          {error}
        </p>
      )}

      {!done && !signedOut && (
        <div className="mt-[clamp(1.25rem,4vh,2rem)] space-y-[clamp(0.75rem,2.4vh,1.25rem)]">
          <OtpInput key={boxKey} length={CODE_LENGTH} disabled={busy} invalid={invalid} label="Email verification code" onChange={() => invalid && setInvalid(false)} onComplete={(c) => void verify(c)} />
          {busy && <p role="status" className="flex items-center justify-center gap-2 text-center text-sm text-muted"><LoaderCircle aria-hidden className="size-4 animate-spin" />Checking your code…</p>}
          <p className="text-center text-sm text-muted">
            Didn&rsquo;t get it?{" "}
            {resendIn > 0 ? (
              <span className="tabular-nums">Send a new code in {resendIn}s</span>
            ) : (
              <button type="button" disabled={busy} onClick={() => void resend()} className="font-medium text-foreground underline hover:no-underline disabled:opacity-50">
                Send a new code
              </button>
            )}
          </p>
        </div>
      )}

      {signedOut && (
        <a href="/auth/login" className="mt-6 block text-center text-sm font-medium text-foreground underline hover:no-underline">Back to sign in</a>
      )}
      {!done && !signedOut && (
        <button type="button" onClick={() => void signOut()} className="mx-auto mt-6 block text-sm text-muted transition-colors hover:text-foreground hover:underline">
          Use a different account
        </button>
      )}
    </AuthLayout>
  );
}
