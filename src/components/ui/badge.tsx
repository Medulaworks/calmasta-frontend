import type { Tone } from "@/lib/status";
import { type Indicator, StatusIndicator } from "@/components/ui/status-indicator";

const TONES: Record<Tone, string> = {
  neutral: "bg-surface text-muted ring-border",
  info: "bg-accent/10 text-accent ring-accent/25",
  success: "bg-success/10 text-success ring-success/25",
  warning: "bg-warning/10 text-warning ring-warning/30",
  danger: "bg-danger/10 text-danger ring-danger/25",
};

/**
 * A status pill. Give it an `indicator` for an animated mark (spinner, dots, recording dot, check); without one the dot
 * pulses while `active`. The label always says it in words too.
 */
export function Badge({ tone = "neutral", active = false, indicator, children }: { tone?: Tone; active?: boolean; indicator?: Indicator; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-2 whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset ${TONES[tone]}`}>
      {indicator ? <StatusIndicator kind={indicator} /> : <span aria-hidden className={`h-2 w-2 rounded-full bg-current ${active ? "animate-pulse motion-reduce:animate-none" : ""}`} />}
      {children}
    </span>
  );
}
