"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Eye, EyeOff, KeyRound, Mail } from "lucide-react";
import { OtpInput } from "@/components/otp-input";
import { buttonClass } from "@/components/ui/button";

type Step = "email" | "code" | "password";
const CODE_LENGTH = 6;
const MIN_PASSWORD = 8;

const FIELD =
  "h-[clamp(2.5rem,5.6vh,3rem)] w-full rounded-xl border border-border bg-background px-4 text-base shadow-sm transition focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent-solid/20";
const PRIMARY =
  "group min-h-[clamp(2.5rem,5.6vh,3rem)]! w-full rounded-xl text-base shadow-[0_10px_24px_-10px_color-mix(in_srgb,var(--accent-solid)_90%,transparent)] transition-all hover:-translate-y-0.5 hover:shadow-[0_16px_28px_-12px_color-mix(in_srgb,var(--accent-solid)_95%,transparent)] active:translate-y-0";

const post = (path: string, body: unknown) =>
  fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

/**
 * Forgot-password flow, one screen per step: email, then the code from the email, then a new password. The code is
 * checked on its own (so a wrong code is caught at once) and exchanged for a short-lived reset token that only lives in
 * this component's memory. Nothing here is put in a URL.
 */
export function PasswordReset({ initialEmail, onDone }: { initialEmail: string; onDone: (email: string, notice?: string) => void }) {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState(initialEmail);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [codeInvalid, setCodeInvalid] = useState(false);
  const [codeKey, setCodeKey] = useState(0);
  const [resetToken, setResetToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = window.setTimeout(() => setResendIn((n) => n - 1), 1000);
    return () => window.clearTimeout(t);
  }, [resendIn]);

  /** Emails a new code. The answer is the same whether or not the address has an account. */
  async function sendCode() {
    setError(null);
    setBusy(true);
    try {
      const res = await post("/api/auth/forgot-password", { email });
      if (res.ok) {
        setStep("code");
        setResendIn(60);
        setCodeInvalid(false);
        setCodeKey((k) => k + 1);
      } else {
        setError(
          res.status === 503
            ? "Email delivery is temporarily unavailable. Please try again shortly."
            : res.status === 429
              ? "Too many requests. Please wait a moment before trying again."
              : "We couldn't send a code. Check your email address and try again.",
        );
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(code: string) {
    if (busy || code.length !== CODE_LENGTH) return;
    setError(null);
    setBusy(true);
    try {
      const res = await post("/api/auth/verify-reset-code", { email, code });
      const data = await res.json().catch(() => ({}));
      if (res.ok && typeof data.resetToken === "string" && data.resetToken) {
        setResetToken(data.resetToken);
        setStep("password");
        return;
      }
      setCodeInvalid(true);
      setCodeKey((k) => k + 1);
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

  async function updatePassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < MIN_PASSWORD) return setError(`Use at least ${MIN_PASSWORD} characters.`);
    if (password !== confirm) return setError("The two passwords don't match.");
    setBusy(true);
    try {
      const res = await post("/api/auth/reset-password", { token: resetToken, password });
      if (res.ok) {
        onDone(email, "Your password was updated. Sign in with your new password.");
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (res.status === 400 || res.status === 410 || data.error === "invalid_token" || data.error === "expired_token") {
        setStep("email");
        setResetToken("");
        setPassword("");
        setConfirm("");
        setError("Your reset session expired. Request a new code to continue.");
      } else {
        setError("We couldn't update your password. Please try again.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function back() {
    setError(null);
    setCodeInvalid(false);
    if (step === "email") onDone(email);
    else {
      setStep("email");
      setResetToken("");
      setPassword("");
      setConfirm("");
    }
  }

  const longEnough = password.length >= MIN_PASSWORD;
  const matches = confirm.length > 0 && password === confirm;
  const stepNo = step === "email" ? 1 : step === "code" ? 2 : 3;

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={back}
          disabled={busy}
          aria-label={step === "email" ? "Back to sign in" : "Back"}
          className="inline-flex size-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface hover:text-foreground disabled:opacity-50">
          <ArrowLeft aria-hidden className="size-5" />
        </button>
        <ol className="flex items-center gap-1.5" aria-label={`Step ${stepNo} of 3`}>
          {[1, 2, 3].map((n) => (
            <li key={n} aria-current={n === stepNo ? "step" : undefined} className={`h-1 rounded-full transition-all ${n === stepNo ? "w-6 bg-accent-solid" : n < stepNo ? "w-3 bg-accent/50" : "w-3 bg-border"}`} />
          ))}
        </ol>
      </div>

      {step !== "email" && (
        <span aria-hidden className="mb-4 grid size-12 place-items-center rounded-2xl bg-accent/10 text-accent">
          {step === "code" ? <Mail className="size-6" /> : <KeyRound className="size-6" />}
        </span>
      )}

      <h1 className="text-[clamp(2rem,5vh,3rem)] font-semibold leading-[1.1] tracking-tight">
        {step === "email" ? (
          <>Let&rsquo;s get you <span className="text-accent">back in</span>.</>
        ) : step === "code" ? (
          <>Check your <span className="text-accent">email</span>.</>
        ) : (
          <>Create a <span className="text-accent">new password</span>.</>
        )}
      </h1>
      <p className="mt-3 text-[clamp(0.9375rem,2.1vh,1.0625rem)] leading-[1.55] text-muted">
        {step === "email"
          ? "Enter your account email and we'll send you a 6-digit code."
          : step === "code"
            ? <>If an account exists for <span className="font-medium text-foreground">{email}</span>, we&rsquo;ve sent a 6-digit code. It expires in 10 minutes.</>
            : "Choose a password you haven't used before. You'll sign in with it next."}
      </p>

      {error && (
        <p role="alert" className="mt-5 rounded-xl border border-danger/30 bg-danger/10 px-4 py-2.5 text-sm text-danger">
          {error}
        </p>
      )}

      {step === "email" && (
        <form
          onSubmit={(e) => { e.preventDefault(); void sendCode(); }}
          className="mt-[clamp(1rem,3.4vh,2rem)] space-y-[clamp(0.75rem,2vh,1.25rem)]">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground" htmlFor="reset-email">Email Address</label>
            <input id="reset-email" type="email" required autoFocus autoComplete="email" disabled={busy} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className={FIELD} />
          </div>
          <button type="submit" disabled={busy} className={`${buttonClass("primary", PRIMARY, "lg")}${busy ? " pointer-events-none opacity-60" : ""}`}>
            {busy ? "Sending…" : "Send code"}
            {!busy && <ArrowRight aria-hidden className="size-4.5 transition-transform group-hover:translate-x-1" />}
          </button>
        </form>
      )}

      {step === "code" && (
        <div className="mt-[clamp(1.25rem,4vh,2rem)] space-y-[clamp(0.75rem,2.4vh,1.25rem)]">
          <OtpInput key={codeKey} length={CODE_LENGTH} disabled={busy} invalid={codeInvalid} onChange={() => codeInvalid && setCodeInvalid(false)} onComplete={(c) => void verifyCode(c)} />
          {busy && <p role="status" className="text-center text-sm text-muted">Checking your code…</p>}
          <p className="text-center text-sm text-muted">
            Didn&rsquo;t get it?{" "}
            {resendIn > 0 ? (
              <span className="tabular-nums">Send a new code in {resendIn}s</span>
            ) : (
              <button type="button" disabled={busy} onClick={() => void sendCode()} className="font-medium text-foreground underline hover:no-underline disabled:opacity-50">
                Send a new code
              </button>
            )}
          </p>
          <button type="button" onClick={back} disabled={busy} className="mx-auto block text-sm text-muted transition-colors hover:text-foreground hover:underline">
            Use a different email
          </button>
        </div>
      )}

      {step === "password" && (
        <form onSubmit={updatePassword} className="mt-[clamp(1rem,3.4vh,2rem)] space-y-[clamp(0.75rem,2vh,1.25rem)]">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground" htmlFor="new-password">New password</label>
            <div className="relative">
              <input id="new-password" type={showPassword ? "text" : "password"} required autoFocus minLength={MIN_PASSWORD} maxLength={128} autoComplete="new-password" disabled={busy} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" className={`${FIELD} pr-12`} />
              <button type="button" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} aria-controls="new-password" onClick={() => setShowPassword((s) => !s)} className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-xl text-muted transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent">
                {showPassword ? <EyeOff aria-hidden className="size-5" /> : <Eye aria-hidden className="size-5" />}
              </button>
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground" htmlFor="confirm-password">Confirm password</label>
            <input id="confirm-password" type={showPassword ? "text" : "password"} required maxLength={128} autoComplete="new-password" disabled={busy} value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Type it again" className={FIELD} />
          </div>
          <ul className="space-y-1.5 text-sm" aria-live="polite">
            {[["At least 8 characters", longEnough], ["Both passwords match", matches]].map(([t, ok]) => (
              <li key={t as string} className={`flex items-center gap-2 transition-colors ${ok ? "text-emerald-600 dark:text-emerald-400" : "text-muted"}`}>
                <span className={`grid size-4 place-items-center rounded-full border ${ok ? "border-emerald-500 bg-emerald-500 text-white" : "border-border"}`}>
                  {ok && <Check aria-hidden className="size-3" strokeWidth={3} />}
                </span>
                {t as string}
              </li>
            ))}
          </ul>
          <button type="submit" disabled={busy || !longEnough || !matches} className={`${buttonClass("primary", PRIMARY, "lg")}${busy || !longEnough || !matches ? " pointer-events-none opacity-60" : ""}`}>
            {busy ? "Updating…" : "Update password"}
            {!busy && <ArrowRight aria-hidden className="size-4.5 transition-transform group-hover:translate-x-1" />}
          </button>
        </form>
      )}
    </>
  );
}
