import { addDays, dayKey, todayIn } from "./tz";

// The dashboard is not one page but five. Which one a person sees depends on how much they have captured and how recently.
// The first match wins, top to bottom. This runs in the browser from what the dashboard already receives; if the server
// later sends the state itself, only the inputs change.

export type DashboardState = "first_result" | "cold" | "lapsed" | "active" | "warming";

export interface StateInput {
  /** Captures that reached a finished transcript. Failed and cancelled ones do not count. */
  captureCount: number;
  /** When each finished capture happened (any order). */
  captureDates: string[];
  /** Whether the person has already opened their first result. */
  firstResultSeen: boolean;
  now: Date;
  timeZone: string;
}

const MINUTE = 60_000;
const DAY = 86_400_000;

/** Whole days between two day keys (YYYY-MM-DD), so the answer follows the person's own calendar and not UTC. */
function daysBetween(a: string, b: string) {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY);
}

export function resolveDashboardState(i: StateInput): DashboardState {
  const dates = i.captureDates.map((d) => new Date(d)).filter((d) => !Number.isNaN(d.getTime()));
  const newest = dates.length ? new Date(Math.max(...dates.map((d) => d.getTime()))) : null;

  if (i.captureCount === 1 && newest && !i.firstResultSeen && i.now.getTime() - newest.getTime() < 10 * MINUTE && i.now >= newest) return "first_result";
  if (i.captureCount === 0) return "cold";

  const today = todayIn(i.timeZone, i.now);
  if (newest && daysBetween(dayKey(newest, i.timeZone), today) >= 10) return "lapsed";

  const days = new Set<string>();
  const weekAgo = addDays(today, -6);
  for (const d of dates) {
    const k = dayKey(d, i.timeZone);
    if (k >= weekAgo && k <= today) days.add(k);
  }
  if (i.captureCount >= 5 || days.size >= 3) return "active";
  return "warming";
}
