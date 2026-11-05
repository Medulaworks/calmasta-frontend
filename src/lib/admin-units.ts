// Settings are stored in one canonical unit each (seconds, bytes, micro-dollars per hour, dollars per day) so nothing is
// ever ambiguous on the wire. People read and type friendlier units; these helpers convert both ways in one place.

export type SettingUnit = "seconds" | "bytes" | "micros_per_hour" | "usd_per_day" | "days";

const FACTOR: Record<SettingUnit, number> = { seconds: 60, bytes: 1_000_000, micros_per_hour: 1_000_000, usd_per_day: 1, days: 1 };
const LABEL: Record<SettingUnit, string> = { seconds: "minutes", bytes: "MB", micros_per_hour: "USD per hour", usd_per_day: "USD per day", days: "days" };

export const unitLabel = (u: SettingUnit | undefined) => (u ? LABEL[u] : "");

/** Canonical value to what the person sees and types. */
export const toDisplay = (u: SettingUnit | undefined, v: number) => (u ? v / FACTOR[u] : v);

/** What the person typed back to the canonical value, or null when it isn't a usable number. */
export function fromDisplay(u: SettingUnit | undefined, text: string): number | null {
  const n = Number(text.trim());
  if (text.trim() === "" || !Number.isFinite(n)) return null;
  const v = u ? n * FACTOR[u] : n;
  // Seconds, bytes and micro-dollars are whole numbers; round away floating-point dust from the conversion.
  return u === "usd_per_day" ? Math.round(v * 100) / 100 : Math.round(v);
}

/** A value with its unit, for read-only text such as "300 minutes". */
export function formatSetting(u: SettingUnit | undefined, v: number): string {
  const d = toDisplay(u, v);
  const text = Number.isInteger(d) ? String(d) : d.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  return u ? `${text} ${LABEL[u]}` : text;
}
