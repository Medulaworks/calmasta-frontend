import type { Tone } from "@/lib/status";

const TONES: Record<Tone, string> = {
  neutral: "bg-surface text-muted ring-border",
  info: "bg-accent/10 text-accent ring-accent/25",
  success: "bg-success/10 text-success ring-success/25",
  warning: "bg-warning/10 text-warning ring-warning/30",
  danger: "bg-danger/10 text-danger ring-danger/25",
};

/** A status pill. The dot pulses while `active`, and the label always says it in words too. */
export function Badge({ tone = "neutral", active = false, children }: { tone?: Tone; active?: boolean; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${TONES[tone]}`}>
      <span aria-hidden className={`h-1.5 w-1.5 rounded-full bg-current ${active ? "animate-pulse" : ""}`} />
      {children}
    </span>
  );
}
