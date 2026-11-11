import { ApiError } from "./upload-client";
import { adminGet, adminPost } from "./admin-client";
import type { SharingState, PublicNotes, SharedNotesView } from "./sharing-types";

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init });
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const corr = res.headers.get("x-correlation-id") ?? (body as { correlationId?: string }).correlationId;
    const code = (body as { code?: string }).code ?? (res.status === 503 ? "capability_unavailable" : undefined);
    const msg = (body as { error?: string; message?: string }).error ?? (body as { message?: string }).message ?? "Something went wrong.";
    throw new ApiError(res.status, msg, code ?? (corr ? `correlation:${corr}` : undefined), corr ?? undefined);
  }
  return body as T;
}

export const getSharing = (captureId: string, signal?: AbortSignal) =>
  req<SharingState>(`/api/captures/${encodeURIComponent(captureId)}/sharing`, { signal });

export const createPublication = (captureId: string, body: { expectedVersion: number; insightIds: string[]; includeTranscript: boolean; displayTitle?: string; expiresAt?: string | null }, idempotencyKey: string) =>
  req<SharingState>(`/api/captures/${encodeURIComponent(captureId)}/sharing/publications`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
    body: JSON.stringify(body),
  });

export const createLink = (captureId: string, body: { publicationId: string; expiresAt?: string | null }, idempotencyKey: string) =>
  req<{ linkUrl?: string; alreadyIssued?: boolean } & SharingState>(`/api/captures/${encodeURIComponent(captureId)}/sharing/links`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
    body: JSON.stringify(body),
  });

export const revokeLink = (captureId: string, linkId: string, body: { expectedVersion: number; reason: string }) =>
  req<SharingState>(`/api/captures/${encodeURIComponent(captureId)}/sharing/links/${encodeURIComponent(linkId)}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

export const createGrant = (captureId: string, body: { publicationId: string; email: string }, idempotencyKey: string) =>
  req<SharingState>(`/api/captures/${encodeURIComponent(captureId)}/sharing/grants`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
    body: JSON.stringify(body),
  });

export const revokeGrant = (captureId: string, grantId: string, body: { expectedVersion: number }) =>
  req<SharingState>(`/api/captures/${encodeURIComponent(captureId)}/sharing/grants/${encodeURIComponent(grantId)}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

export const sendGrant = (captureId: string, grantId: string) =>
  req<{ ok: true }>(`/api/captures/${encodeURIComponent(captureId)}/sharing/grants/${encodeURIComponent(grantId)}/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });

export const getPublicNotes = (token: string, signal?: AbortSignal) => req<PublicNotes>(`/api/public/notes/${encodeURIComponent(token)}`, { signal });
export const getSharedNotes = (grantId: string, signal?: AbortSignal) => req<SharedNotesView>(`/api/shared-notes/${encodeURIComponent(grantId)}`, { signal });

// Admin helpers reusing admin client where staff endpoints live
export const adminListCaptures = () => adminGet("/api/admin/captures");
