import { api } from "./upload-client";

/** Staff-area requests. A 403 means "not staff": the shell shows a permission-denied page for it. */
export const adminGet = <T>(url: string) => api<T>(url, { cache: "no-store" });
export const adminPost = <T = { ok: true }>(url: string, body: unknown) =>
  api<T>(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

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
