"use client";

import { useEffect, useState, useSyncExternalStore, type FormEvent } from "react";
import Link from "next/link";
import { VerificationSignInLink } from "@/components/verification-sign-in-link";
import { AUTH_FIELD, AUTH_HEADING, AUTH_DESCRIPTION, AUTH_BUTTON } from "@/components/auth-styles";
import { Eye, EyeOff } from "lucide-react";
import { buttonClass } from "@/components/ui/button";
import { codeSecondsLeft, createAuthCodeFlow, type CodePurpose } from "@/lib/auth-code-flow";

const field = `${AUTH_FIELD} mt-1.5`;

export function AuthCodeForm({ purpose, initialEmail = "", onBack }: { purpose: CodePurpose; initialEmail?: string; onBack?: () => void }) {
  const [flow] = useState(() => createAuthCodeFlow(purpose));
  const state = useSyncExternalStore(flow.subscribe, flow.snapshot, flow.snapshot);
  const [email, setEmail] = useState(initialEmail), [code, setCode] = useState("");
  const [password, setPassword] = useState(""), [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [now, setNow] = useState(0);
  const remaining = codeSecondsLeft(state.resendAt, Math.max(now, state.resendAt - 60000));
  useEffect(() => {
    if (!state.resendAt) return;
    const tick = () => setNow(Date.now());
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [state.resendAt]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (state.step === "email") await flow.send(email);
    else if (state.step === "code") await flow.verify(code);
    else if (state.step === "password" && password === confirm) {
      await flow.reset(password);
      if (flow.snapshot().step !== "password") { setPassword(""); setConfirm(""); setShowPassword(false); }
    }
  }
  const recovery = purpose === "recovery";
  const mismatch = confirm.length > 0 && password !== confirm;
  return <>
    <h1 className={AUTH_HEADING}>{state.step === "done" ? recovery ? "Password updated" : "Email verified" : recovery ? "Reset your password" : "Verify your email"}</h1>
    {state.step !== "done" && <p className={AUTH_DESCRIPTION}>{state.step === "email" ? "Enter your account email to request a recovery code." : state.step === "password" ? "Choose a new password. Your reset session expires in 15 minutes." : "Enter the six-digit code from your email. Codes expire in 10 minutes. After five incorrect attempts, request a new code."}</p>}
    {state.error && <p role="alert" className="mt-6 rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">{state.error}</p>}
    {state.notice && <p role="status" className="mt-6 rounded-lg border border-border bg-surface px-4 py-3 text-sm">{state.notice}</p>}
    {!state.signedOut && state.step !== "done" && <form onSubmit={submit} className="mt-6 space-y-4">
      {state.step === "email" && <label className="block text-sm font-medium text-foreground">Email address<input className={field} type="email" autoComplete="email" required disabled={state.busy} value={email} onChange={e => setEmail(e.target.value)} /></label>}
      {state.step === "code" && <label className="block text-sm font-medium text-foreground">{recovery ? "Recovery" : "Verification"} code<input className={`${field} text-center font-mono text-2xl tracking-[0.4em]`} type="text" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code" required disabled={state.busy} value={code} onChange={e => setCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))} /></label>}
      {state.step === "password" && <>
        <label className="block text-sm font-medium text-foreground">New password<span className="relative block"><input id="code-reset-password" className={`${field} pr-11`} type={showPassword ? "text" : "password"} autoComplete="new-password" minLength={8} maxLength={128} required disabled={state.busy} value={password} onChange={e => setPassword(e.target.value)} /><button type="button" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} aria-controls="code-reset-password" onClick={() => setShowPassword(v => !v)} className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted">{showPassword ? <EyeOff aria-hidden className="size-4" /> : <Eye aria-hidden className="size-4" />}</button></span></label>
        <label className="block text-sm font-medium text-foreground">Confirm new password<input className={field} type={showPassword ? "text" : "password"} autoComplete="new-password" minLength={8} maxLength={128} required disabled={state.busy} value={confirm} onChange={e => setConfirm(e.target.value)} /></label>
        {mismatch && <p role="status" className="text-sm text-danger">The passwords do not match.</p>}
      </>}
      <button disabled={state.busy || (state.step === "password" && (password !== confirm || !confirm)) || (state.step === "email" && remaining > 0)} className={buttonClass("primary", `${AUTH_BUTTON} disabled:opacity-50`, "lg")}>{state.busy ? "Please wait…" : state.step === "email" ? "Send code" : state.step === "code" ? "Verify code" : "Update password"}</button>
    </form>}
    {!state.signedOut && state.step === "code" && <button type="button" disabled={state.busy || remaining > 0} className={buttonClass("secondary", `${AUTH_BUTTON} mt-4 disabled:opacity-50`, "lg")} onClick={async () => { await flow.send(); setCode(""); }}>{state.busy ? "Please wait…" : remaining > 0 ? `Request another code in ${remaining}s` : "Request another code"}</button>}
    {recovery && state.step !== "done" && <button type="button" disabled={state.busy} className="mt-6 block text-xs font-medium underline" onClick={() => { if (state.step === "email") onBack?.(); else { flow.back(); setCode(""); setPassword(""); setConfirm(""); setShowPassword(false); } }}>{state.step === "email" ? "Back to sign in" : "Use a different email"}</button>}
    {!recovery && state.step !== "done" ? <VerificationSignInLink disabled={state.busy} /> : (state.signedOut || state.step === "done") && <Link href={state.step === "done" && !recovery ? "/dashboard/welcome" : "/auth/login"} onClick={recovery && onBack ? (event) => { event.preventDefault(); onBack(); } : undefined} className="mt-6 block text-center text-xs font-medium underline">{state.step === "done" && !recovery ? "Continue" : "Back to sign in"}</Link>}
  </>;
}
