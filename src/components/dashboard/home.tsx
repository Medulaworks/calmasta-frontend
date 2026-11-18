"use client";

import { ArrowRight, FileAudio, Mic, UploadCloud } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { PlatformLogo } from "@/components/ui/platform-logo";
import { setPendingFile } from "@/lib/pending-upload";
import { playSound } from "@/lib/sounds";
import { formatDay, formatTime } from "@/lib/tz";

const delay = (s: number) => ({ ["--d" as string]: `${s}s` }) as React.CSSProperties;
const card = "jb-rise group flex flex-col overflow-hidden rounded-2xl border border-border bg-background text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const foot = "inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors";
// One primary action (filled) and two secondary ones (outlined), all the same size, so the row reads in order of importance.
const primary = `${foot} bg-accent-solid text-on-accent group-hover:brightness-95`;
const secondary = `${foot} border border-border bg-background text-foreground group-hover:bg-surface`;

/** The picture at the top of each card: a soft accent wash over a faint dot grid, with the artwork centred. Decoration only. */
function Stage({ children }: { children: React.ReactNode }) {
  return (
    <div aria-hidden className="relative grid h-28 place-items-center overflow-hidden border-b border-border/70 bg-gradient-to-br from-accent-solid/20 via-accent-solid/5 to-surface">
      <span className="pointer-events-none absolute inset-0 opacity-60 [background-image:radial-gradient(circle,var(--border)_1px,transparent_1px)] [background-size:16px_16px] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_75%)]" />
      <span className="relative">{children}</span>
    </div>
  );
}

/** A microphone ringed by sound bars. The bars start moving when the card is hovered or focused. */
function VoiceArt() {
  const bar = (i: number, side: number) => {
    const h = [0.35, 0.6, 0.9, 0.55, 0.75, 0.4][i];
    return <span key={`${side}${i}`} className="block h-10 w-1 origin-center rounded-full bg-accent-solid motion-reduce:!animate-none group-hover:[animation:jb-bar_1.3s_ease-in-out_infinite] group-focus-visible:[animation:jb-bar_1.3s_ease-in-out_infinite]" style={{ transform: `scaleY(${h})`, opacity: 0.35 + h * 0.5, animationDelay: `${i * 0.12}s` }} />;
  };
  return (
    <span className="flex items-center gap-1.5">
      <span className="flex items-center gap-1.5">{[0, 1, 2, 3, 4, 5].map((i) => bar(i, 0))}</span>
      <span className="mx-3 grid size-14 place-items-center rounded-full text-on-accent bg-accent-solid shadow-[0_0_0_6px_color-mix(in_srgb,var(--accent-solid)_22%,transparent),0_0_0_14px_color-mix(in_srgb,var(--accent-solid)_10%,transparent)]"><Mic className="size-6" /></span>
      <span className="flex items-center gap-1.5">{[5, 4, 3, 2, 1, 0].map((i) => bar(i, 1))}</span>
    </span>
  );
}

/** The three meeting apps on raised tiles, with a small "Joobah joined" pill under them. */
function MeetingArt() {
  return (
    <span className="flex flex-col items-center gap-2">
      <span className="flex items-end gap-3">
        {(["google_meet", "microsoft_teams", "zoom"] as const).map((p, i) => (
          <span key={p} className={`jb-bob rounded-xl shadow-md ${i === 1 ? "-translate-y-1" : ""}`} style={{ animationDelay: `${-i * 1.4}s` }}><PlatformLogo platform={p} size={44} /></span>
        ))}
      </span>
      <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-foreground shadow-sm"><span className="size-1.5 rounded-full bg-success" /> Joobah joined</span>
    </span>
  );
}

/** A drop zone with two audio files tilted behind it. */
function UploadArt() {
  const chip = "absolute top-1/2 flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-muted shadow-sm";
  return (
    <span className="relative block h-16 w-56">
      <span className={`${chip} -left-4 -translate-y-1/2 -rotate-6`}><FileAudio className="size-3.5 text-accent" /> call.mp3</span>
      <span className={`${chip} -right-4 -translate-y-1/3 rotate-6`}><FileAudio className="size-3.5 text-accent" /> idea.m4a</span>
      <span className="absolute inset-x-8 inset-y-0 grid place-items-center rounded-xl border-2 border-dashed border-accent-solid/50 bg-background/90 shadow-sm transition-transform duration-200 group-hover:-translate-y-0.5">
        <span className="flex items-center gap-2 text-xs font-medium text-foreground"><UploadCloud className="size-4 text-accent" /> Drop audio</span>
      </span>
    </span>
  );
}

function Body({ title, body, children }: { title: string; body: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col p-5">
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-muted">{body}</p>
      <div className="mt-auto pt-5">{children}</div>
    </div>
  );
}

/**
 * The three ways to start, as equal cards with one shape: a picture, a title, one line of help and a button at the foot.
 * Record your voice has the filled button; capturing a meeting and uploading audio have outlined ones. Text is the normal
 * foreground and muted colours on white, so it keeps standard contrast.
 */
export function ActionCards() {
  const router = useRouter();
  const file = useRef<HTMLInputElement>(null);
  return (
    <section aria-label="Start something" className="grid gap-4 md:grid-cols-3">
      <Link href="/dashboard/voice" onClick={() => playSound("recordStart")} style={delay(0)} className={card}>
        <Stage><VoiceArt /></Stage>
        <Body title="Record your voice" body="Say what is on your mind. Get clear notes and next steps."><span className={primary}><Mic aria-hidden className="size-4" /> Start recording</span></Body>
      </Link>

      <Link href="/dashboard/capture?focus=link" style={delay(0.06)} className={card}>
        <Stage><MeetingArt /></Stage>
        <Body title="Join a meeting" body="Paste a Meet, Teams or Zoom link. Joobah joins and takes notes."><span className={secondary}>Paste a link <ArrowRight aria-hidden className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" /></span></Body>
      </Link>

      <button type="button" onClick={() => file.current?.click()} style={delay(0.12)} className={card}>
        <input ref={file} type="file" accept="audio/*,video/mp4,video/webm,.m4a,.mp3,.wav" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) { setPendingFile(f); playSound("sent"); router.push("/dashboard/voice"); } }} />
        <Stage><UploadArt /></Stage>
        <Body title="Upload audio" body="Have a recording already? Drop a file here, or browse."><span className={secondary}>Choose a file <ArrowRight aria-hidden className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" /></span></Body>
      </button>
    </section>
  );
}

/**
 * A plain welcome line: the greeting on the left, today's date and a live clock on the right. No card, no extras.
 * The clock starts empty and fills in after the page loads, so the server and browser never disagree about the time.
 */
export function WelcomeBar({ title, subtitle, timeZone }: { title: string; subtitle: string; timeZone: string }) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const t = setInterval(tick, 15_000);
    return () => clearInterval(t);
  }, []);
  return (
    <header className="jb-rise flex flex-wrap items-end justify-between gap-x-6 gap-y-1">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight md:text-2xl">{title}</h1>
        <p className="mt-1 text-sm text-muted">{subtitle}</p>
      </div>
      <p className="min-h-5 text-sm text-muted" aria-label="Today">
        {now && <span className="tabular-nums">{formatDay(now, timeZone)} · <span className="font-medium text-foreground">{formatTime(now, timeZone)}</span></span>}
      </p>
    </header>
  );
}
