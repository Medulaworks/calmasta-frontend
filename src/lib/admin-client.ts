import { ApiError } from "./upload-client";

const ADMIN_ERROR_MESSAGES: Record<string, string> = {
  invalid_integration_profile: "Some required integration fields are missing or malformed. Check every required field and try again.",
  invalid_store_profile: "WooCommerce rejected these settings. Check that the store URL uses HTTPS, includes its WordPress subdirectory when needed, and that the selected mode is Sandbox or Production.",
  invalid_store_url: "Enter a valid HTTPS WooCommerce store URL. Keep the WordPress subdirectory if the store uses one; remove credentials, query strings, and fragments.",
  invalid_woo_mode: "Choose either Sandbox or Production for the WooCommerce mode.",
  woo_store_origin_not_allowed: "This WooCommerce store origin is not approved for the API environment. Ask an administrator to allowlist the store origin, then retry.",
};

async function adminFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", credentials: "same-origin", ...init });
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const corr = res.headers.get("x-correlation-id") ?? body.correlationId;
    const message = ADMIN_ERROR_MESSAGES[body.code] ?? body.error ?? body.message ?? "Something went wrong.";
    throw new ApiError(res.status, message, body.code ?? (corr ? `correlation:${corr}` : undefined));
  }
  return body as T;
}
export const adminGet = <T>(url: string): Promise<T> => adminFetch<T>(url);
export const adminPost = <T = { ok: true }>(url: string, body: unknown, headers?: Record<string,string>): Promise<T> =>
  adminFetch<T>(url, { method: "POST", headers: { "Content-Type": "application/json", ...(headers ?? {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
export const adminPatch = <T = { ok: true }>(url: string, body: unknown, headers?: Record<string,string>): Promise<T> =>
  adminFetch<T>(url, { method: "PATCH", headers: { "Content-Type": "application/json", ...(headers ?? {}) }, body: JSON.stringify(body) });

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
