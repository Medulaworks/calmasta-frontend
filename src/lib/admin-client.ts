import { ApiError } from "./upload-client";

const ADMIN_ERROR_MESSAGES: Record<string, string> = {
  staff_permission_required: "Your role doesn’t have permission to do that. Ask an owner for access.",
  invite_already_pending: "An invite is already pending for this email. Cancel the existing invite or wait for it to expire before sending another.",
  invalid_invitation: "This invite link is invalid, expired, cancelled, or has been replaced. Make sure you’re signed in with the verified email address that received it, or ask the inviter to resend the invitation.",
  already_staff: "This account already has admin access. Sign in to the admin area to continue.",
  email_already_registered: "An account already exists for this invited email. Sign in or choose ‘Set or reset password’ to continue.",
  invalid_credentials: "That email and password don’t match. Check them and try again.",
  invalid_code: "That code is incorrect or expired. Check it and try again, or request another code.",
  expired_code: "That code has expired. Request a new one and try again.",
  invalid_or_expired_token: "That recovery request expired or was already used. Request a new code and try again.",
  too_many_attempts: "Too many attempts. Wait a minute before requesting or entering another code.",
  too_many_auth_attempts: "Too many attempts. Wait a few minutes before trying again.",
  email_unavailable: "We couldn’t send the email right now. Wait a moment and try again.",
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
    const errorCode = typeof body.code === "string" ? body.code : typeof body.error === "string" ? body.error : undefined;
    const message = ADMIN_ERROR_MESSAGES[errorCode ?? ""] ?? body.error ?? body.message ?? "Something went wrong.";
    throw new ApiError(res.status, message, errorCode ?? (corr ? `correlation:${corr}` : undefined));
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
