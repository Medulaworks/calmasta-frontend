"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { dashboardPath } from "@/lib/app-routes";
import { useEffect, useState } from "react";
import { Eye, EyeOff, LoaderCircle } from "lucide-react";
import { authErrorMessage } from "@/lib/auth-errors";
import { codeSignupPayload } from "@/lib/auth-code-flow";
import {
  AUTH_FIELD,
  AUTH_HEADING,
  AUTH_DESCRIPTION,
  AUTH_BUTTON,
} from "@/components/auth-styles";
import { AuthLayout } from "@/components/auth-layout";
import { buttonClass } from "@/components/ui/button";

/** Only same-site paths survive; mirrors the server's check so the link we build is already safe. */
const safePath = (p: string | null, fallback = "/dashboard") =>
  p &&
  p.startsWith("/") &&
  !p.startsWith("//") &&
  !p.includes("\\") &&
  !p.startsWith("/login") &&
  !p.startsWith("/auth/login") &&
  !p.startsWith("/auth/register") &&
  !p.startsWith("/auth/forgot-password") &&
  !p.startsWith("/admin/auth/login") &&
  !p.startsWith("/dashboard/admin/auth/login") &&
  !p.startsWith("/api/")
    ? dashboardPath(p)
    : fallback;

/** The sign-in and create-account screens. Each has its own address (/auth/login and /auth/register). Password recovery is /auth/forgot-password. */
export function Login({
  defaultReturnTo = "/dashboard",
  admin = false,
  mode = "signin",
}: {
  defaultReturnTo?: string;
  admin?: boolean;
  mode?: "signin" | "signup";
} = {}) {
  const router = useRouter();
  const params = useSearchParams();
  const returnTo = safePath(params.get("returnTo"), defaultReturnTo);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [connectingGoogle, setConnectingGoogle] = useState(false);
  const [connectingMicrosoft, setConnectingMicrosoft] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const expired = params.get("reason") === "expired" && !formError;

  const [checking, setChecking] = useState(true);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/error", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.error)
          setFormError(authErrorMessage(data.error));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const resetGoogle = () => setConnectingGoogle(false);
    window.addEventListener("pageshow", resetGoogle);
    return () => window.removeEventListener("pageshow", resetGoogle);
  }, []);

  useEffect(() => {
    const resetMicrosoft = () => setConnectingMicrosoft(false);
    window.addEventListener("pageshow", resetMicrosoft);
    return () => window.removeEventListener("pageshow", resetMicrosoft);
  }, []);

  // Old links used /auth/login?signup=1 for the create-account screen; it has its own address now.
  useEffect(() => {
    if (!admin && mode === "signin" && params.get("signup") === "1")
      router.replace(`/auth/register?returnTo=${encodeURIComponent(returnTo)}`);
  }, [admin, mode, params, returnTo, router]);

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
            const target =
              returnTo === "/dashboard/welcome" ? defaultReturnTo : returnTo;
            router.replace(target);
          }
        } else if (res.status === 401) {
          setChecking(false);
        } else {
          setChecking(false);
          setBootstrapError(
            "Sign-in is unavailable right now. Please try again in a few minutes.",
          );
        }
      },
      () => {
        if (!cancelled) {
          setChecking(false);
          setBootstrapError(
            "We can’t reach Joobah right now. Check your connection and try again.",
          );
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [returnTo, reloadKey, router, defaultReturnTo]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    setSubmitting(true);
    try {
      const endpoint =
        mode === "signup" ? "/api/auth/register" : "/api/auth/login";
      const payload =
        mode === "signup"
          ? codeSignupPayload(
              email,
              password,
              `${firstName.trim()} ${lastName.trim()}`.trim(),
            )
          : { email, password };

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
          router.replace(
            returnTo === "/dashboard/welcome" ? defaultReturnTo : returnTo,
          );
        } else {
          router.replace("/dashboard/welcome");
        }
      } else {
        if (data.error === "email_already_registered") {
          setFormError(
            "There’s already an account with this email. Try signing in instead.",
          );
        } else if (data.error === "invalid_credentials") {
          setFormError("That email or password isn’t right. Please try again.");
        } else {
          setFormError(
            data.error || "We couldn’t sign you in. Check your details and try again.",
          );
        }
      }
    } catch {
      setFormError("We can’t connect right now. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const q = `returnTo=${encodeURIComponent(returnTo)}`;

  return (
    <AuthLayout>
      <h1 className={AUTH_HEADING}>
        {admin ? (
          <>
            Sign in to <span className="text-accent">Admin</span>.
          </>
        ) : mode === "signin" ? (
          <>
            Turn every conversation into{" "}
            <span className="text-accent">finished work</span>
          </>
        ) : (
          <>
            Start with your{" "}
            <span className="text-accent">next conversation</span>.
          </>
        )}
      </h1>
      <p className={AUTH_DESCRIPTION}>
        {admin
          ? "Sign in with your staff account to access the administration console."
          : mode === "signin"
            ? "Meetings and voice notes become transcripts, briefs and follow-ups. Pick up where you left off."
            : "Capture, transcribe and organise your conversations."}
      </p>

      {expired && (
        <p
          role="status"
          className="mt-6 rounded-lg border border-border bg-surface px-4 py-3 text-sm">
          Your session ended, so we signed you out. Signing in again picks up
          where you left off.
        </p>
      )}

      {formError && (
        <p
          role="alert"
          className="mt-6 rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
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

      <form
        onSubmit={handleSubmit}
        className="mt-[clamp(1rem,3.4vh,2rem)] space-y-[clamp(0.75rem,2vh,1.25rem)]">
        {mode === "signup" && (
          <div className="grid gap-[clamp(0.75rem,2vh,1.25rem)] sm:grid-cols-2">
            <div>
              <label
                className="mb-2 block text-sm font-medium text-foreground"
                htmlFor="first-name">
                First name
              </label>
              <input
                id="first-name"
                type="text"
                required
                autoComplete="given-name"
                maxLength={80}
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Jane"
                className={AUTH_FIELD}
              />
            </div>
            <div>
              <label
                className="mb-2 block text-sm font-medium text-foreground"
                htmlFor="last-name">
                Last name
              </label>
              <input
                id="last-name"
                type="text"
                required
                autoComplete="family-name"
                maxLength={80}
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Doe"
                className={AUTH_FIELD}
              />
            </div>
          </div>
        )}

        {
          <div>
            <label
              className="mb-2 block text-sm font-medium text-foreground"
              htmlFor="email">
              Email address
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="me@joobah.com"
              className={AUTH_FIELD}
            />
          </div>
        }

        {
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label
                className="block text-sm font-medium text-foreground"
                htmlFor="password">
                Password
              </label>
              {mode === "signin" && (
                <Link
                  href={`/auth/forgot-password?${q}`}
                  className="text-xs text-muted hover:underline">
                  Forgot password?
                </Link>
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
                className={`${AUTH_FIELD} pr-11`}
              />
              <button
                type="button"
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                aria-controls="password"
                onClick={() => setShowPassword((shown) => !shown)}
                className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-lg text-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary">
                {showPassword ? (
                  <EyeOff aria-hidden className="size-4" />
                ) : (
                  <Eye aria-hidden className="size-4" />
                )}
              </button>
            </div>
          </div>
        }

        <button
          type="submit"
          disabled={
            submitting || checking || connectingGoogle || connectingMicrosoft
          }
          className={`${buttonClass("primary", AUTH_BUTTON, "lg")}${
            submitting || checking || connectingGoogle || connectingMicrosoft
              ? " pointer-events-none opacity-60"
              : ""
          }`}>
          {submitting
            ? "Processing…"
            : mode === "signin"
              ? "Sign in"
              : "Create account"}
        </button>
      </form>

      {
        <>
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
                aria-disabled={
                  checking ||
                  submitting ||
                  connectingGoogle ||
                  connectingMicrosoft
                }
                aria-busy={connectingGoogle}
                onClick={(event) => {
                  if (
                    checking ||
                    submitting ||
                    connectingGoogle ||
                    connectingMicrosoft
                  ) {
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
                className={`${buttonClass("secondary", AUTH_BUTTON, "lg")}${
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
                    className="w-5"
                  />
                )}
                {connectingGoogle
                  ? "Connecting to Google"
                  : "Continue with Google"}
              </a>
              <button
                type="button"
                aria-busy={connectingMicrosoft}
                disabled={
                  checking ||
                  submitting ||
                  connectingGoogle ||
                  connectingMicrosoft
                }
                onClick={async () => {
                  if (
                    checking ||
                    submitting ||
                    connectingGoogle ||
                    connectingMicrosoft
                  )
                    return;
                  setConnectingMicrosoft(true);
                  setFormError(null);
                  try {
                    const res = await fetch(
                      `/api/auth/microsoft/url?returnTo=${encodeURIComponent(returnTo)}`,
                      { method: "POST", cache: "no-store" },
                    );
                    const data = (await res.json().catch(() => ({}))) as {
                      url?: string;
                      state?: string;
                      error?: string;
                    };
                    if (!res.ok || !data.url || !data.state)
                      throw new Error(
                        data.error || "Microsoft sign-in unavailable",
                      );
                    try {
                      sessionStorage.setItem(
                        "microsoft_oauth_state",
                        data.state,
                      );
                    } catch {}
                    try {
                      sessionStorage.setItem("oauth_state", data.state);
                    } catch {}
                    window.location.assign(data.url);
                  } catch (e) {
                    setFormError(
                      e instanceof Error
                        ? e.message
                        : "Microsoft sign-in is temporarily unavailable. Please try again.",
                    );
                    setConnectingMicrosoft(false);
                  }
                }}
                className={`${buttonClass("secondary", AUTH_BUTTON, "lg")}${checking || submitting || connectingGoogle || connectingMicrosoft ? " pointer-events-none opacity-60" : ""}`}>
                {connectingMicrosoft ? (
                  <LoaderCircle
                    aria-hidden="true"
                    className="size-4.5 animate-spin"
                  />
                ) : (
                  <svg
                    aria-hidden="true"
                    width="18"
                    height="18"
                    viewBox="0 0 21 21">
                    <path fill="#f25022" d="M0 0h10v10H0z" />
                    <path fill="#7fba00" d="M11 0h10v10H11z" />
                    <path fill="#00a4ef" d="M0 11h10v10H0z" />
                    <path fill="#ffb900" d="M11 11h10v10H11z" />
                  </svg>
                )}
                {connectingMicrosoft
                  ? "Connecting to Microsoft"
                  : "Continue with Microsoft"}
              </button>
            </div>
          </div>

          {!admin && (
            <div className="mt-[clamp(0.75rem,2.6vh,1.5rem)] text-center text-sm text-muted">
              {mode === "signin" ? (
                <p>
                  Don’t have an account?{" "}
                  <Link
                    href={`/auth/register?${q}`}
                    className="font-medium text-foreground underline hover:no-underline">
                    Sign up
                  </Link>
                </p>
              ) : (
                <p>
                  Already have an account?{" "}
                  <Link
                    href={`/auth/login?${q}`}
                    className="font-medium text-foreground underline hover:no-underline">
                    Sign in
                  </Link>
                </p>
              )}
            </div>
          )}
        </>
      }
    </AuthLayout>
  );
}
