"use client";

import { ArrowRight, CircleAlert, FileText, Mic, Upload, Video } from "lucide-react";
import { useRouter } from "next/navigation";
import { type CSSProperties, useEffect, useRef, useState } from "react";
import { AuthLayout } from "@/components/auth-layout";
import { AUTH_DESCRIPTION, AUTH_HEADING } from "@/components/auth-styles";
import { buttonClass } from "@/components/ui/button";
import { SpineIllustration } from "@/components/ui/illustrations";
import { playSound } from "@/lib/sounds";
import { setAppearance } from "@/lib/theme";
import { DEFAULT_MODE, DEFAULT_THEME } from "@/lib/theme-boot";
import {
  type ProfileView,
  ProfileError,
  getProfile,
  saveProfile,
} from "@/lib/profile-client";

/** `--d` is the start delay of an entrance, so a screen's parts arrive one after another. */
const delay = (d: number): CSSProperties => ({ ["--d" as string]: `${d}s` }) as CSSProperties;

/**
 * The one question. Each answer takes the person straight into that flow, never to a generic dashboard. Voice is listed
 * first and carries the weight: it needs no meeting and works at any hour.
 */
const CHOICES = [
  { href: "/dashboard/voice", Icon: Mic, title: "Start recording", body: "Capture an idea, reminder or plan.", sound: "recordStart" as const, main: true },
  { href: "/dashboard/capture?focus=link", Icon: Video, title: "Capture a meeting", body: "Start or connect a supported meeting.", sound: "sent" as const },
  { href: "/dashboard/voice", Icon: Upload, title: "Upload audio", body: "Turn an existing recording into text.", sound: "sent" as const },
  { href: "/dashboard/library", Icon: FileText, title: "Create a document", body: "Turn captured information into something useful.", sound: "notify" as const },
] as const;

/** The right-hand panel: the same soft backdrop as the sign-in screens, with Meet, Think, Act and a result taking shape. */
function Aside() {
  return (
    <aside aria-hidden className="relative hidden overflow-hidden bg-surface lg:flex lg:h-dvh lg:items-center lg:justify-center lg:px-12">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,color-mix(in_srgb,var(--accent-solid)_20%,transparent),transparent_45%),radial-gradient(circle_at_85%_90%,color-mix(in_srgb,var(--accent)_14%,transparent),transparent_50%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-50 [background-image:radial-gradient(color-mix(in_srgb,var(--foreground)_14%,transparent)_1px,transparent_1px)] [background-size:24px_24px] [mask-image:radial-gradient(circle_at_50%_50%,black,transparent_72%)]" />
      <div className="jb-orb pointer-events-none absolute -right-24 top-16 size-72 rounded-full bg-accent-solid/20 blur-3xl" />
      <div className="jb-orb pointer-events-none absolute -left-20 bottom-12 size-64 rounded-full bg-accent/15 blur-3xl" style={{ animationDelay: "-6s" }} />
      <div className="relative w-full max-w-md space-y-8">
        <SpineIllustration />
        <div className="jb-card rounded-3xl border border-border bg-background/90 p-6 shadow-[0_22px_48px_-22px_color-mix(in_srgb,var(--accent)_55%,transparent)] backdrop-blur" style={{ ...delay(0.5), ["--f" as string]: "8s" } as CSSProperties}>
          <p className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted"><span className="jb-rec size-2 rounded-full bg-accent-solid" /> Draft</p>
          <p className="mt-1 text-lg font-semibold tracking-tight">Summary and action items</p>
          <div className="mt-6 space-y-4">
            {["Summary", "Decisions", "Action items"].map((name, i) => (
              <div key={name} className="space-y-2">
                <p className="text-sm font-medium">{name}</p>
                <div className="h-2 rounded-full bg-border"><div className="jb-line h-full w-full rounded-full bg-accent-solid/45" style={delay(0.2 + i * 0.35)} /></div>
                <div className="h-2 w-2/3 rounded-full bg-border"><div className="jb-line h-full w-full rounded-full bg-accent-solid/30" style={delay(0.35 + i * 0.35)} /></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}

export function Onboarding() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    let cancelled = false;
    getProfile().then(
      (p: ProfileView) => {
        if (cancelled) return;
        setAppearance(p.theme ?? DEFAULT_THEME, p.mode ?? DEFAULT_MODE);
        if (p.onboarded) {
          router.replace("/dashboard");
          return;
        }
        setLoaded(true);
      },
      (err) => {
        if (cancelled) return;
        if (err instanceof ProfileError && err.status === 401) {
          router.replace(
            "/auth/login?returnTo=/dashboard/welcome&reason=expired",
          );
          return;
        }
        setBootstrapError(
          err instanceof Error
            ? err.message
            : "Unable to load profile. Please check your connection.",
        );
        setLoaded(false);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [router, retryKey]);

  useEffect(() => {
    if (loaded) heading.current?.focus();
  }, [loaded]);

  async function run(fn: () => Promise<unknown>, then: () => void) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      then();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  const finish = (href: string) => {
    if (!loaded || busy) return;
    run(
      async () => {
        // Remember the user's timezone so "this month" and times make sense. Best effort: never blocks finishing.
        try {
          await saveProfile({
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          });
        } catch {
          /* an unrecognised zone simply stays on UTC until they pick one in Settings */
        }
        await saveProfile({ complete: true });
      },
      () => router.push(href),
    );
  };

  return (
    <AuthLayout aside={<Aside />}>
      {bootstrapError ? (
        <div role="alert" className="jb-rise space-y-4">
          <span className="grid size-12 place-items-center rounded-xl bg-danger/10 text-danger"><CircleAlert aria-hidden className="size-6" /></span>
          <h1 ref={heading} tabIndex={-1} className={`${AUTH_HEADING} outline-none`}>Couldn’t load your setup</h1>
          <p className={AUTH_DESCRIPTION}>{bootstrapError}</p>
          <div className="flex flex-wrap items-center gap-4 pt-2">
            <button type="button" onClick={() => { setBootstrapError(null); setError(null); setLoaded(false); setRetryKey((k) => k + 1); }} className={buttonClass("primary", "", "lg")}>Try again</button>
            <a href="/auth/login?returnTo=/dashboard/welcome" className={buttonClass("secondary", "", "lg")}>Sign in again</a>
          </div>
        </div>
      ) : !loaded ? (
        <div role="status" aria-label="Loading profile" aria-busy="true" className="space-y-4">
          <div className="h-10 w-4/5 jb-skel rounded-lg bg-border" />
          <div className="h-4 w-3/5 jb-skel rounded bg-border" />
          <div className="h-24 jb-skel rounded-2xl border border-border bg-surface" />
          <div className="h-24 jb-skel rounded-2xl border border-border bg-surface" />
          <span className="sr-only">Loading profile…</span>
        </div>
      ) : (
        <div>
          <h1 ref={heading} tabIndex={-1} className={`${AUTH_HEADING} jb-rise outline-none`}>What would you like to do?</h1>
          <p className={`${AUTH_DESCRIPTION} jb-rise`} style={delay(0.06)}>Pick one and we’ll take you straight there.</p>

          <ul className="mt-8 space-y-4">
            {CHOICES.map(({ Icon, ...c }, i) => (
              <li key={c.title} className="jb-rise" style={delay(0.12 + i * 0.07)}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => { playSound(c.sound); void finish(c.href); }}
                  className={`group flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:pointer-events-none disabled:opacity-60 ${"main" in c ? "border-transparent bg-accent-solid text-on-accent shadow-md" : "border-border bg-background shadow-sm hover:border-accent/40"}`}>
                  <span aria-hidden className={`grid size-12 shrink-0 place-items-center rounded-xl ${"main" in c ? "bg-on-accent/10" : "bg-accent-solid/15 text-accent"}`}><Icon className="size-6" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-base font-semibold">{c.title}</span>
                    <span className={`mt-1 block text-sm ${"main" in c ? "text-on-accent/80" : "text-muted"}`}>{c.body}</span>
                  </span>
                  <ArrowRight aria-hidden className="size-5 shrink-0 transition-transform group-hover:translate-x-1" />
                </button>
              </li>
            ))}
          </ul>

          <button type="button" disabled={busy} onClick={() => void finish("/dashboard")} className="jb-rise mx-auto mt-8 flex text-sm text-muted transition-colors hover:text-foreground" style={delay(0.5)}>
            Explore first. No pressure
          </button>

          {error && <p role="alert" className="jb-rise mt-6 flex items-start gap-2 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger"><CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />{error}</p>}
        </div>
      )}
    </AuthLayout>
  );
}
