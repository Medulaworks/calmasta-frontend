"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { adminPost } from "@/lib/admin-client";
import { inputClass } from "@/components/admin/ui";
import { ApiError } from "@/lib/upload-client";

type Invite = { email: string; role: "viewer" | "operator" | "owner"; expiresAt: string; accountExists: boolean };
type Stage = "loading" | "account" | "verify_email" | "recovery_code" | "recovery_password" | "accepted" | "invalid";
const input = `mt-2 ${inputClass}`;
const label = "block text-sm font-medium";
const roleName: Record<Invite["role"], string> = { viewer: "Viewer", operator: "Operator", owner: "Owner" };

function messageOf(error: unknown) {
  return error instanceof Error ? error.message : "We couldn’t complete that step. Please try again.";
}

export default function AcceptInviteClient({ initialToken }: { initialToken: string }) {
  const router = useRouter();
  const lookupStarted = useRef(false);
  const [token, setToken] = useState(initialToken);
  const [invite, setInvite] = useState<Invite | null>(null);
  const [stage, setStage] = useState<Stage>(initialToken ? "loading" : "invalid");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);
  const [code, setCode] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (!initialToken || lookupStarted.current) return;
    lookupStarted.current = true;
    window.history.replaceState(null, "", "/admin/accept-invite");
    void lookup(initialToken);
  }, [initialToken]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  async function lookup(invitationToken: string) {
    try {
      const result = await adminPost<Invite>("/api/admin/staff/invites/lookup", { token: invitationToken });
      setInvite(result);
      setStage("account");
    } catch (err) {
      setToken("");
      setStage("invalid");
      setError(messageOf(err));
    }
  }

  function finishAdminLogin() {
    setToken("");
    setPassword("");
    setConfirmPassword("");
    setCode("");
    setResetToken("");
    setNewPassword("");
    router.replace("/admin");
  }

  async function signInToAdmin(accountPassword: string) {
    setBusy(true);
    try {
      await adminPost("/api/admin/auth/login", { email: invite?.email, password: accountPassword });
      finishAdminLogin();
    } catch (err) {
      setStage("accepted");
      setError(`Your invitation was accepted, but admin sign-in did not finish. ${messageOf(err)}`);
    } finally {
      setBusy(false);
    }
  }

  async function acceptInvitation(accountPassword: string) {
    if (!token || !invite || accepted) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await adminPost<{ state: string; role: Invite["role"] }>("/api/admin/staff/invites/accept", { token });
      setAccepted(true);
      setInvite((current) => current ? { ...current, role: result.role } : current);
      setToken("");
      setResetToken("");
      setStage("accepted");
      if (accountPassword) await signInToAdmin(accountPassword);
    } catch (err) {
      if (err instanceof ApiError && err.code === "invalid_invitation") {
        setToken("");
        setPassword("");
        setConfirmPassword("");
        setCode("");
        setResetToken("");
        setStage("invalid");
      }
      if (err instanceof ApiError && err.code === "already_staff") {
        setAccepted(true);
        setToken("");
        setStage("accepted");
        setError("This account already has admin access. Sign in to continue.");
        if (accountPassword) await signInToAdmin(accountPassword);
        return;
      }
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  }

  async function establishAccountSession(accountPassword: string, endpoint: "/api/auth/register" | "/api/auth/login", extra: Record<string, unknown> = {}) {
    if (!invite) return;
    const result = await adminPost<{ emailVerified: boolean }>(endpoint, { email: invite.email, password: accountPassword, ...extra });
    setPassword(accountPassword);
    setError("");
    if (result.emailVerified) await acceptInvitation(accountPassword);
    else {
      setStage("verify_email");
      setNotice("Your account needs email verification before this invitation can be accepted.");
    }
  }

  async function submitAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !invite) return;
    if (!invite.accountExists && password !== confirmPassword) {
      setError("The passwords don’t match.");
      return;
    }
    if (password.length < 8 || password.length > 128) {
      setError("Use a password between 8 and 128 characters.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await establishAccountSession(password, invite.accountExists ? "/api/auth/login" : "/api/auth/register", invite.accountExists ? {} : { name: name.trim(), delivery: "code" });
      if (!invite.accountExists) setNotice("We sent a verification code to the invited email. Enter it below.");
    } catch (err) {
      const text = messageOf(err);
      if (!invite.accountExists && err instanceof ApiError && err.code === "email_already_registered") {
        setInvite((current) => current ? { ...current, accountExists: true } : current);
        setPassword("");
        setConfirmPassword("");
        setNotice("An account now exists for this email. Sign in to continue.");
      } else setError(text);
    } finally {
      setBusy(false);
    }
  }

  async function verifyEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !/^[0-9]{6}$/.test(code)) {
      if (!/^[0-9]{6}$/.test(code)) setError("Enter the six-digit code from your email.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await adminPost("/api/auth/verify-email", { code });
      setCode("");
      await acceptInvitation(password);
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  }

  async function resendVerificationCode() {
    if (busy || cooldown > 0) return;
    setBusy(true);
    setError("");
    try {
      await adminPost("/api/auth/verify-email/resend", { delivery: "code" });
      setCooldown(60);
      setNotice("A new verification code was sent. It expires in 10 minutes.");
    } catch (err) {
      setError(messageOf(err));
      if (/too many|wait a minute/i.test(messageOf(err))) setCooldown(60);
    } finally {
      setBusy(false);
    }
  }

  async function startPasswordRecovery() {
    if (busy || !invite) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await adminPost("/api/auth/forgot-password", { email: invite.email, delivery: "code" });
      setStage("recovery_code");
      setCooldown(60);
      setNotice("If an account exists for this email, a password-reset code was sent. Check your inbox.");
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  }

  async function resendRecoveryCode() {
    if (busy || cooldown > 0 || !invite) return;
    setBusy(true);
    setError("");
    try {
      await adminPost("/api/auth/forgot-password", { email: invite.email, delivery: "code" });
      setCooldown(60);
      setNotice("If an account exists for this email, a new code was sent.");
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  }

  async function verifyRecoveryCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !invite || !/^[0-9]{6}$/.test(code)) {
      if (!/^[0-9]{6}$/.test(code)) setError("Enter the six-digit code from your email.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await adminPost<{ resetToken: string }>("/api/auth/verify-reset-code", { email: invite.email, code });
      setResetToken(result.resetToken);
      setStage("recovery_password");
      setCode("");
      setNotice("Choose a password for your Joobah account.");
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !invite || !resetToken) return;
    if (newPassword.length < 8 || newPassword.length > 128) {
      setError("Use a password between 8 and 128 characters.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await adminPost("/api/auth/reset-password", { token: resetToken, password: newPassword });
      setResetToken("");
      setPassword(newPassword);
      const result = await adminPost<{ emailVerified: boolean }>("/api/auth/login", { email: invite.email, password: newPassword });
      if (result.emailVerified) await acceptInvitation(newPassword);
      else {
        setStage("verify_email");
        setNotice("Your account needs email verification before this invitation can be accepted.");
      }
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  }

  if (stage === "loading") {
    return <Card><div role="status" className="p-5 text-sm text-muted">Checking your invitation…</div></Card>;
  }

  if (stage === "invalid" || !invite) {
    return (
      <Card>
        <div className="space-y-3 p-5 text-sm">
          <h1 className="text-lg font-semibold">This invitation can’t be used</h1>
          <p role="alert" className="text-muted">{error || "Open the complete invitation link from your email, or ask the inviter to send a new one."}</p>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="space-y-5 p-5 sm:p-7">
        <div className="space-y-2">
          <h1 className="text-xl font-semibold">Accept your Joobah admin invitation</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
            <span>Invited email:</span><strong className="font-medium text-foreground">{invite.email}</strong>
            <Badge tone="info">{roleName[invite.role]}</Badge>
          </div>
        </div>

        {error && <p role="alert" className="rounded-lg border border-danger/30 bg-danger/10 p-3 text-sm text-danger">{error}</p>}
        {notice && <p role="status" className="rounded-lg border border-accent/20 bg-accent/5 p-3 text-sm text-muted">{notice}</p>}

        {stage === "account" && (
          <div className="space-y-4">
            <p className="text-sm text-muted">{invite.accountExists ? "Sign in with this Joobah account to continue." : "Create a Joobah account with this invited email to continue."}</p>
            <form onSubmit={submitAccount} className="space-y-4">
              <label className={label}>
                Invited email
                <input type="email" value={invite.email} readOnly className={`${input} bg-surface`} />
              </label>
              {!invite.accountExists && <label className={label}>Name (optional)<input autoComplete="name" maxLength={200} value={name} onChange={(event) => setName(event.target.value)} className={input} /></label>}
              <label className={label}>
                {invite.accountExists ? "Password" : "Create a password"}
                <span className="relative block">
                  <input type={passwordVisible ? "text" : "password"} required minLength={8} maxLength={128} autoComplete={invite.accountExists ? "current-password" : "new-password"} value={password} onChange={(event) => setPassword(event.target.value)} className={`${input} pr-11`} />
                  <button type="button" onClick={() => setPasswordVisible((visible) => !visible)} aria-label={passwordVisible ? "Hide password" : "Show password"} aria-pressed={passwordVisible} className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
                    {passwordVisible ? <EyeOff aria-hidden className="size-4" /> : <Eye aria-hidden className="size-4" />}
                  </button>
                </span>
              </label>
              {!invite.accountExists && <label className={label}>Confirm password<span className="relative block"><input type={confirmPasswordVisible ? "text" : "password"} required minLength={8} maxLength={128} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className={`${input} pr-11`} /><button type="button" onClick={() => setConfirmPasswordVisible((visible) => !visible)} aria-label={confirmPasswordVisible ? "Hide confirmation password" : "Show confirmation password"} aria-pressed={confirmPasswordVisible} className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">{confirmPasswordVisible ? <EyeOff aria-hidden className="size-4" /> : <Eye aria-hidden className="size-4" />}</button></span></label>}
              <Button variant="primary" type="submit" disabled={busy} className="w-full">{busy ? "Please wait…" : invite.accountExists ? "Sign in and continue" : "Create account and continue"}</Button>
            </form>
            {invite.accountExists && <Button variant="ghost" disabled={busy} onClick={() => void startPasswordRecovery()}>Set or reset my password</Button>}
          </div>
        )}

        {stage === "verify_email" && (
          <form onSubmit={verifyEmail} className="space-y-4">
            <p className="text-sm text-muted">Verify control of the invited email before we grant admin access.</p>
            <label className={label}>Six-digit email code<input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} className={input} /></label>
            <Button variant="primary" type="submit" disabled={busy} className="w-full">{busy ? "Verifying…" : "Verify email and accept invite"}</Button>
            <Button variant="ghost" disabled={busy || cooldown > 0} onClick={() => void resendVerificationCode()}>{cooldown > 0 ? `Send another code in ${cooldown}s` : "Send another verification code"}</Button>
          </form>
        )}

        {stage === "recovery_code" && (
          <form onSubmit={verifyRecoveryCode} className="space-y-4">
            <p className="text-sm text-muted">Enter the password-reset code sent to {invite.email}.</p>
            <label className={label}>Six-digit code<input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} className={input} /></label>
            <Button variant="primary" type="submit" disabled={busy} className="w-full">{busy ? "Checking code…" : "Continue"}</Button>
            <Button variant="ghost" disabled={busy || cooldown > 0} onClick={() => void resendRecoveryCode()}>{cooldown > 0 ? `Send another code in ${cooldown}s` : "Resend code"}</Button>
            <Button variant="ghost" disabled={busy} onClick={() => { setStage("account"); setCode(""); setError(""); setNotice(""); }}>Back to sign in</Button>
          </form>
        )}

        {stage === "recovery_password" && (
          <form onSubmit={resetPassword} className="space-y-4">
            <label className={label}>New password<input type="password" required minLength={8} maxLength={128} autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className={input} /></label>
            <Button variant="primary" type="submit" disabled={busy} className="w-full">{busy ? "Updating password…" : "Set password and continue"}</Button>
            <Button variant="ghost" disabled={busy} onClick={() => { setStage("account"); setResetToken(""); setError(""); setNotice(""); }}>Back to sign in</Button>
          </form>
        )}

        {stage === "accepted" && (
          <form onSubmit={(event) => { event.preventDefault(); void signInToAdmin(password); }} className="space-y-4">
            <p className="text-sm text-success">Invitation accepted as {roleName[invite.role]}. Sign in to open the admin area.</p>
            <label className={label}>Password<input type="password" required minLength={8} maxLength={128} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className={input} /></label>
            <Button variant="primary" type="submit" disabled={busy} className="w-full">{busy ? "Signing in…" : "Sign in to admin"}</Button>
          </form>
        )}
      </div>
    </Card>
  );
}
