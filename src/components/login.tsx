"use client";

import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { dashboardPath } from "@/lib/app-routes";
import { useEffect, useState } from "react";
import { ArrowLeft, Eye, EyeOff, LoaderCircle } from "lucide-react";
import { authErrorMessage } from "@/lib/auth-errors";
import { AuthLayout } from "@/components/auth-layout";
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
  const expired = params.get("reason") === "expired" && !formError;
  const [forgotSuccess, setForgotSuccess] = useState(false);

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
    setForgotSuccess(false);
    setFormError(null);
    setPassword("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "forgot" && forgotSuccess) return;
    setFormError(null);
    setForgotSuccess(false);

    if (mode === "forgot") {
      setSubmitting(true);
      try {
        const res = await fetch("/api/auth/forgot-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        if (res.ok) {
          setForgotSuccess(true);
        } else {
          setFormError(
            res.status === 503
              ? "Email delivery is temporarily unavailable. Please try again shortly."
              : res.status === 429
                ? "Too many requests. Please wait before trying again."
                : "Could not request a reset email. Please check your email format and try again.",
          );
        }
      } catch {
        setFormError("Network error. Please try again.");
      } finally {
        setSubmitting(false);
      }
      return;
    }

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

  return (
    <AuthLayout>
          {mode === "forgot" && (
            <button
              type="button"
              onClick={returnToSignIn}
              disabled={submitting}
              aria-label="Back to sign in"
              className="mb-4 inline-flex size-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface hover:text-foreground disabled:opacity-50">
              <ArrowLeft aria-hidden className="size-5" />
            </button>
          )}

          <h1 className="text-3xl font-semibold tracking-tight">
            {mode === "signin"
              ? "Welcome back"
              : mode === "signup"
                ? "Create an account"
                : "Reset your password"}
          </h1>
          <p className="mt-2 text-sm text-muted">
            {mode === "signin"
              ? "Sign in to turn your conversations into useful work."
              : mode === "signup"
                ? "Start capturing, transcribing, and organizing your conversations."
                : "Enter your account email and we'll send you a recovery link."}
          </p>

          {expired && (
            <p
              role="status"
              className="mt-6 rounded-lg border border-border bg-surface px-4 py-3 text-sm">
              Your session ended, so we signed you out. Signing in again picks
              up where you left off.
            </p>
          )}

          {formError && (
            <p
              role="alert"
              className="mt-6 rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
              {formError}
            </p>
          )}

          {forgotSuccess && (
            <p
              role="status"
              className="mt-6 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-600 dark:text-emerald-400">
              If an account matches that email address, we have sent
              instructions to reset your password.
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

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            {mode === "signup" && (
              <div>
                <label
                  className="block text-xs font-medium text-muted mb-1"
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
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:border-primary focus:outline-none"
                />
              </div>
            )}

            {!(mode === "forgot" && forgotSuccess) && <div>
              <label
                className="block text-xs font-medium text-muted mb-1"
                htmlFor="email">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                required
                disabled={mode === "forgot" && (forgotSuccess || submitting)}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:border-primary focus:outline-none"
              />
            </div>}

            {mode !== "forgot" && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label
                    className="block text-xs font-medium text-muted"
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
                      className="text-xs text-muted hover:underline">
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
                  className="w-full rounded-lg border border-border bg-surface py-2 pl-3 pr-11 text-sm focus:border-primary focus:outline-none"
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  aria-controls="password"
                  onClick={() => setShowPassword((shown) => !shown)}
                  className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-lg text-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary">
                  {showPassword ? <EyeOff aria-hidden className="size-4" /> : <Eye aria-hidden className="size-4" />}
                </button>
                </div>
              </div>
            )}

            <button
              type={mode === "forgot" && forgotSuccess ? "button" : "submit"}
              onClick={mode === "forgot" && forgotSuccess ? returnToSignIn : undefined}
              disabled={submitting || checking || connectingGoogle}
              className={`${buttonClass("primary", "w-full", "lg")}${
                submitting || checking || connectingGoogle
                  ? " pointer-events-none opacity-60"
                  : ""
              }`}>
              {mode === "forgot" && forgotSuccess
                ? "Return"
                : submitting
                ? "Processing…"
                : mode === "signin"
                  ? "Sign in"
                  : mode === "signup"
                    ? "Create account"
                    : "Send recovery link"}
            </button>
          </form>

          {mode !== "forgot" && <>
          {/* Social sign-in alternatives */}
          <div className="mt-6">
            <div className="relative flex items-center justify-center">
              <div className="border-t border-border w-full" />
              <span className="bg-background px-3 text-xs text-muted">or</span>
              <div className="border-t border-border w-full" />
            </div>

            <div className="mt-4 space-y-3">
              <a
                href={`/api/auth/login?${q}&provider=google`}
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
                className={`${buttonClass("secondary", "w-full", "lg")}${
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
                    alt="Google"
                    width={18}
                    height={18}
                    className="w-[18px]"
                  />
                )}
                {connectingGoogle
                  ? "Connecting to Google"
                  : "Continue with Google"}
              </a>
              <button
                type="button"
                disabled
                className={buttonClass("secondary", "w-full", "lg")}>
                <svg aria-hidden="true" width="18" height="18" viewBox="0 0 21 21">
                  <path fill="#f25022" d="M0 0h10v10H0z" />
                  <path fill="#7fba00" d="M11 0h10v10H11z" />
                  <path fill="#00a4ef" d="M0 11h10v10H0z" />
                  <path fill="#ffb900" d="M11 11h10v10H11z" />
                </svg>
                Continue with Microsoft
              </button>
            </div>
          </div>

          <div className="mt-6 text-center text-xs text-muted">
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
          </>}
    </AuthLayout>
  );
}
