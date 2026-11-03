import { ADMIN_AVAILABLE } from "./admin-capabilities";
import { ADMIN_PREVIEW, previewGet, previewPost } from "./admin-preview";
import { ApiError, api } from "./upload-client";

/** Until the admin API exists (and is switched on), staff screens get an honest "not available" instead of a request that would 404. */
const unavailable = <T>(): Promise<T> => Promise.reject(new ApiError(503, "The staff API isn't available yet.", "feature_unavailable"));

/** The staff sign-in ended (or never happened in this browser): go to the staff sign-in instead of showing an error. */
function guard<T>(p: Promise<T>): Promise<T> {
  return p.catch((err) => {
    if (err instanceof ApiError && err.code === "staff_sign_in_required" && typeof window !== "undefined") window.location.href = `/admin/login?returnTo=${encodeURIComponent(window.location.pathname)}`;
    throw err;
  });
}

/** Staff-area requests. A 403 means "not staff": the shell shows a permission-denied page for it. */
export const adminGet = <T>(url: string) => (ADMIN_PREVIEW ? previewGet<T>(url) : ADMIN_AVAILABLE ? guard(api<T>(url, { cache: "no-store" })) : unavailable<T>());
export const adminPatch = <T = { ok: true }>(url: string, body: unknown) =>
  ADMIN_PREVIEW ? previewPost<T>(url, body, "PATCH") : !ADMIN_AVAILABLE ? unavailable<T>() : guard(api<T>(url, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }));
export const adminPost = <T = { ok: true }>(url: string, body: unknown) =>
  ADMIN_PREVIEW ? previewPost<T>(url, body) : !ADMIN_AVAILABLE ? unavailable<T>() : guard(api<T>(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }));

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
