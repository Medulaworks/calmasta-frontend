import { ApiError } from "./upload-client";
import { adminGet, adminPost } from "./admin-client";
import type { CaptureOperationalView, CaptureListResponse, CaptureEvent, CostSummary, ActivityEntry } from "./capture-admin-types";

async function adminFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const corr = res.headers.get("x-correlation-id") ?? body.correlationId;
    throw new ApiError(res.status, body.error ?? body.message ?? "Something went wrong.", body.code ?? (corr ? `correlation:${corr}` : undefined));
  }
  return body as T;
}

export function listCaptures(params: { cursor?: string; limit?: number; q?: string; source?: string; stage?: string; from?: string; to?: string; customerId?: string; signal?: AbortSignal }) {
  const sp = new URLSearchParams();
  if (params.cursor) sp.set("cursor", params.cursor);
  sp.set("limit", String(params.limit ?? 25));
  if (params.q) sp.set("q", params.q.trim().slice(0, 100));
  if (params.source && params.source !== "all") sp.set("source", params.source);
  if (params.stage && params.stage !== "all") sp.set("stage", params.stage);
  if (params.from) sp.set("from", params.from);
  if (params.to) sp.set("to", params.to);
  if (params.customerId) sp.set("customerId", params.customerId);
  return adminFetch<CaptureListResponse>(`/api/admin/captures?${sp}`, { signal: params.signal });
}

export const getCaptureOperational = (id: string, signal?: AbortSignal) =>
  adminFetch<CaptureOperationalView>(`/api/admin/captures/${encodeURIComponent(id)}`, { signal });

export const getCaptureEvents = (id: string, signal?: AbortSignal) =>
  adminFetch<{ items: CaptureEvent[]; nextCursor: string | null }>(`/api/admin/captures/${encodeURIComponent(id)}/events`, { signal });

export const getCaptureCosts = (id: string, signal?: AbortSignal) =>
  adminFetch<CostSummary>(`/api/admin/captures/${encodeURIComponent(id)}/costs`, { signal });

export const getCustomerActivity = (customerId: string, signal?: AbortSignal) =>
  adminFetch<{ items: ActivityEntry[]; nextCursor: string | null }>(`/api/admin/customers/${encodeURIComponent(customerId)}/activity`, { signal });

export const stopCapture = (id: string, body: { expectedVersion: number; reason: string }, idempotencyKey: string) =>
  adminPost<{ status: string }>(`/api/admin/captures/${encodeURIComponent(id)}/stop`, body, { "Idempotency-Key": idempotencyKey });
