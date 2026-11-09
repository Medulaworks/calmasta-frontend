import { addDays, todayIn } from "./tz";

// The time window the home numbers cover. Always whole days in the person's own time zone, so "Today" means their today.

export type HomePeriodKey = "day" | "week" | "month" | "range";
export interface HomePeriod { key: HomePeriodKey; from?: string; to?: string }
export interface DayWindow { from: string; to: string; days: number }

export const DEFAULT_HOME_PERIOD: HomePeriod = { key: "week" };
export const HOME_PERIOD_LABEL: Record<Exclude<HomePeriodKey, "range">, string> = { day: "Day", week: "Week", month: "Month" };

const DAY = 86_400_000;
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const ms = (d: string) => Date.parse(`${d}T00:00:00Z`);
const real = (d: unknown): d is string => typeof d === "string" && ISO.test(d) && !Number.isNaN(ms(d)) && new Date(ms(d)).toISOString().slice(0, 10) === d;

/** Reads a saved choice. Anything unusable falls back to the last 7 days. */
export function parseHomePeriod(raw: unknown, tz: string, now = new Date()): HomePeriod {
  const o = (raw ?? {}) as Partial<HomePeriod>;
  if (o.key === "day" || o.key === "week" || o.key === "month") return { key: o.key };
  if (o.key === "range" && real(o.from) && real(o.to) && o.from <= o.to && o.to <= todayIn(tz, now)) return { key: "range", from: o.from, to: o.to };
  return DEFAULT_HOME_PERIOD;
}

/** The first and last day covered, inclusive. */
export function windowOf(p: HomePeriod, tz: string, now = new Date()): DayWindow {
  if (p.key === "range" && p.from && p.to) return { from: p.from, to: p.to, days: Math.round((ms(p.to) - ms(p.from)) / DAY) + 1 };
  const days = { day: 1, week: 7, month: 30, range: 7 }[p.key];
  const to = todayIn(tz, now);
  return { from: addDays(to, -(days - 1)), to, days };
}

/** The same number of days immediately before, to compare against. */
export function previousWindow(w: DayWindow): DayWindow {
  const to = addDays(w.from, -1);
  return { from: addDays(to, -(w.days - 1)), to, days: w.days };
}

export const inWindow = (day: string, w: DayWindow) => day >= w.from && day <= w.to;

const fmt = (d: string, year: boolean) => new Date(ms(d)).toLocaleDateString("en-GB", { day: "numeric", month: "short", ...(year ? { year: "numeric" } : {}), timeZone: "UTC" });

/** "Today", "28 Oct – 3 Nov", "1 – 31 Oct 2026". */
export function windowText(p: HomePeriod, w: DayWindow): string {
  if (w.days === 1) return p.key === "day" ? "Today" : fmt(w.from, true);
  return `${fmt(w.from, w.from.slice(0, 4) !== w.to.slice(0, 4))} – ${fmt(w.to, true)}`;
}

/** What the comparison says: "vs the 7 days before". */
export const versusText = (p: HomePeriod, w: DayWindow) => (w.days === 1 ? "yesterday" : p.key === "range" ? "the period before" : `the ${w.days} days before`);
