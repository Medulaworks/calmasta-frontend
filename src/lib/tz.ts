// Time zone arithmetic with IANA zone names (never fixed offsets), so daylight saving is handled.
// Used by the server (slot calculation) and the browser (showing times in the viewer's own zone).

/** True if `tz` is a zone this runtime knows. */
export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return typeof tz === "string" && tz.length > 0 && tz.length <= 64;
  } catch {
    return false;
  }
}

/** Wall-clock fields of an instant in a zone. */
function partsIn(tz: string, ms: number) {
  const f = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const p = Object.fromEntries(f.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return { y: Number(p.year), m: Number(p.month), d: Number(p.day), hh: Number(p.hour), mm: Number(p.minute) };
}

/** How many minutes the zone is ahead of UTC at this instant (positive east of Greenwich). */
export function offsetMinutes(tz: string, ms: number): number {
  const p = partsIn(tz, ms);
  return (Date.UTC(p.y, p.m - 1, p.d, p.hh, p.mm) - Math.floor(ms / 60_000) * 60_000) / 60_000;
}

/**
 * The instant at which a zone's wall clock reads y-m-d hh:mm. Returns null if that wall time never happens
 * (the hour skipped when clocks go forward). For an hour that happens twice (clocks go back) it returns the first.
 */
export function zonedToUtc(tz: string, y: number, m: number, d: number, hh: number, mm: number): Date | null {
  const wall = Date.UTC(y, m - 1, d, hh, mm);
  let guess = wall;
  for (let i = 0; i < 4; i++) {
    const next = wall - offsetMinutes(tz, guess) * 60_000;
    if (next === guess) break;
    guess = next;
  }
  const back = partsIn(tz, guess);
  if (back.y !== y || back.m !== m || back.d !== d || back.hh !== hh || back.mm !== mm) return null; // in a gap
  // Ambiguous (clocks went back): prefer the earlier of the two instants.
  const earlier = guess - 60 * 60_000;
  const e = partsIn(tz, earlier);
  if (e.y === y && e.m === m && e.d === d && e.hh === hh && e.mm === mm) return new Date(earlier);
  return new Date(guess);
}

/** The y-m-d calendar date of an instant in a zone. */
export function dateInZone(tz: string, ms: number): { y: number; m: number; d: number } {
  const p = partsIn(tz, ms);
  return { y: p.y, m: p.m, d: p.d };
}


/** The browser's own time zone, falling back to UTC. */
export const browserTimeZone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
};

/** Today's date (YYYY-MM-DD) in a zone. */
export function todayIn(tz: string, now = new Date()): string {
  const d = dateInZone(tz, now.getTime());
  return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
}

/** The date a given instant falls on in a zone, as YYYY-MM-DD. */
export const dayKey = (iso: string | Date, tz: string): string => todayIn(tz, typeof iso === "string" ? new Date(iso) : iso);

/** Adds whole calendar days to a YYYY-MM-DD date. */
export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const x = new Date(Date.UTC(y, m - 1, d + n));
  return `${x.getUTCFullYear()}-${String(x.getUTCMonth() + 1).padStart(2, "0")}-${String(x.getUTCDate()).padStart(2, "0")}`;
}

/** The instants at which a calendar day starts and ends in a zone (the day after, midnight). */
export function dayRange(tz: string, date: string, days = 1): { from: Date; to: Date } {
  const [y, m, d] = date.split("-").map(Number);
  const e = new Date(Date.UTC(y, m - 1, d + days));
  const from = zonedToUtc(tz, y, m, d, 0, 0);
  const to = zonedToUtc(tz, e.getUTCFullYear(), e.getUTCMonth() + 1, e.getUTCDate(), 0, 0);
  if (!from || !to) throw new Error("Midnight does not exist on that day in that zone");
  return { from, to };
}

export const formatTime = (iso: string | Date, tz: string) => new Intl.DateTimeFormat(undefined, { timeZone: tz, hour: "numeric", minute: "2-digit" }).format(typeof iso === "string" ? new Date(iso) : iso);
export const formatDay = (iso: string | Date, tz: string) => new Intl.DateTimeFormat(undefined, { timeZone: tz, weekday: "long", day: "numeric", month: "long" }).format(typeof iso === "string" ? new Date(iso) : iso);
export const formatShortDay = (iso: string | Date, tz: string) => new Intl.DateTimeFormat(undefined, { timeZone: tz, weekday: "short", day: "numeric", month: "short" }).format(typeof iso === "string" ? new Date(iso) : iso);
export const formatDateTime = (iso: string | Date, tz: string) => `${formatShortDay(iso, tz)}, ${formatTime(iso, tz)}`;
/** A short label for a zone at an instant, e.g. "GMT+4". */
export const zoneLabel = (tz: string, at = new Date()) => new Intl.DateTimeFormat("en-GB", { timeZone: tz, timeZoneName: "short" }).formatToParts(at).find((p) => p.type === "timeZoneName")?.value ?? tz;
