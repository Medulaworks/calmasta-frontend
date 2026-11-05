import { ApiError } from "./upload-client";

/** No staff HTTP contracts exist in the current backend. Never send speculative requests or return sample success. */
const unavailable = <T>(): Promise<T> => Promise.reject(new ApiError(503, "The staff API is not available yet.", "feature_unavailable"));
export const adminGet = <T>(url: string): Promise<T> => { void url; return unavailable<T>(); };
export const adminPost = <T = { ok: true }>(url: string, body: unknown): Promise<T> => { void url; void body; return unavailable<T>(); };
export const adminPatch = <T = { ok: true }>(url: string, body: unknown): Promise<T> => { void url; void body; return unavailable<T>(); };

/** Staff-facing times are always shown in UTC and say so, so nobody has to guess the zone. */
export const fmtUtc = (v: string | Date | null | undefined) => {
  if (!v) return "–";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "–" : `${d.toISOString().slice(0, 16).replace("T", " ")} UTC`;
};

export function ageText(seconds: number | null): string {
  if (seconds === null) return "none waiting";
  if (seconds < 90) return `${seconds}s`;
  if (seconds < 5400) return `${Math.round(seconds / 60)} min`;
  return `${(seconds / 3600).toFixed(1)} h`;
}

export const shortId = (id: string) => id.slice(0, 8);

/** What a server type looks like after JSON: dates become strings. */
export type Json<T> = T extends Date ? string : T extends (infer U)[] ? Json<U>[] : T extends object ? { [K in keyof T]: Json<T[K]> } : T;
