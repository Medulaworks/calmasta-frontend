import type { CSSProperties } from "react";
import { FileText, ListChecks, Mic, ShieldCheck, Video } from "lucide-react";

const vars = (d: number): CSSProperties => ({ ["--d" as string]: `${d}s` }) as CSSProperties;
const WAVE = [10, 18, 28, 20, 34, 24, 14, 30, 22, 16, 32, 18];

const STEPS = [
  { label: "Capture", Icon: Video, cls: "jb-step1" },
  { label: "Understand", Icon: Mic, cls: "jb-step2" },
  { label: "Act", Icon: ListChecks, cls: "jb-step3" },
] as const;

/**
 * The right-hand side of the sign-in screens, kept to one idea told in order: what is said in a meeting becomes something to do.
 * A looping nine-second story plays in one card (a line is said, an action is found and ticked, a summary is ready) while the
 * three steps above it light up in turn. With reduced motion, everything just shows.
 */
export function AuthShowcase() {
  return (
    <aside aria-hidden className="relative hidden overflow-hidden bg-surface lg:flex lg:h-dvh lg:items-center lg:justify-center lg:px-12">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_85%_10%,color-mix(in_srgb,var(--accent-solid)_16%,transparent),transparent_50%)]" />

      <div className="jb-rise relative w-full max-w-md">
        <h2 className="text-3xl font-semibold leading-tight tracking-tight">Say it once. Joobah handles the rest.</h2>
        <p className="mt-3 text-base leading-6 text-muted">Meetings and voice notes become transcripts, decisions and follow-ups, so nothing said slips away.</p>

        <ol className="mt-6 flex items-center gap-2 text-sm font-medium">
          {STEPS.map(({ label, Icon, cls }, i) => (
            <li key={label} className="flex items-center gap-2">
              <span className={`${cls} inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5`}>
                <Icon className="size-4 text-accent" /> {label}
              </span>
              {i < STEPS.length - 1 && <span className="h-px w-4 bg-border" />}
            </li>
          ))}
        </ol>

        <div className="mt-4 space-y-4 rounded-2xl border border-border bg-background p-5 shadow-lg">
          <div className="flex items-center gap-2 text-sm font-medium">
            <span className="relative grid size-6 place-items-center rounded-full bg-accent-solid/15 text-accent"><Mic className="size-3.5" /></span>
            Live transcript
            <span className="ml-auto flex h-6 items-center gap-[3px]">
              {WAVE.map((h, i) => <span key={i} className="jb-bar w-[3px] rounded-full bg-accent-solid" style={{ height: h, ...vars(i * 0.08) }} />)}
            </span>
          </div>

          <ul className="space-y-3 text-sm leading-6">
            <li className="jb-s1"><span className="font-medium text-accent">Maya</span> <span className="text-xs text-muted">00:08</span><br />Let&rsquo;s lock the Q4 budget at 120k.</li>
            <li className="jb-s2">
              <span className="font-medium text-accent">Amara</span> <span className="text-xs text-muted">00:21</span><br />
              Agreed. <span className="jb-mark px-1">I&rsquo;ll send the revised estimate by Friday.</span>
            </li>
          </ul>

          <div className="jb-s3 flex items-center gap-3 rounded-xl bg-surface px-4 py-3 text-sm">
            <span className="jb-box grid size-5 shrink-0 place-items-center rounded-md border border-border" style={vars(3.2)}>
              <svg viewBox="0 0 16 16" className="size-3" fill="none" stroke="var(--on-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path className="jb-check" d="M3.5 8.5l3 3 6-7" style={vars(3.2)} />
              </svg>
            </span>
            <span className="min-w-0 flex-1">Send the revised estimate</span>
            <span className="text-xs text-muted">Action item</span>
          </div>

          <div className="jb-s4 flex items-center gap-3 border-t border-border pt-4 text-sm">
            <FileText className="size-4 shrink-0 text-accent" />
            <span className="font-medium">Meeting summary</span>
            <span className="ml-auto flex w-24 flex-col gap-1.5">
              <span className="jb-line block h-1.5 w-full rounded-full bg-border" style={vars(4.7)} />
              <span className="jb-line block h-1.5 w-2/3 rounded-full bg-border" style={vars(4.9)} />
            </span>
            <span className="rounded-full bg-emerald-500/15 px-2 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">Ready</span>
          </div>
        </div>

        <p className="mt-6 flex items-center gap-2 text-sm text-muted">
          <ShieldCheck className="size-4 shrink-0 text-accent" /> Always visible. Records only with consent.
        </p>
      </div>
    </aside>
  );
}
