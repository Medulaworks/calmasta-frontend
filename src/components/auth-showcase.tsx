import type { CSSProperties, ReactNode } from "react";
import { FitStage } from "@/components/auth-stage";
import { FileText, ListChecks, Mic, ShieldCheck, Sparkles, Video } from "lucide-react";

/** Custom properties for the CSS animations (`--d` start delay, `--f` idle float length). */
const vars = (d: number, f = 7): CSSProperties => ({ ["--d" as string]: `${d}s`, ["--f" as string]: `${f}s` }) as CSSProperties;

const CARD =
  "jb-lift rounded-2xl border border-border bg-background/90 shadow-[0_22px_48px_-22px_color-mix(in_srgb,var(--accent)_55%,transparent)] backdrop-blur";

/** A card that springs in, then floats gently. `x`/`y`/`w` place it on the 540 x 552 stage. */
function Float({ x, y, w, d, f, z, children }: { x: number; y: number; w: number; d: number; f?: number; z: number; children: ReactNode }) {
  return (
    <div className="jb-card absolute" style={{ left: x, top: y, width: w, zIndex: z, ...vars(d, f) }}>
      {children}
    </div>
  );
}

const WAVE = [10, 18, 30, 22, 36, 26, 14, 32, 40, 24, 16, 34, 28, 20, 38, 22, 12, 30, 18, 26];

function Waveform() {
  return (
    <div aria-hidden className="flex h-10 items-center gap-[3px]">
      {WAVE.map((h, i) => (
        <span key={i} className="jb-bar w-[3px] rounded-full bg-accent-solid" style={{ height: h, ...vars(i * 0.07) }} />
      ))}
    </div>
  );
}

function Check({ delay }: { delay: number }) {
  return (
    <span className="jb-box grid size-[18px] shrink-0 place-items-center rounded-[5px] border border-border" style={vars(delay)}>
      <svg viewBox="0 0 16 16" className="size-3" fill="none" stroke="var(--on-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path className="jb-check" d="M3.5 8.5l3 3 6-7" style={vars(delay)} />
      </svg>
    </span>
  );
}

function Avatar({ children, tone }: { children: ReactNode; tone: string }) {
  return (
    <span className={`-ml-2 grid size-7 place-items-center rounded-full border-2 border-background text-[11px] font-medium first:ml-0 ${tone}`}>
      {children}
    </span>
  );
}

/** The right-hand side of the sign-in screens: a looping, decorative story of what Jooba does. */
export function AuthShowcase() {
  return (
    <aside aria-hidden className="relative hidden overflow-hidden bg-surface lg:flex lg:h-dvh lg:flex-col lg:items-center lg:justify-center lg:gap-3 lg:px-8 lg:py-[clamp(1rem,3vh,2rem)]">
      {/* Soft light, dotted grid and sound-ring illustration behind everything. */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,color-mix(in_srgb,var(--accent-solid)_20%,transparent),transparent_45%),radial-gradient(circle_at_85%_90%,color-mix(in_srgb,var(--accent)_14%,transparent),transparent_50%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-50 [background-image:radial-gradient(color-mix(in_srgb,var(--foreground)_14%,transparent)_1px,transparent_1px)] [background-size:22px_22px] [mask-image:radial-gradient(circle_at_50%_50%,black,transparent_72%)]" />
      <div className="jb-orb pointer-events-none absolute -right-24 top-16 size-72 rounded-full bg-accent-solid/20 blur-3xl" />
      <div className="jb-orb pointer-events-none absolute -left-20 bottom-10 size-64 rounded-full bg-accent/15 blur-3xl" style={{ animationDelay: "-6s" }} />
      <svg className="pointer-events-none absolute left-1/2 top-1/2 size-[44rem] -translate-x-1/2 -translate-y-1/2 text-accent" viewBox="0 0 700 700" fill="none" stroke="currentColor" strokeOpacity="0.09">
        {[110, 170, 230, 290, 340].map((r) => (
          <circle key={r} cx="350" cy="350" r={r} />
        ))}
      </svg>

      <header className="relative max-w-md shrink-0 text-center">
        <p className="mx-auto inline-flex items-center gap-2 rounded-full border border-border bg-background/80 px-3 py-1 text-xs font-medium text-muted backdrop-blur">
          <Sparkles aria-hidden className="size-3.5 text-accent" /> Your meetings, working for you
        </p>
        <h2 className="mt-3 text-[clamp(1.25rem,3.4vh,1.75rem)] font-semibold leading-tight tracking-tight">Say it once. Jooba handles the rest.</h2>
        <p className="mt-1.5 text-[13px] leading-5 text-muted">From the call to the transcript, the decisions and the follow-up, nothing said in a meeting slips away.</p>
      </header>

      {/* The stage: 540 x 552, scaled to fit the space left on screen. */}
      <FitStage width={540} height={552} className="h-[calc(100dvh-13rem)] max-h-[640px] flex-none">
        <div className="relative h-full w-full">
          {/* Flow lines: capture to transcript to action items and document. */}
          <svg className="absolute inset-0 z-0" viewBox="0 0 540 552" fill="none">
            {["M150 150 C 150 190, 175 200, 205 205", "M330 282 C 330 312, 200 290, 150 304", "M430 282 C 430 298, 400 302, 395 318"].map((p) => (
              <g key={p}>
                <path d={p} className="jb-flow" stroke="var(--accent)" strokeOpacity="0.35" strokeWidth="1.5" strokeLinecap="round" />
                <circle r="3.5" fill="var(--accent-solid)">
                  <animateMotion dur="3.2s" repeatCount="indefinite" path={p} />
                </circle>
              </g>
            ))}
          </svg>

          {/* 1 · Live meeting */}
          <Float x={0} y={0} w={300} d={0.1} f={7} z={3}>
            <div className={`${CARD} p-4`}>
              <div className="flex items-center gap-3">
                <span className="grid size-9 place-items-center rounded-lg bg-accent/10 text-accent"><Video aria-hidden className="size-[18px]" /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">Quarterly planning</p>
                  <p className="truncate text-xs text-muted">Jooba Assistant is in the meeting</p>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-2 py-0.5 text-[11px] font-medium text-red-600 dark:text-red-400">
                  <span className="jb-rec size-1.5 rounded-full bg-red-500" /> REC
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3">
                <Waveform />
                <div className="flex shrink-0">
                  <Avatar tone="bg-accent text-background">M</Avatar>
                  <Avatar tone="bg-accent-solid text-on-accent">A</Avatar>
                  <Avatar tone="bg-border text-foreground">D</Avatar>
                </div>
              </div>
            </div>
          </Float>

          {/* Consent chip */}
          <Float x={318} y={26} w={210} d={0.9} f={8} z={4}>
            <div className={`${CARD} flex items-center gap-2.5 px-3.5 py-2.5`}>
              <ShieldCheck aria-hidden className="size-[18px] shrink-0 text-accent" />
              <p className="text-xs leading-4"><span className="font-medium">Always visible.</span> <span className="text-muted">Records only with consent.</span></p>
            </div>
          </Float>

          {/* 2 · Transcript */}
          <Float x={190} y={110} w={332} d={0.45} f={7.5} z={5}>
            <div className={`${CARD} p-4`}>
              <div className="flex items-center gap-2">
                <Mic aria-hidden className="size-4 text-accent" />
                <p className="text-sm font-medium">Transcript</p>
                <span className="jb-found ml-auto inline-flex items-center gap-1 rounded-full bg-accent-solid/25 px-2 py-0.5 text-[11px] font-medium">
                  <Sparkles aria-hidden className="size-3" /> Action found
                </span>
              </div>
              <ul className="mt-3 space-y-2.5 text-[13px] leading-5">
                <li><span className="font-medium text-accent">Maya</span> <span className="text-[11px] text-muted">00:08</span><br />Let&rsquo;s lock the Q4 budget at 120k.</li>
                <li><span className="font-medium text-accent">Amara</span> <span className="text-[11px] text-muted">00:21</span><br />Agreed. <span className="jb-mark px-0.5">I&rsquo;ll send the revised estimate by Friday.</span></li>
                <li className="text-muted"><span className="font-medium text-accent">Maya</span> <span className="text-[11px]">00:34</span><br />Perfect, launch stays on the 12th.</li>
              </ul>
            </div>
          </Float>

          {/* 3 · Action items */}
          <Float x={0} y={306} w={266} d={0.8} f={8.5} z={4}>
            <div className={`${CARD} p-4`}>
              <div className="flex items-center gap-2">
                <ListChecks aria-hidden className="size-4 text-accent" />
                <p className="text-sm font-medium">Action items</p>
                <span className="ml-auto text-[11px] text-muted">You decide</span>
              </div>
              <ul className="mt-3 space-y-2.5 text-[13px] leading-5">
                {["Send the revised estimate", "Confirm the launch date", "Share the onboarding checklist"].map((t, i) => (
                  <li key={t} className="flex items-start gap-2.5"><span className="mt-0.5"><Check delay={0.8 + i * 0.9} /></span>{t}</li>
                ))}
              </ul>
              <p className="mt-3 text-[11px] text-muted">Suggestions only. You decide what happens.</p>
            </div>
          </Float>

          {/* 4 · Document */}
          <Float x={286} y={318} w={254} d={1.15} f={7} z={6}>
            <div className={`${CARD} p-4`}>
              <div className="flex items-center gap-2">
                <FileText aria-hidden className="size-4 text-accent" />
                <p className="truncate text-sm font-medium">Meeting summary</p>
                <span className="jb-ready ml-auto rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">Ready</span>
              </div>
              <div className="mt-3 space-y-2" aria-hidden>
                <span className="jb-line block h-2.5 w-2/3 rounded-full bg-accent/70" style={vars(0)} />
                <span className="jb-line block h-2 w-full rounded-full bg-border" style={vars(0.15)} />
                <span className="jb-line block h-2 w-[92%] rounded-full bg-border" style={vars(0.3)} />
                <span className="jb-line block h-2 w-[70%] rounded-full bg-border" style={vars(0.45)} />
                <span className="jb-line mt-3 block h-2 w-1/3 rounded-full bg-accent-solid/80" style={vars(0.6)} />
                <span className="jb-line block h-2 w-[88%] rounded-full bg-border" style={vars(0.75)} />
                <span className="jb-line block h-2 w-[60%] rounded-full bg-border" style={vars(0.9)} />
              </div>
              <div className="mt-3 flex gap-1.5 text-[11px] text-muted">
                <span className="rounded-full border border-border px-2 py-0.5">Edit freely</span>
                <span className="rounded-full border border-border px-2 py-0.5">Export</span>
              </div>
            </div>
          </Float>
        </div>
      </FitStage>

    </aside>
  );
}
