// The time window the Home numbers cover. Always whole UTC days, so "Today" means the same thing to every admin.

export type PeriodKey = "day" | "week" | "month" | "all" | "range";
export interface Period { key: PeriodKey; from?: string; to?: string }

export const PERIOD_LABEL: Record<Exclude<PeriodKey, "range">, string> = { day: "Today", week: "Last 7 days", month: "Last 30 days", all: "All time" };
export const DEFAULT_PERIOD: Period = { key: "week" };

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const DAY = 86_400_000;
const utcDay = (d: Date) => d.toISOString().slice(0, 10);
const ms = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
export const today = (now = new Date()) => utcDay(now);

/** True for a real calendar date that isn't in the future. */
export function validDay(iso: string | null | undefined, now = new Date()): iso is string {
  return !!iso && ISO.test(iso) && !Number.isNaN(ms(iso)) && utcDay(new Date(ms(iso))) === iso && iso <= today(now);
}

/** Reads ?period=…&from=…&to=… . Anything unusable falls back to the last 7 days instead of failing. */
export function parsePeriod(get: (key: string) => string | null, now = new Date()): Period {
  const key = get("period");
  if (key === "day" || key === "week" || key === "month" || key === "all") return { key };
  if (key === "range") {
    const from = get("from"), to = get("to");
    if (validDay(from, now) && validDay(to, now) && from <= to) return { key, from, to };
  }
  return DEFAULT_PERIOD;
}

export function periodQuery(p: Period): string {
  return p.key === "range" ? `?period=range&from=${p.from}&to=${p.to}` : `?period=${p.key}`;
}

/** How many days the window covers, or null for "all time". */
export function periodDays(p: Period): number | null {
  if (p.key === "all") return null;
  if (p.key === "range") return Math.round((ms(p.to!) - ms(p.from!)) / DAY) + 1;
  return { day: 1, week: 7, month: 30 }[p.key];
}

const fmt = (iso: string, withYear: boolean) => new Date(ms(iso)).toLocaleDateString("en", { day: "numeric", month: "short", ...(withYear ? { year: "numeric" } : {}), timeZone: "UTC" });

/** The first and last day of the window, e.g. { from: "2026-10-28", to: "2026-11-03" }. from is null for all time. */
export function periodSpan(p: Period, now = new Date()): { from: string | null; to: string } {
  if (p.key === "range") return { from: p.from!, to: p.to! };
  const to = today(now);
  const days = periodDays(p);
  return { from: days === null ? null : utcDay(new Date(ms(to) - (days - 1) * DAY)), to };
}

/** "28 Oct – 3 Nov 2026", or "Today", or "Up to 3 Nov 2026". */
export function spanText(p: Period, now = new Date()): string {
  const { from, to } = periodSpan(p, now);
  if (p.key === "day") return fmt(to, true);
  if (from === null) return `Up to ${fmt(to, true)}`;
  return `${fmt(from, from.slice(0, 4) !== to.slice(0, 4))} – ${fmt(to, true)}`;
}

/** The name on the filter button. */
export const periodTitle = (p: Period, now = new Date()) => (p.key === "range" ? spanText(p, now) : PERIOD_LABEL[p.key]);
