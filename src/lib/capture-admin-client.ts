import { ApiError } from "./upload-client";
import { adminGet, adminPost } from "./admin-client";
import type { CaptureOperationalView, CaptureListResponse, CaptureEvent, CostSummary, ActivityEntry } from "./capture-admin-types";

async function adminFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init });
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const corr = res.headers.get("x-correlation-id") ?? (body as { correlationId?: string }).correlationId;
    const code = (body as { code?: string; error?: string }).code ?? (res.status === 503 ? "capability_unavailable" : undefined);
    const message = (body as { error?: string; message?: string }).error ?? (body as { message?: string }).message ?? "Something went wrong.";
    // Respect 503 policy_unavailable/capability_unavailable — do not fabricate data; propagate exact code.
    throw new ApiError(res.status, message, code ?? (corr ? `correlation:${corr}` : undefined), corr ?? undefined);
  }
  // Guard malformed response — missing expected fields should fail, not invent defaults.
  return body as T;
}

function assertList(body: unknown): asserts body is CaptureListResponse {
  const b = body as Record<string, unknown>;
  if (!b || typeof b !== "object" || !Array.isArray((b as { items?: unknown }).items)) throw new ApiError(502, "Malformed capture list.", "invalid_response");
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
  return adminFetch<CaptureListResponse>(`/api/admin/captures?${sp}`, { signal: params.signal }).then((body) => {
    assertList(body);
    return body;
  });
}

export const getCaptureOperational = (id: string, signal?: AbortSignal) =>
  adminFetch<CaptureOperationalView>(`/api/admin/captures/${encodeURIComponent(id)}`, { signal });

export const getCaptureEvents = (id: string, signal?: AbortSignal) =>
  adminFetch<{ items: CaptureEvent[]; nextCursor: string | null }>(`/api/admin/captures/${encodeURIComponent(id)}/events`, { signal });

export const getCaptureCosts = (id: string, signal?: AbortSignal) =>
  adminFetch<CostSummary>(`/api/admin/captures/${encodeURIComponent(id)}/costs`, { signal }).then((body) => {
    // Guard: never fabricate zero when provider data is missing — null means unknown.
    const b = body as unknown as Record<string, unknown>;
    if (!b || typeof b !== "object" || !("currency" in b) || !("completeness" in b)) throw new ApiError(502, "Malformed cost response.", "invalid_response");
    return body;
  });

export const getCustomerActivity = (customerId: string, signal?: AbortSignal) =>
  adminFetch<{ items: ActivityEntry[]; nextCursor: string | null }>(`/api/admin/customers/${encodeURIComponent(customerId)}/activity`, { signal });

export const stopCapture = (id: string, body: { expectedVersion: number; reason: string }, idempotencyKey: string) =>
  adminPost<{ status: string }>(`/api/admin/captures/${encodeURIComponent(id)}/stop`, body, { "Idempotency-Key": idempotencyKey });
