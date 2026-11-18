"use client";

import {
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  Eye,
  FileText,
  Mic,
  Pause,
  Play,
  Sparkles,
  Upload,
  Video,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink, buttonClass } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import {
  CalendarIllustration,
  ChecklistIllustration,
} from "@/components/ui/illustrations";
import { dashboardPath } from "@/lib/app-routes";
import type { Dashboard } from "@/lib/dashboard-client";
import { setPendingFile } from "@/lib/pending-upload";
import { playSound } from "@/lib/sounds";
import { timeAgo } from "@/lib/status";
import { useDisplayTitle } from "@/components/shell/use-display-title";
import { RowStatus, statusFor } from "./item-row";

const AUDIO = /\.(mp3|m4a|wav|webm|ogg|mp4|aac|flac)$/i;

/** Dropping an audio file anywhere on the page starts an upload: it hands the file to the recorder page. */
export function DropAnywhere() {
  const router = useRouter();
  const [over, setOver] = useState(false);
  useEffect(() => {
    let depth = 0;
    const hasFiles = (e: DragEvent) =>
      !!e.dataTransfer && [...e.dataTransfer.types].includes("Files");
    const enter = (e: DragEvent) => {
      if (hasFiles(e)) {
        depth++;
        setOver(true);
      }
    };
    const leave = () => {
      depth = Math.max(0, depth - 1);
      if (depth === 0) setOver(false);
    };
    const overEv = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault();
    };
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setOver(false);
      const file =
        [...(e.dataTransfer?.files ?? [])].find(
          (f) =>
            f.type.startsWith("audio/") ||
            f.type.startsWith("video/") ||
            AUDIO.test(f.name),
        ) ?? e.dataTransfer?.files[0];
      if (!file) return;
      setPendingFile(file);
      playSound("sent");
      router.push("/dashboard/voice");
    };
    window.addEventListener("dragenter", enter);
    window.addEventListener("dragleave", leave);
    window.addEventListener("dragover", overEv);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragenter", enter);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("dragover", overEv);
      window.removeEventListener("drop", drop);
    };
  }, [router]);
  if (!over) return null;
  return (
    <div
      role="status"
      className="jb-fade pointer-events-none fixed inset-0 z-50 grid place-items-center bg-background/80 p-6 backdrop-blur-sm">
      <div className="jb-pop-soft flex max-w-md flex-col items-center gap-4 rounded-3xl border-2 border-dashed border-accent-solid bg-background p-12 text-center shadow-2xl">
        <span
          aria-hidden
          className="grid size-16 place-items-center rounded-2xl bg-accent-solid/20 text-accent">
          <Upload className="size-8" />
        </span>
        <p className="text-xl font-semibold">Drop your audio to upload</p>
        <p className="text-sm text-muted">
          Joobah will turn it into a transcript you can edit.
        </p>
      </div>
    </div>
  );
}

const LINK =
  /^(https?:\/\/)?([\w-]+\.)*(zoom\.us|zoomgov\.com|teams\.microsoft\.com|teams\.live\.com|meet\.google\.com)\//i;

/** A single line: paste a call link and send Joobah to it, with no modal. The consent step happens on the next screen. */
export function MeetingLinkField({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [touched, setTouched] = useState(false);
  const valid = LINK.test(url.trim());
  const bad = touched && url.trim() !== "" && !valid;
  function go(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!valid) return;
    router.push(`/dashboard/capture?link=${encodeURIComponent(url.trim())}`);
  }
  return (
    <form
      onSubmit={go}
      className={
        compact ? "flex flex-1 flex-col gap-2 sm:flex-row" : "space-y-3"
      }>
      <div className="min-w-0 flex-1">
        <label htmlFor={compact ? "link-bar" : "link-hero"} className="sr-only">
          Meeting link
        </label>
        <input
          id={compact ? "link-bar" : "link-hero"}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onBlur={() => setTouched(true)}
          inputMode="url"
          autoComplete="off"
          aria-invalid={bad}
          placeholder="Paste a Zoom, Teams or Google Meet link…"
          className={`h-12 w-full rounded-xl border bg-background px-4 text-sm shadow-sm transition focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent-solid/20 ${bad ? "border-danger" : "border-border"}`}
        />
        {bad && (
          <p role="alert" className="mt-2 text-xs text-danger">
            That doesn’t look like a Zoom, Teams or Google Meet link.
          </p>
        )}
      </div>
      <button
        type="submit"
        className={`${buttonClass("secondary", compact ? "" : "w-full", "lg")} group`}>
        <Video aria-hidden className="size-5" /> Send Joobah to the call{" "}
        <ArrowRight
          aria-hidden
          className="size-4 transition-transform group-hover:translate-x-1"
        />
      </button>
    </form>
  );
}

/** The four ways in. Voice carries the weight because it works at any hour with no meeting to arrange. */
export function ActionDock() {
  const router = useRouter();
  const file = useRef<HTMLInputElement>(null);
  const card =
    "flex h-full flex-col rounded-2xl border p-5 transition-all duration-200";
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <section
        className={`${card} border-transparent bg-accent-solid text-on-accent shadow-md hover:-translate-y-0.5 hover:shadow-lg`}>
        <span
          aria-hidden
          className="grid size-12 place-items-center rounded-2xl bg-on-accent/10">
          <Mic className="size-6" />
        </span>
        <h2 className="mt-6 text-xl font-semibold">Think out loud</h2>
        <p className="mt-2 flex-1 text-sm text-on-accent/80">
          Have an idea, thought, reminder or plan? Speak naturally. Joobah helps
          organise your thoughts into useful notes and actionable information.
        </p>
        <Link
          href="/dashboard/voice"
          onClick={() => playSound("recordStart")}
          className="group mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-on-accent px-5 text-base font-medium text-accent-solid shadow-sm transition-all hover:-translate-y-px hover:shadow-md active:scale-[0.98]">
          <Mic aria-hidden className="size-5" /> Start recording
        </Link>
      </section>

      <section
        className={`${card} border-border bg-background shadow-sm hover:shadow-md`}>
        <span
          aria-hidden
          className="grid size-12 place-items-center rounded-2xl bg-accent-solid/15 text-accent">
          <Video className="size-6" />
        </span>
        <h2 className="mt-6 text-xl font-semibold">Join a meeting</h2>
        <p className="mb-6 mt-2 flex-1 text-sm text-muted">
          Bring Joobah into your next meeting. Capture the discussion, generate a
          transcript, identify decisions and extract follow-up actions.
        </p>
        <MeetingLinkField />
      </section>

      <section
        className={`${card} border-dashed border-border bg-surface/60 hover:border-accent/50 hover:bg-surface`}>
        <div className="flex items-start gap-4">
          <span
            aria-hidden
            className="grid size-12 shrink-0 place-items-center rounded-2xl bg-accent-solid/15 text-accent">
            <Upload className="size-6" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold">Upload audio</h2>
            <p className="mt-1 text-sm text-muted">
              Already have a recording? Upload it and let Joobah handle the
              transcription, summaries and key takeaways.
            </p>
            <input
              ref={file}
              type="file"
              accept="audio/*,video/mp4,video/webm,.m4a,.mp3,.wav"
              className="sr-only"
              tabIndex={-1}
              aria-hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) {
                  setPendingFile(f);
                  playSound("sent");
                  router.push("/dashboard/voice");
                }
              }}
            />
            <button
              type="button"
              onClick={() => file.current?.click()}
              className={`${buttonClass("secondary", "mt-4", "md")}`}>
              Upload audio
            </button>
            <p className="mt-3 text-xs text-muted">
              Or drop an audio file anywhere on this page
            </p>
          </div>
        </div>
      </section>

      <section
        className={`${card} border-border bg-background shadow-sm hover:shadow-md`}>
        <div className="flex items-start gap-4">
          <span
            aria-hidden
            className="grid size-12 shrink-0 place-items-center rounded-2xl bg-accent-solid/15 text-accent">
            <FileText className="size-6" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold">Create a document</h2>
            <p className="mt-1 text-sm text-muted">
              Turn captured information into something useful.
            </p>
            <ButtonLink
              href="/dashboard/library"
              variant="secondary"
              className="mt-4">
              Create a document
            </ButtonLink>
          </div>
        </div>
      </section>
    </div>
  );
}

/** The slim bar that replaces the big hero once someone has started: same place on every visit. */
export function CaptureBar() {
  const router = useRouter();
  const file = useRef<HTMLInputElement>(null);
  return (
    <section
      aria-label="Capture"
      className="flex flex-col gap-4 rounded-2xl border border-border bg-background p-4 shadow-sm lg:flex-row lg:items-start">
      <Link
        href="/dashboard/voice"
        onClick={() => playSound("recordStart")}
        className={`${buttonClass("primary", "", "lg")} shrink-0`}>
        <Mic aria-hidden className="size-5" /> Start recording
      </Link>
      <MeetingLinkField compact />
      <input
        ref={file}
        type="file"
        accept="audio/*,video/mp4,video/webm,.m4a,.mp3,.wav"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) {
            setPendingFile(f);
            playSound("sent");
            router.push("/dashboard/voice");
          }
        }}
      />
      <button
        type="button"
        onClick={() => file.current?.click()}
        className={`${buttonClass("ghost", "shrink-0", "lg")}`}>
        <Upload aria-hidden className="size-5" /> Upload
      </button>
    </section>
  );
}

const SAMPLE_SECONDS = 60;

/**
 * DUMMY DATA. Shows what a finished conversation looks like (summary, decisions, action items, speaker tags) before the
 * person has recorded anything. It is clearly labelled, and it disappears after their first real capture.
 */
export function SampleResult() {
  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(0);
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(
      () =>
        setT((x) => (x >= SAMPLE_SECONDS ? (setPlaying(false), 0) : x + 0.25)),
      250,
    );
    return () => clearInterval(id);
  }, [playing]);
  const pct = (t / SAMPLE_SECONDS) * 100;
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
        <div className="flex items-center gap-3">
          <Badge tone="warning">Sample · dummy data</Badge>
          <p className="text-sm text-muted">Not your recording</p>
        </div>
        <p className="text-sm font-medium">Weekly product sync</p>
      </div>
      <div className="space-y-5 p-5">
        <p className="text-base font-semibold">See what you get back</p>
        <div className="flex items-center gap-4 rounded-2xl bg-surface p-4">
          <button
            type="button"
            onClick={() => {
              setPlaying((p) => !p);
              playSound(playing ? "pause" : "resume");
            }}
            aria-label={
              playing ? "Pause the sample" : "Play a 60-second sample"
            }
            className="grid size-12 shrink-0 place-items-center rounded-full bg-accent-solid text-on-accent shadow-sm transition-transform hover:scale-105 active:scale-95">
            {playing ? (
              <Pause aria-hidden className="size-5" />
            ) : (
              <Play aria-hidden className="ml-0.5 size-5" />
            )}
          </button>
          <div className="min-w-0 flex-1">
            <div aria-hidden className="flex h-8 items-center gap-1">
              {Array.from({ length: 40 }, (_, i) => (
                <span
                  key={i}
                  className={`w-1 rounded-full ${(i / 40) * 100 <= pct ? "bg-accent-solid" : "bg-border"} ${playing ? "jb-bar" : ""}`}
                  style={
                    {
                      height: 8 + ((i * 7) % 5) * 5,
                      ["--d" as string]: `${(i % 8) * 0.1}s`,
                    } as React.CSSProperties
                  }
                />
              ))}
            </div>
            <p className="mt-1 text-xs tabular-nums text-muted">
              {Math.floor(t)}s / {SAMPLE_SECONDS}s · Play a 60-second sample
            </p>
          </div>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted">
              Summary
            </p>
            <p className="mt-2 text-sm">
              The team agreed to ship the new onboarding next Friday and to hold
              the pricing change until the survey results are in.
            </p>
            <p className="mt-6 text-xs font-medium uppercase tracking-wider text-muted">
              Decisions
            </p>
            <ul className="mt-2 space-y-2 text-sm">
              <li className="flex gap-2">
                <Check
                  aria-hidden
                  className="mt-0.5 size-4 shrink-0 text-success"
                />{" "}
                Launch onboarding on Friday
              </li>
              <li className="flex gap-2">
                <Check
                  aria-hidden
                  className="mt-0.5 size-4 shrink-0 text-success"
                />{" "}
                Pause the pricing change
              </li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted">
              Action items
            </p>
            <ul className="mt-2 space-y-3 text-sm">
              {[
                ["Amara", "Send the launch note to customers"],
                ["Daniel", "Share the survey results on Monday"],
                ["Priya", "Update the help centre pages"],
              ].map(([who, what]) => (
                <li key={what} className="flex items-start gap-3">
                  <span
                    aria-hidden
                    className="mt-0.5 size-5 shrink-0 rounded-md border border-border"
                  />
                  <span>
                    <span className="font-medium">{who}</span>{" "}
                    <span className="text-muted">· {what}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </Card>
  );
}

/** Calendar prompt: shown until a calendar is connected. Joobah only ever joins the meetings the person approves. */
export function CalendarPrompt() {
  return (
    <Card>
      <div className="p-5">
        <div className="mx-auto w-40">
          <CalendarIllustration />
        </div>
        <h2 className="mt-2 text-center text-base font-semibold">
          Let Joobah find your calls
        </h2>
        <p className="mt-2 text-center text-sm text-muted">
          Connect your calendar and Joobah joins the calls you choose. You will
          approve each one.
        </p>
        <ButtonLink
          href="/dashboard/calendar"
          variant="secondary"
          className="mt-6 w-full">
          <CalendarDays aria-hidden className="size-5" /> Connect calendar
        </ButtonLink>
      </div>
    </Card>
  );
}

/** A small ring that fills as steps are finished, with the count in the middle. */
function ProgressRing({ done, total }: { done: number; total: number }) {
  const r = 18,
    c = 2 * Math.PI * r;
  return (
    <div
      role="progressbar"
      aria-label="Setup progress"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={done}
      className="relative grid size-10 shrink-0 place-items-center">
      <svg
        aria-hidden
        viewBox="0 0 48 48"
        className="absolute inset-0 -rotate-90">
        <circle
          cx="24"
          cy="24"
          r={r}
          fill="none"
          stroke="var(--border)"
          strokeWidth="4"
        />
        <circle
          cx="24"
          cy="24"
          r={r}
          fill="none"
          stroke="var(--accent-solid)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - done / total)}
          className="transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      <span className="text-xs font-semibold tabular-nums">
        {done}
        <span className="text-muted">/{total}</span>
      </span>
    </div>
  );
}

/** Three steps, ending in "turn it into something useful": the step that teaches what Joobah is for. */
export function Checklist({ d, seen }: { d: Dashboard; seen: boolean }) {
  const captured = d.progress.hasRecording || d.progress.hasMeetingCapture;
  const latest =
    d.recentRecordings.find((r) => r.kind === "recording") ??
    d.recentMeetings[0];
  const steps = [
    {
      done: captured,
      Icon: Mic,
      title: "Capture something",
      body: "Record your voice, upload audio or send Joobah to a call.",
      href: "/dashboard/voice",
    },
    {
      done: captured && seen,
      Icon: Eye,
      title: "See what came back",
      body: "Open the transcript or summary.",
      href: latest?.href ?? "/dashboard/library",
    },
    {
      done: d.progress.hasDocument === true || d.actionItems.length > 0,
      Icon: Sparkles,
      title: "Turn it into something useful",
      body: "Make a document, an action list or a plan.",
      href: latest?.href ?? "/dashboard/library",
    },
  ];
  if (steps.every((s) => s.done)) return null;
  const done = steps.filter((s) => s.done).length;
  const next = steps.findIndex((s) => !s.done);
  return (
    <section
      aria-labelledby="get-started"
      className="jb-rise rounded-2xl border border-border bg-background shadow-sm">
      <div className="flex min-h-14 items-center justify-between gap-4 border-b border-border px-5 py-3">
        <h2 id="get-started" className="text-base font-semibold">
          Get started
        </h2>
        <ProgressRing done={done} total={3} />
      </div>
      <ol className="divide-y divide-border">
        {steps.map((s, i) => {
          const current = i === next;
          return (
            <li key={s.title}>
              <Link
                href={dashboardPath(s.href)}
                aria-current={current ? "step" : undefined}
                className={`group flex items-center gap-4 px-5 py-3 transition-colors ${current ? "bg-accent-solid/5 hover:bg-accent-solid/10" : "hover:bg-surface"}`}>
                <span
                  aria-hidden
                  className={`grid size-10 shrink-0 place-items-center rounded-lg ${s.done ? "bg-success/15 text-success" : current ? "bg-accent-solid text-on-accent" : "border border-border text-muted"}`}>
                  {s.done ? (
                    <Check className="size-5" />
                  ) : (
                    <s.Icon className="size-5" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={`block text-sm font-medium ${s.done ? "text-muted" : ""}`}>
                    {s.title}
                  </span>
                  {!s.done && (
                    <span className="block text-xs text-muted">{s.body}</span>
                  )}
                </span>
                {current && (
                  <span className="shrink-0 rounded-full bg-accent-solid/15 px-2 py-0.5 text-xs font-medium text-accent">
                    Up next
                  </span>
                )}
                <span className="sr-only">
                  {s.done ? "(done)" : current ? "(up next)" : "(to do)"}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/** The first result: the one moment that decides whether someone comes back. It points straight at the output. */
export function FirstResultCard({
  d,
  onOpen,
}: {
  d: Dashboard;
  onOpen: () => void;
}) {
  const item = [...d.recentRecordings, ...d.recentMeetings][0];
  if (!item) return null;
  return (
    <section className="jb-rise relative overflow-hidden rounded-3xl border border-accent-solid/40 bg-gradient-to-br from-accent-solid/15 via-background to-background p-6 shadow-md">
      <div
        aria-hidden
        className="jb-orb pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-accent-solid/20 blur-3xl"
      />
      <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="inline-flex items-center gap-2 text-sm font-medium text-accent">
            <Sparkles aria-hidden className="size-4" /> Your first result is
            ready
          </p>
          <h2 className="mt-2 text-2xl font-semibold">{item.title}</h2>
          <p className="mt-2 max-w-xl text-base text-muted">
            Read the transcript and summary, then turn it into an action plan,
            notes, a strategy or reminders.
          </p>
        </div>
        <Link
          href={dashboardPath(item.href)}
          onClick={() => {
            onOpen();
            playSound("success");
          }}
          className={`${buttonClass("primary", "group shrink-0", "lg")}`}>
          Open it{" "}
          <ArrowRight
            aria-hidden
            className="size-5 transition-transform group-hover:translate-x-1"
          />
        </Link>
      </div>
    </section>
  );
}

/**
 * The floating live-status widget, shown on every page while something is running and gone once it has stopped. It takes no room
 * in the page: a pill sits at the bottom of the screen with a pulsing dot (red for a live recording), what is happening, and a thin
 * light moving along its lower edge. With more than one thing running, "+N" opens a small list above it.
 */
export function InFlightBanner({ items }: { items: Dashboard["inProgress"] }) {
  const [open, setOpen] = useState(false);
  const [mountedNow] = useState(() => Date.now());
  const [dismissed, setDismissed] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const raw = sessionStorage.getItem("calmasta_dismissed_inflight");
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch {
      return new Set();
    }
  });
  const titleOf = useDisplayTitle();

  const visibleItems = items.filter((it) => !dismissed.has(it.id));
  if (visibleItems.length === 0) return null;
  const first = visibleItems[0];
  const status = statusFor(first);
  const live = status.indicator === "recording";
  const tone = live ? "bg-danger-solid" : "bg-accent-solid";

  const onDismiss = () => {
    setDismissed((prev) => {
      const next = new Set(prev);
      visibleItems.forEach((it) => next.add(it.id));
      try {
        sessionStorage.setItem("calmasta_dismissed_inflight", JSON.stringify([...next]));
      } catch {}
      return next;
    });
  };

  const isTakingLonger =
    !live &&
    Boolean(first.at) &&
    mountedNow - new Date(first.at).getTime() > 15 * 60 * 1000;
  const displayLabel = isTakingLonger ? "Taking longer than usual" : status.label;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-30 mx-auto max-w-md sm:bottom-6 md:left-[calc(50%+8rem)] md:right-auto md:w-max md:max-w-sm md:-translate-x-1/2">
      {open && visibleItems.length > 1 && (
        <ul
          aria-label="Running now"
          className="jb-pop-soft mb-2 overflow-hidden rounded-2xl border border-border bg-background shadow-lg">
          {visibleItems.map((it) => {
            const st = statusFor(it);
            return (
              <li
                key={`${it.kind}-${it.id}`}
                className="border-b border-border last:border-b-0">
                <Link
                  href={dashboardPath(it.href)}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface">
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {titleOf(it)}
                  </span>
                  <RowStatus status={st} />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <div
        role="status"
        className="jb-pop-soft jb-glow relative flex h-12 items-center gap-2 overflow-hidden rounded-full border border-border bg-background pl-4 pr-2 shadow-lg">
        <Link
          href={dashboardPath(first.href)}
          aria-label={`${displayLabel}: ${titleOf(first)}. Open it.`}
          className="group flex min-w-0 flex-1 items-center gap-3">
          <span
            aria-hidden
            className="relative grid size-3 shrink-0 place-items-center">
            <span
              className={`absolute inset-0 animate-ping rounded-full motion-reduce:hidden ${tone}`}
            />
            <span className={`relative size-2.5 rounded-full ${tone}`} />
          </span>
          <span className="min-w-0 flex-1 truncate text-sm">
            <span className="font-semibold">{displayLabel}</span>
            <span className="text-muted"> · {titleOf(first)}</span>
          </span>
        </Link>
        {visibleItems.length > 1 && (
          <button
            type="button"
            aria-expanded={open}
            aria-label={`${visibleItems.length - 1} more running`}
            onClick={() => setOpen((v) => !v)}
            className="shrink-0 rounded-full bg-surface px-2.5 py-1 text-xs font-medium tabular-nums text-muted transition-colors hover:bg-border hover:text-foreground">
            +{visibleItems.length - 1}
          </button>
        )}
        <Link
          href={dashboardPath(first.href)}
          tabIndex={-1}
          aria-hidden
          className="grid size-8 shrink-0 place-items-center rounded-full bg-surface text-muted transition-colors hover:bg-accent-solid hover:text-on-accent">
          <ArrowRight className="size-4" />
        </Link>
        <button
          type="button"
          aria-label="Dismiss in-flight status"
          onClick={onDismiss}
          className="grid size-8 shrink-0 place-items-center rounded-full bg-surface text-muted transition-colors hover:bg-border hover:text-foreground">
          <X className="size-4" />
        </button>
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-6 bottom-0 h-0.5 overflow-hidden rounded-full">
          <span
            className={`jb-shimmer absolute inset-y-0 -left-full w-full bg-gradient-to-r from-transparent to-transparent ${live ? "via-danger-solid" : "via-accent-solid"}`}
          />
        </span>
      </div>
    </div>
  );
}

/** Open follow-ups across every capture. Each links back to the conversation where it was said. */
export function FollowUps({ d }: { d: Dashboard }) {
  const m = d.metrics.actionItems;
  return (
    <Card>
      <CardHeader title="Your follow-ups" id="followups" />
      {d.actionItems.length === 0 ? (
        <div className="flex items-center gap-4 p-5">
          <div className="w-24 shrink-0">
            <ChecklistIllustration />
          </div>
          <div>
            <p className="text-base font-semibold">You’re all caught up</p>
            <p className="mt-1 text-sm text-muted">
              Nothing is waiting on you. New follow-ups from your conversations
              will appear here.
            </p>
          </div>
        </div>
      ) : (
        <ul aria-labelledby="followups" className="divide-y divide-border">
          {d.actionItems.slice(0, 4).map((a) => (
            <li key={a.id}>
              <Link
                href={dashboardPath(a.href)}
                className="flex items-start gap-4 px-5 py-3 transition-colors hover:bg-surface">
                <CheckCircle2
                  aria-hidden
                  className="mt-0.5 size-5 shrink-0 text-muted"
                />
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 block text-sm font-medium">
                    {a.text}
                  </span>
                  <span className="mt-1 block truncate text-xs text-muted">
                    From {a.captureTitle} · {timeAgo(a.at)}
                  </span>
                </span>
                <Badge tone={a.status === "suggested" ? "warning" : "info"}>
                  {a.status === "suggested" ? "To review" : "Open"}
                </Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {m && d.actionItems.length > 0 && (
        <p className="border-t border-border px-5 py-3 text-xs text-muted">
          {m.toReview} to review · {m.open} open
        </p>
      )}
    </Card>
  );
}
