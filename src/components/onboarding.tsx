"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ROLES } from "@/lib/roles";
import { setAppearance } from "@/lib/theme";
import { DEFAULT_MODE, DEFAULT_THEME } from "@/lib/theme-boot";
import {
  type ProfileView,
  ProfileError,
  getProfile,
  saveProfile,
} from "@/lib/profile-client";
import { TEMPLATES } from "@/server/domain/templates";

const STEPS = 3;

const PRINCIPLES = [
  [
    "You start every recording.",
    "Nothing is captured unless you choose it. Connecting a calendar never starts recording.",
  ],
  [
    "It's always visible.",
    "Meeting assistants join as “CalMasta Notetaker” and may need the host to let them in.",
  ],
  [
    "You confirm each meeting.",
    "You tell us you have the right to record, and you should tell the participants.",
  ],
  [
    "Your recordings are private.",
    "Only you can see them. Audio files expire according to retention policy.",
  ],
] as const;

const FIRST_ACTIONS = [
  {
    href: "/dashboard/voice",
    title: "Record a thought",
    body: "Speak for a minute. Get a transcript you can edit.",
    fast: true,
  },
  {
    href: "/dashboard/voice",
    title: "Upload audio",
    body: "Turn an existing audio file into an editable transcript.",
  },
  {
    href: "/dashboard/capture",
    title: "Capture a meeting",
    body: "Send a visible assistant to a Meet, Teams or Zoom call.",
  },
] as const;

function Skeleton({ w }: { w: string }) {
  return <div className={`h-2 rounded-full bg-border ${w}`} />;
}

/** A small, illustrative document: the product's whole promise in one picture. */
function DocPreview({
  title,
  sections,
}: {
  title: string;
  sections: string[];
}) {
  return (
    <div
      className="w-full max-w-sm rounded-xl border border-border bg-background p-5 shadow-sm"
      aria-hidden>
      <p className="text-xs uppercase tracking-wide text-muted">Draft</p>
      <p className="mt-1 text-lg font-semibold">{title}</p>
      <div className="mt-4 space-y-4">
        {sections.slice(0, 4).map((s) => (
          <div key={s} className="space-y-1.5">
            <p className="text-sm font-medium">{s}</p>
            <Skeleton w="w-full" />
            <Skeleton w="w-2/3" />
          </div>
        ))}
      </div>
    </div>
  );
}

function Preview({ step, template }: { step: number; template: string }) {
  const def = TEMPLATES.find((t) => t.id === template) ?? TEMPLATES[1];
  if (step === 0) {
    return (
      <div className="w-full max-w-sm space-y-3" aria-hidden>
        <div className="flex items-center gap-3 rounded-xl border border-border bg-background px-4 py-3 text-sm">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-accent/15 text-accent">
            ●
          </span>
          <div className="flex-1">
            <p className="font-medium">Voice note</p>
            <p className="text-xs text-muted">4:12 · recorded by you</p>
          </div>
        </div>
        <p className="text-center text-muted">↓</p>
        <DocPreview
          title="Client brief"
          sections={["Context", "Objective", "Recommendations"]}
        />
      </div>
    );
  }
  return <DocPreview title={def.label} sections={def.sections} />;
}

export function Onboarding() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [role, setRole] = useState<string | null>(null);
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
        setRole(p.role);
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

  // Move focus to the new step's heading so keyboard and screen-reader users follow along.
  useEffect(() => {
    heading.current?.focus();
  }, [step]);

  const template =
    ROLES.find((r) => r.id === role)?.template ?? "summary_and_actions";

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
    <div className="grid min-h-screen md:grid-cols-2">
      <main className="flex flex-col px-6 py-8 sm:px-12 md:px-16">
        <header className="flex items-center gap-4">
          <Link href="/" className="text-lg font-semibold tracking-tight">
            MyJooba
          </Link>
          <ol
            className="flex items-center gap-1.5"
            aria-label={`Step ${step + 1} of ${STEPS}`}>
            {Array.from({ length: STEPS }, (_, i) => (
              <li
                key={i}
                aria-current={i === step ? "step" : undefined}
                className={`h-1 rounded-full transition-all ${i === step ? "w-6 bg-accent-solid" : i < step ? "w-3 bg-accent/50" : "w-3 bg-border"}`}
              />
            ))}
          </ol>
        </header>

        <div className="mt-6 h-10">
          {loaded && step > 0 && (
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              aria-label="Back"
              className="grid h-10 w-10 place-items-center rounded-full border border-border text-muted hover:text-foreground">
              ←
            </button>
          )}
        </div>

        <div className="my-auto max-w-md py-10">
          {bootstrapError ? (
            <div
              role="alert"
              className="space-y-4 rounded-xl border border-danger/30 bg-danger/10 p-6 text-sm text-danger">
              <h1
                ref={heading}
                tabIndex={-1}
                className="text-xl font-semibold tracking-tight text-foreground outline-none">
                Unable to load onboarding
              </h1>
              <p>{bootstrapError}</p>
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setBootstrapError(null);
                    setError(null);
                    setLoaded(false);
                    setRetryKey((k) => k + 1);
                  }}
                  className="inline-flex min-h-9 items-center justify-center rounded-lg bg-accent-solid px-4 text-xs font-medium text-on-accent transition-colors hover:brightness-95 active:brightness-90">
                  Retry
                </button>
                <a
                  href="/auth/login?returnTo=/dashboard/welcome"
                  className="inline-flex min-h-9 items-center justify-center rounded-lg border border-border px-4 text-xs font-medium text-foreground hover:bg-surface">
                  Sign in again
                </a>
              </div>
            </div>
          ) : !loaded ? (
            <div
              role="status"
              aria-label="Loading profile"
              aria-busy="true"
              className="space-y-4 py-8">
              <div className="h-8 w-48 jb-skel rounded bg-border" />
              <div className="h-4 w-72 jb-skel rounded bg-border" />
              <div className="h-24 jb-skel rounded-xl border border-border bg-surface" />
              <span className="sr-only">Loading profile…</span>
            </div>
          ) : (
            <>
              {step === 0 && (
                <>
                  <h1
                    ref={heading}
                    tabIndex={-1}
                    className="text-3xl font-semibold tracking-tight outline-none">
                    Turn conversations into useful work
                  </h1>
                  <p className="mt-3 text-muted">
                    Capture a meeting or a thought, get a transcript, and search
                    or edit it freely. Here is how we handle recording.
                  </p>
                  <ul className="mt-6 space-y-4">
                    {PRINCIPLES.map(([title, body]) => (
                      <li key={title} className="flex gap-3 text-sm">
                        <span aria-hidden className="mt-0.5 text-accent">
                          ✓
                        </span>
                        <p>
                          <span className="font-medium">{title}</span>{" "}
                          <span className="text-muted">{body}</span>
                        </p>
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="inline-flex min-h-10 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-accent-solid px-6 text-sm font-medium text-on-accent transition-colors hover:brightness-95 active:brightness-90 disabled:pointer-events-none disabled:opacity-50 mt-8">
                    Continue →
                  </button>
                </>
              )}

              {step === 1 && (
                <>
                  <h1
                    ref={heading}
                    tabIndex={-1}
                    className="text-3xl font-semibold tracking-tight outline-none">
                    What do you do?
                  </h1>
                  <p className="mt-3 text-muted">
                    We&rsquo;ll start you with the document that fits best. You
                    can always pick another.
                  </p>
                  <fieldset className="mt-6">
                    <legend className="sr-only">Your role</legend>
                    <div className="flex flex-wrap gap-2">
                      {ROLES.map((r) => (
                        <label
                          key={r.id}
                          className="group cursor-pointer rounded-lg border border-border px-4 py-2 text-sm transition-colors hover:bg-surface has-[:checked]:border-accent has-[:checked]:bg-accent/20 has-[:checked]:font-medium has-[:checked]:ring-1 has-[:checked]:ring-accent has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent">
                          <input
                            type="radio"
                            name="role"
                            value={r.id}
                            checked={role === r.id}
                            onChange={() => setRole(r.id)}
                            className="sr-only"
                          />
                          <span
                            aria-hidden
                            className="mr-1.5 hidden group-has-[:checked]:inline">
                            ✓
                          </span>
                          {r.label}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <div className="mt-8 flex items-center gap-4">
                    <button
                      type="button"
                      disabled={busy || !role}
                      onClick={() =>
                        void run(
                          () => saveProfile({ role }),
                          () => setStep(2),
                        )
                      }
                      className="inline-flex min-h-10 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-accent-solid px-6 text-sm font-medium text-on-accent transition-colors hover:brightness-95 active:brightness-90 disabled:pointer-events-none disabled:opacity-50">
                      {busy ? "Saving…" : "Continue →"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className="text-sm text-muted hover:text-foreground">
                      Skip
                    </button>
                  </div>
                </>
              )}

              {step === 2 && (
                <>
                  <h1
                    ref={heading}
                    tabIndex={-1}
                    className="text-3xl font-semibold tracking-tight outline-none">
                    Start with your first conversation
                  </h1>
                  <p className="mt-3 text-muted">
                    The quickest way to see MyJooba work is to give it something
                    to write about.
                  </p>
                  <ul className="mt-6 space-y-3">
                    {FIRST_ACTIONS.map((a) => (
                      <li key={a.title}>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void finish(a.href)}
                          className="w-full rounded-xl border border-border p-4 text-left transition-colors hover:bg-surface disabled:opacity-60">
                          <span className="flex items-center justify-between gap-3">
                            <span className="font-medium">{a.title}</span>
                            {"fast" in a && (
                              <span className="rounded-full bg-accent/15 px-2 py-0.5 text-xs text-accent">
                                Fastest
                              </span>
                            )}
                          </span>
                          <span className="mt-1 block text-sm text-muted">
                            {a.body}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void finish("/dashboard")}
                    className="mt-6 text-sm text-muted hover:text-foreground">
                    I&rsquo;ll explore on my own
                  </button>
                </>
              )}

              {error && (
                <p
                  role="alert"
                  className="mt-6 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
                  {error}
                </p>
              )}
            </>
          )}
        </div>
      </main>

      <aside
        aria-hidden
        className="hidden items-center justify-center bg-surface p-12 md:flex">
        <Preview step={step} template={template} />
      </aside>
    </div>
  );
}
