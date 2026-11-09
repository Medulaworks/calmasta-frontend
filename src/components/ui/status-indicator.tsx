import { LoaderCircle } from "lucide-react";

/**
 * The little animated mark inside a status badge or toast. Each stage of a meeting capture has its own, so you can tell
 * "waiting to be let in" from "recording" from "meeting ended" without reading: bouncing dots, a pulsing red dot, a
 * spinner, and a check that draws itself. It takes its colour from the text around it.
 */
export type Indicator = "pulse" | "spinner" | "dots" | "recording" | "check";

export function StatusIndicator({ kind, className = "" }: { kind: Indicator; className?: string }) {
  if (kind === "spinner") return <LoaderCircle aria-hidden className={`size-3 shrink-0 animate-spin motion-reduce:animate-none ${className}`} />;
  if (kind === "dots") {
    return (
      <span aria-hidden className={`inline-flex shrink-0 items-end gap-[2px] pb-px ${className}`}>
        {[0, 1, 2].map((i) => (
          <span key={i} className="jb-dot size-[3px] rounded-full bg-current" style={{ animationDelay: `${i * 0.16}s` }} />
        ))}
      </span>
    );
  }
  if (kind === "recording") {
    return (
      <span aria-hidden className={`relative inline-flex size-2 shrink-0 ${className}`}>
        <span className="absolute inset-0 animate-ping rounded-full bg-current opacity-60 motion-reduce:animate-none" />
        <span className="relative size-2 rounded-full bg-current" />
      </span>
    );
  }
  if (kind === "check") {
    return (
      <svg aria-hidden viewBox="0 0 16 16" className={`jb-popin size-3 shrink-0 ${className}`} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path className="jb-tickdraw" d="M3 8.5l3.2 3.2L13 4.5" />
      </svg>
    );
  }
  return <span aria-hidden className={`size-2 shrink-0 animate-pulse rounded-full bg-current motion-reduce:animate-none ${className}`} />;
}
