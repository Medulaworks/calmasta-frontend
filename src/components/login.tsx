"use client";

import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { dashboardPath } from "@/lib/app-routes";
import { useEffect, useState } from "react";
import { ArrowRight, Eye, EyeOff, LoaderCircle } from "lucide-react";
import { authErrorMessage } from "@/lib/auth-errors";
import { AuthLayout } from "@/components/auth-layout";
import { PasswordReset } from "@/components/password-reset";
import { Toast, type ToastTone } from "@/components/ui/toast";
import { buttonClass } from "@/components/ui/button";

/** Only same-site paths survive; mirrors the server's check so the link we build is already safe. */
const safePath = (p: string | null) =>
  p &&
  p.startsWith("/") &&
  !p.startsWith("//") &&
  !p.includes("\\") &&
  !p.startsWith("/login") &&
  !p.startsWith("/auth/login") &&
  !p.startsWith("/api/auth")
    ? dashboardPath(p)
    : "/dashboard";

export function Login() {
  const router = useRouter();
  const params = useSearchParams();
  const returnTo = safePath(params.get("returnTo"));

  const [mode, setMode] = useState<"signin" | "signup" | "forgot">(
    params.get("signup") === "1" ? "signup" : "signin",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [connectingGoogle, setConnectingGoogle] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; tone: ToastTone } | null>(() =>
    params.get("reason") === "expired"
      ? { message: "Your session ended, so we signed you out. Sign in again to pick up where you left off.", tone: "info" }
      : null,
  );
  // Take the reason out of the address so a refresh doesn't show the message again.
  useEffect(() => {
    if (params.get("reason") === "expired") {
      const url = new URL(window.location.href);
      url.searchParams.delete("reason");
      window.history.replaceState(null, "", url.pathname + url.search);
    }
  }, [params]);

  const [checking, setChecking] = useState(true);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/error", { cache: "no-store" })
      .then((res) => res.ok ? res.json() : null)
      .then((data) => { if (!cancelled && data?.error) setFormError(authErrorMessage(data.error)); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const resetGoogle = () => setConnectingGoogle(false);
    window.addEventListener("pageshow", resetGoogle);
    return () => window.removeEventListener("pageshow", resetGoogle);
  }, []);

  // Already signed in? Go straight to where they were headed, taking onboarding into account.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/me").then(
      async (res) => {
        if (cancelled) return;
        if (res.ok) {
          const profile = (await res.json().catch(() => null)) as {
            onboarded?: boolean;
            emailVerified?: boolean;
          } | null;
          if (cancelled) return;
          if (profile?.emailVerified === false) {
            router.replace("/auth/verify-email");
          } else if (profile && !profile.onboarded) {
            router.replace("/dashboard/welcome");
          } else {
            const target = returnTo === "/dashboard/welcome" ? "/dashboard" : returnTo;
            router.replace(target);
          }
        } else if (res.status === 401) {
          setChecking(false);
        } else {
          setChecking(false);
          setBootstrapError(
            "Authentication service is temporarily unavailable. Please try again in a few moments.",
          );
        }
      },
      () => {
        if (!cancelled) {
          setChecking(false);
          setBootstrapError(
            "Network error. Unable to verify your session. Please check your connection.",
          );
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [returnTo, reloadKey, router]);

  function returnToSignIn() {
    setMode("signin");
    setShowPassword(false);
    setFormError(null);
    setPassword("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setToast(null);

    setSubmitting(true);
    try {
      const endpoint =
        mode === "signup" ? "/api/auth/register" : "/api/auth/login";
      const payload =
        mode === "signup" ? { email, password, name } : { email, password };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        if (data.emailVerified === false) {
          router.replace("/auth/verify-email");
        } else if (data.onboarded) {
          router.replace(returnTo === "/dashboard/welcome" ? "/dashboard" : returnTo);
        } else {
          router.replace("/dashboard/welcome");
        }
      } else {
        if (data.error === "email_already_registered") {
          setFormError(
            "This email is already registered. Please sign in instead.",
          );
        } else if (data.error === "invalid_credentials") {
          setFormError("Invalid email or password. Please try again.");
        } else {
          setFormError(
            data.error || "Authentication failed. Please check your input.",
          );
        }
      }
    } catch {
      setFormError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const q = `returnTo=${encodeURIComponent(returnTo)}`;

  if (mode === "forgot") {
    return (
      <AuthLayout>
        <PasswordReset
          initialEmail={email}
          onDone={(doneEmail, doneNotice) => {
            setEmail(doneEmail);
            returnToSignIn();
            setToast(doneNotice ? { message: doneNotice, tone: "success" } : null);
          }}
        />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
          {toast && <Toast message={toast.message} tone={toast.tone} onClose={() => setToast(null)} />}
          <h1 className="text-[clamp(2rem,5vh,3rem)] font-semibold leading-[1.1] tracking-tight">
            {mode === "signin" ? (
              <>Turn every conversation into <span className="text-accent">finished work</span>.</>
            ) : mode === "signup" ? (
              <>Start with your <span className="text-accent">next conversation</span>.</>
            ) : null}
          </h1>
          <p className="mt-3 text-[clamp(0.9375rem,2.1vh,1.0625rem)] leading-[1.55] text-muted">
            {mode === "signin"
              ? "Meetings and voice notes become transcripts, briefs and follow-ups. Pick up where you left off."
              : mode === "signup"
                ? "Record a thought or join a meeting and get a transcript and first draft today. Free, no card needed."
                : null}
          </p>

          {formError && (
            <p
              role="alert"
              className="mt-5 rounded-xl border border-danger/30 bg-danger/10 px-4 py-2.5 text-sm text-danger">
              {formError}
            </p>
          )}

          {bootstrapError && (
            <div
              role="alert"
              className="mt-6 space-y-2 rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
              <p>{bootstrapError}</p>
              <button
                type="button"
                onClick={() => {
                  setChecking(true);
                  setBootstrapError(null);
                  setReloadKey((k) => k + 1);
                }}
                className="text-xs font-medium underline hover:no-underline">
                Retry session check
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-[clamp(1rem,3.4vh,2rem)] space-y-[clamp(0.75rem,2vh,1.25rem)]">
            {mode === "signup" && (
              <div>
                <label
                  className="mb-1.5 block text-sm font-medium text-foreground"
                  htmlFor="name">
                  Full Name
                </label>
                <input
                  id="name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Jane Doe"
                  className="h-[clamp(2.5rem,5.6vh,3rem)] w-full rounded-xl border border-border bg-background px-4 text-base shadow-sm transition focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent-solid/20"
                />
              </div>
            )}

            <div>
              <label
                className="mb-1.5 block text-sm font-medium text-foreground"
                htmlFor="email">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="h-[clamp(2.5rem,5.6vh,3rem)] w-full rounded-xl border border-border bg-background px-4 text-base shadow-sm transition focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent-solid/20"
              />
            </div>

            {(
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label
                    className="block text-sm font-medium text-foreground"
                    htmlFor="password">
                    Password
                  </label>
                  {mode === "signin" && (
                    <button
                      type="button"
                      onClick={() => {
                        setMode("forgot");
                        setShowPassword(false);
                        setFormError(null);
                      }}
                      className="text-sm text-muted transition-colors hover:text-foreground hover:underline">
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className="h-[clamp(2.5rem,5.6vh,3rem)] w-full rounded-xl border border-border bg-background pl-4 pr-12 text-base shadow-sm transition focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent-solid/20"
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  aria-controls="password"
                  onClick={() => setShowPassword((shown) => !shown)}
                  className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-xl text-muted transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent">
                  {showPassword ? <EyeOff aria-hidden className="size-5" /> : <Eye aria-hidden className="size-5" />}
                </button>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || checking || connectingGoogle}
              className={`${buttonClass("primary", "group min-h-[clamp(2.5rem,5.6vh,3rem)]! w-full rounded-xl text-base shadow-[0_10px_24px_-10px_color-mix(in_srgb,var(--accent-solid)_90%,transparent)] transition-all hover:-translate-y-0.5 hover:shadow-[0_16px_28px_-12px_color-mix(in_srgb,var(--accent-solid)_95%,transparent)] active:translate-y-0", "lg")}${
                submitting || checking || connectingGoogle
                  ? " pointer-events-none opacity-60"
                  : ""
              }`}>
              {submitting
                ? "Processing…"
                : mode === "signin"
                  ? "Sign in"
                  : "Create account"}
              {!submitting && <ArrowRight aria-hidden className="size-4.5 transition-transform group-hover:translate-x-1" />}
            </button>
          </form>

          <>
          {/* Social sign-in alternatives */}
          <div className="mt-[clamp(1rem,3vh,1.5rem)]">
            <div className="relative flex items-center justify-center">
              <div className="border-t border-border w-full" />
              <span className="bg-background px-3 text-sm text-muted">or</span>
              <div className="border-t border-border w-full" />
            </div>

            <div className="mt-[clamp(0.75rem,2.4vh,1.25rem)] grid grid-cols-2 gap-3">
              <a
                href={`/api/auth/login?${q}&provider=google`}
                aria-label="Continue with Google"
                aria-disabled={checking || submitting || connectingGoogle}
                aria-busy={connectingGoogle}
                onClick={(event) => {
                  if (checking || submitting || connectingGoogle) {
                    event.preventDefault();
                    return;
                  }
                  if (
                    !event.metaKey &&
                    !event.ctrlKey &&
                    !event.shiftKey &&
                    !event.altKey &&
                    event.button === 0
                  )
                    setConnectingGoogle(true);
                }}
                className={`${buttonClass("secondary", "min-h-[clamp(2.5rem,5.6vh,3rem)]! w-full rounded-xl text-base transition-all hover:-translate-y-0.5 hover:shadow-sm", "lg")}${
                  checking || submitting || connectingGoogle
                    ? " pointer-events-none opacity-60"
                    : ""
                }`}>
                {connectingGoogle ? (
                  <LoaderCircle
                    aria-hidden="true"
                    className="size-4.5 animate-spin"
                  />
                ) : (
                  <Image
                    src="/icons/google-icon.svg"
                    alt=""
                    width={18}
                    height={18}
                    className="w-[18px]"
                  />
                )}
                {connectingGoogle ? "Connecting…" : "Google"}
              </a>
              <button
                type="button"
                disabled
                aria-label="Continue with Microsoft (not available yet)"
                className={buttonClass("secondary", "min-h-[clamp(2.5rem,5.6vh,3rem)]! w-full rounded-xl text-base", "lg")}>
                <svg aria-hidden="true" width="18" height="18" viewBox="0 0 21 21">
                  <path fill="#f25022" d="M0 0h10v10H0z" />
                  <path fill="#7fba00" d="M11 0h10v10H11z" />
                  <path fill="#00a4ef" d="M0 11h10v10H0z" />
                  <path fill="#ffb900" d="M11 11h10v10H11z" />
                </svg>
                Microsoft
              </button>
            </div>
          </div>

          <div className="mt-[clamp(0.75rem,2.6vh,1.5rem)] text-center text-sm text-muted">
            {mode === "signin" ? (
              <p>
                Don&apos;t have an account?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setMode("signup");
                    setShowPassword(false);
                    setFormError(null);
                  }}
                  className="font-medium text-foreground underline hover:no-underline">
                  Sign up
                </button>
              </p>
            ) : (
              <p>
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setMode("signin");
                    setShowPassword(false);
                    setFormError(null);
                  }}
                  className="font-medium text-foreground underline hover:no-underline">
                  Sign in
                </button>
              </p>
            )}
          </div>
          </>
    </AuthLayout>
  );
}
