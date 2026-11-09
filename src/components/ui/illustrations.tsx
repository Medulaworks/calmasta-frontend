import type { ReactNode } from "react";

// Small, friendly spot illustrations for empty states, onboarding and the dashboard. They are drawn with the theme's own
// colours (accent, accent-solid, border, surface), so they follow every theme and both light and dark mode. They are
// decorative: always hidden from screen readers, and the gentle float stops under "reduced motion".

const SOFT = "color-mix(in srgb, var(--accent-solid) 22%, transparent)";
const SOFT_ACCENT = "color-mix(in srgb, var(--accent) 12%, transparent)";

function Frame({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <svg viewBox="0 0 240 180" fill="none" role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true} className="h-auto w-full">
      {children}
    </svg>
  );
}

/** A little sparkle that twinkles. */
function Spark({ x, y, s = 1, d = 0 }: { x: number; y: number; s?: number; d?: number }) {
  return (
    // The position lives on the outer group. The twinkle animates `transform` on the inner one, so it can never move the sparkle.
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <g className="jb-twinkle" style={{ animationDelay: `${d}s`, transformOrigin: "0 0" }}>
        <path d="M0 -7 C1 -2 2 -1 7 0 C2 1 1 2 0 7 C-1 2 -2 1 -7 0 C-2 -1 -1 -2 0 -7Z" fill="var(--accent-solid)" />
      </g>
    </g>
  );
}

const ground = <ellipse cx="120" cy="160" rx="82" ry="8" fill={SOFT_ACCENT} />;

/** Think: a microphone with sound rippling out. */
export function VoiceIllustration() {
  return (
    <Frame>
      <circle cx="120" cy="84" r="64" fill={SOFT} />
      <circle cx="120" cy="84" r="48" stroke="var(--accent-solid)" strokeOpacity=".5" strokeDasharray="3 6" className="jb-spin" style={{ transformOrigin: "120px 84px" }} />
      {ground}
      <g className="jb-bob">
        <rect x="100" y="42" width="40" height="64" rx="20" fill="var(--background)" stroke="var(--accent)" strokeWidth="3" />
        <path d="M110 62h20M110 72h20M110 82h20" stroke="var(--accent-solid)" strokeWidth="3" strokeLinecap="round" />
        <path d="M86 88c0 20 15 34 34 34s34-14 34-34" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
        <path d="M120 122v18M104 140h32" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
      </g>
      <path d="M66 70c-6 8-6 22 0 30M54 62c-10 13-10 37 0 50" stroke="var(--accent-solid)" strokeWidth="3" strokeLinecap="round" />
      <path d="M174 70c6 8 6 22 0 30M186 62c10 13 10 37 0 50" stroke="var(--accent-solid)" strokeWidth="3" strokeLinecap="round" />
      <Spark x={196} y={34} d={0.2} />
      <Spark x={44} y={142} s={0.7} d={1} />
    </Frame>
  );
}

/** Meet: a video call with a friendly assistant tile. */
export function MeetingIllustration() {
  return (
    <Frame>
      <circle cx="120" cy="84" r="64" fill={SOFT} />
      {ground}
      <g className="jb-bob">
        <rect x="46" y="38" width="148" height="100" rx="14" fill="var(--background)" stroke="var(--accent)" strokeWidth="3" />
        <rect x="58" y="50" width="52" height="38" rx="8" fill={SOFT_ACCENT} />
        <circle cx="84" cy="64" r="8" fill="var(--accent)" fillOpacity=".7" />
        <path d="M68 84c2-8 8-11 16-11s14 3 16 11" fill="var(--accent)" fillOpacity=".7" />
        <rect x="120" y="50" width="62" height="38" rx="8" fill={SOFT} />
        <circle cx="151" cy="62" r="6" fill="var(--accent-solid)" />
        <path d="M139 82c2-6 6-9 12-9s10 3 12 9" fill="var(--accent-solid)" />
        <rect x="58" y="96" width="124" height="30" rx="8" fill={SOFT_ACCENT} />
        <path d="M70 108h60M70 116h38" stroke="var(--accent)" strokeOpacity=".45" strokeWidth="3" strokeLinecap="round" />
        <circle cx="160" cy="111" r="8" fill="var(--accent-solid)" />
        <path d="M156 111l3 3 5-6" stroke="var(--on-accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <Spark x={204} y={44} d={0.4} />
      <Spark x={36} y={120} s={0.7} d={1.1} />
    </Frame>
  );
}

/** Documents: a stack of pages with a check. */
export function DocumentIllustration() {
  return (
    <Frame>
      <circle cx="120" cy="84" r="64" fill={SOFT} />
      {ground}
      <g className="jb-bob">
        <rect x="74" y="36" width="84" height="108" rx="10" fill="var(--background)" stroke="var(--accent)" strokeOpacity=".35" strokeWidth="3" transform="rotate(-8 116 90)" />
        <rect x="82" y="30" width="84" height="108" rx="10" fill="var(--background)" stroke="var(--accent)" strokeWidth="3" />
        <path d="M96 54h40M96 68h56M96 82h48M96 96h30" stroke="var(--accent)" strokeOpacity=".45" strokeWidth="3" strokeLinecap="round" />
        <circle cx="156" cy="122" r="16" fill="var(--accent-solid)" />
        <path d="M149 122l5 5 9-11" stroke="var(--on-accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <Spark x={40} y={50} d={0.3} />
      <Spark x={200} y={132} s={0.7} d={0.9} />
    </Frame>
  );
}

/** An open box: nothing here yet, room for what you make. */
export function InboxIllustration() {
  return (
    <Frame>
      <circle cx="120" cy="84" r="64" fill={SOFT} />
      {ground}
      <g className="jb-bob">
        <path d="M58 92l20-34h84l20 34v44a8 8 0 0 1-8 8H66a8 8 0 0 1-8-8z" fill="var(--background)" stroke="var(--accent)" strokeWidth="3" strokeLinejoin="round" />
        <path d="M58 92h42c2 10 9 16 20 16s18-6 20-16h42" stroke="var(--accent)" strokeWidth="3" strokeLinejoin="round" />
        <path d="M96 40v-10M120 36V22M144 40V30" stroke="var(--accent-solid)" strokeWidth="3" strokeLinecap="round" />
      </g>
      <Spark x={52} y={40} d={0.1} />
      <Spark x={196} y={70} s={0.8} d={0.8} />
      <Spark x={176} y={28} s={0.6} d={1.4} />
    </Frame>
  );
}

/** Act: a checklist with ticks, a little celebration. */
export function ChecklistIllustration() {
  return (
    <Frame>
      <circle cx="120" cy="84" r="64" fill={SOFT} />
      {ground}
      <g className="jb-bob">
        <rect x="62" y="32" width="116" height="116" rx="14" fill="var(--background)" stroke="var(--accent)" strokeWidth="3" />
        {[0, 1, 2].map((i) => (
          <g key={i} transform={`translate(0 ${i * 30})`}>
            <rect x="76" y="48" width="20" height="20" rx="6" fill={i < 2 ? "var(--accent-solid)" : "none"} stroke={i < 2 ? "var(--accent-solid)" : "var(--accent)"} strokeOpacity={i < 2 ? 1 : 0.4} strokeWidth="2.5" />
            {i < 2 && <path d="M81 58l4 4 7-8" stroke="var(--on-accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}
            <path d="M106 58h54" stroke="var(--accent)" strokeOpacity=".45" strokeWidth="3" strokeLinecap="round" />
          </g>
        ))}
      </g>
      <Spark x={196} y={40} d={0.2} />
      <Spark x={40} y={64} s={0.8} d={0.7} />
      <Spark x={204} y={118} s={0.6} d={1.3} />
    </Frame>
  );
}

/** Calendar: a month with one day marked. */
export function CalendarIllustration() {
  return (
    <Frame>
      <circle cx="120" cy="84" r="64" fill={SOFT} />
      {ground}
      <g className="jb-bob">
        <rect x="56" y="38" width="128" height="106" rx="14" fill="var(--background)" stroke="var(--accent)" strokeWidth="3" />
        <path d="M56 70h128" stroke="var(--accent)" strokeWidth="3" />
        <path d="M88 28v20M152 28v20" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
        {[0, 1, 2, 3].map((r) => [0, 1, 2, 3, 4].map((c) => {
          const hit = r === 1 && c === 2;
          return hit ? <rect key={`${r}${c}`} x={68 + c * 21 - 4} y={80 + r * 16 - 5} width="20" height="14" rx="5" fill="var(--accent-solid)" /> : <circle key={`${r}${c}`} cx={78 + c * 21} cy={86 + r * 16} r="2.5" fill="var(--accent)" fillOpacity=".35" />;
        }))}
      </g>
      <Spark x={198} y={52} d={0.5} />
    </Frame>
  );
}

/** Meet, Think, Act: three linked steps. Used on the welcome screen. */
export function SpineIllustration() {
  return (
    <svg viewBox="0 0 320 120" fill="none" aria-hidden className="h-auto w-full">
      <path d="M72 60h176" stroke="var(--accent-solid)" strokeWidth="3" strokeDasharray="3 8" strokeLinecap="round" className="jb-flow" />
      {[["Meet", 56, "M44 56a6 6 0 0 1 6-6h12a6 6 0 0 1 6 6v8a6 6 0 0 1-6 6H50a6 6 0 0 1-6-6zM68 58l8-5v14l-8-5"], ["Think", 160, "M160 46a14 14 0 0 1 8 25v5h-16v-5a14 14 0 0 1 8-25z"], ["Act", 264, "M254 60l7 7 12-14"]].map(([label, x, path], i) => (
        <g key={label as string} className="jb-pop-soft" style={{ animationDelay: `${i * 0.12}s` }}>
          <circle cx={x as number} cy="60" r="34" fill={i === 1 ? "var(--accent-solid)" : "var(--background)"} stroke="var(--accent)" strokeWidth="3" />
          <path d={path as string} stroke={i === 1 ? "var(--on-accent)" : "var(--accent)"} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <text x={x as number} y="116" textAnchor="middle" fontSize="13" fontWeight="600" fill="var(--foreground)">{label as string}</text>
        </g>
      ))}
    </svg>
  );
}

/**
 * The welcome banner's backdrop: soft sound-wave ribbons that sweep across the right side and fade out to the left, with
 * three small chips (voice, calendar, check) floating along them. It is meant to be felt more than looked at: low contrast,
 * no box, and it bleeds off the card edge.
 */
export function WelcomeWaves() {
  const waves = [
    { y: 100, a: 34, o: 0.5, w: 2.5, c: "var(--accent-solid)", d: "0s" },
    { y: 110, a: 26, o: 0.32, w: 2, c: "var(--accent-solid)", d: "-2s" },
    { y: 92, a: 42, o: 0.22, w: 2, c: "var(--accent)", d: "-4s" },
    { y: 120, a: 18, o: 0.18, w: 1.5, c: "var(--accent)", d: "-6s" },
  ];
  return (
    <svg viewBox="0 0 640 200" fill="none" aria-hidden preserveAspectRatio="xMaxYMid slice" className="h-full w-full" style={{ maskImage: "linear-gradient(to right, transparent 0%, black 38%)", WebkitMaskImage: "linear-gradient(to right, transparent 0%, black 38%)" }}>
      {waves.map((w, i) => (
        <path
          key={i}
          className="jb-sway"
          style={{ animationDelay: w.d }}
          d={`M-40 ${w.y} C 40 ${w.y - w.a} 120 ${w.y + w.a} 200 ${w.y} S 360 ${w.y - w.a} 440 ${w.y} S 600 ${w.y + w.a} 680 ${w.y}`}
          stroke={w.c}
          strokeOpacity={w.o}
          strokeWidth={w.w}
          strokeLinecap="round"
        />
      ))}
      <circle cx="470" cy="100" r="64" fill="var(--accent-solid)" fillOpacity=".08" />

      <g className="jb-bob" style={{ animationDelay: "-1s" }}>
        <rect x="396" y="40" width="52" height="52" rx="16" fill="var(--background)" stroke="var(--border)" />
        <rect x="414" y="52" width="16" height="24" rx="8" fill="var(--accent-solid)" />
        <path d="M408 68c0 9 6 14 14 14s14-5 14-14" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" />
      </g>
      <g className="jb-bob" style={{ animationDelay: "-2.6s" }}>
        <rect x="498" y="110" width="52" height="52" rx="16" fill="var(--background)" stroke="var(--border)" />
        <rect x="510" y="124" width="28" height="24" rx="6" stroke="var(--accent)" strokeWidth="2.5" />
        <path d="M510 133h28M518 120v7M530 120v7" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" />
        <rect x="526" y="138" width="8" height="6" rx="2" fill="var(--accent-solid)" />
      </g>
      <g className="jb-bob" style={{ animationDelay: "-4.2s" }}>
        <rect x="574" y="48" width="52" height="52" rx="16" fill="var(--background)" stroke="var(--border)" />
        <circle cx="600" cy="74" r="14" fill="var(--accent-solid)" />
        <path d="M593 74l5 5 9-11" stroke="var(--on-accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <Spark x={372} y={150} s={0.8} d={0.4} />
      <Spark x={560} y={26} s={0.7} d={1.2} />
      <Spark x={640} y={140} s={0.6} d={0.8} />
    </svg>
  );
}
