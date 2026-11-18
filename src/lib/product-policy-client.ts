/**
 * Typed BFF client for product policy and global budget.
 * Uses same-origin /api/admin/* proxy; preserves CSRF/origin, traceparent
 * and Idempotency-Key/version semantics. 503 policy_unavailable is
 * propagated as a typed ApiError so UI can show a truthful disabled state
 * without fabricating zero costs or fake settings. No secrets are logged.
 */
import { ApiError } from "./upload-client";
import type {
  EffectiveProductPolicy,
  PolicyPreviewResult,
  PolicyHistoryResponse,
  PolicyCatalog,
  BudgetPreviewResult,
  BudgetUpdateResult,
  PolicyChange,
} from "./product-policy-types";

async function policyFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const corr = res.headers.get("x-correlation-id") ?? (body as { correlationId?: string }).correlationId;
    const code = (body as { code?: string; error?: string }).code ?? (res.status === 503 ? "policy_unavailable" : undefined);
    const message = (body as { error?: string; message?: string }).error ?? (body as { message?: string }).message ?? "Something went wrong.";
    throw new ApiError(res.status, message, code ?? (corr ? `correlation:${corr}` : undefined), corr ?? undefined);
  }
  return body as T;
}

function assertPolicyShape(body: unknown): asserts body is EffectiveProductPolicy {
  const b = body as Record<string, unknown>;
  if (
    typeof b.environment !== "string" ||
    typeof b.version !== "number" ||
    typeof b.values !== "object" ||
    b.values === null
  ) {
    throw new ApiError(502, "Malformed policy response.", "invalid_response");
  }
}

// GET /admin/settings/product — abortable, 503 is honest unavailable (no zero fabrications)
export function getEffectivePolicy(signal?: AbortSignal): Promise<EffectiveProductPolicy> {
  return policyFetch<EffectiveProductPolicy>("/api/admin/settings/product", { signal }).then((body) => {
    assertPolicyShape(body);
    return body;
  });
}

export function getCatalog(signal?: AbortSignal): Promise<PolicyCatalog> {
  return policyFetch<PolicyCatalog>("/api/admin/settings/catalog", { signal });
}

// Preview uses POST /admin/settings/product/preview — no mutation, but still version-gated
export function previewPolicy(
  expectedVersion: number,
  changes: PolicyChange,
  signal?: AbortSignal,
): Promise<PolicyPreviewResult> {
  return policyFetch<PolicyPreviewResult>("/api/admin/settings/product/preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ expectedVersion, changes }),
    signal,
  });
}

// PATCH with Idempotency-Key + reason — stable key per user action
export function updatePolicy(
  expectedVersion: number,
  changes: PolicyChange,
  reason: string,
  idempotencyKey: string,
): Promise<EffectiveProductPolicy> {
  return policyFetch<EffectiveProductPolicy>("/api/admin/settings/product", {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
    body: JSON.stringify({ expectedVersion, changes, reason }),
  });
}

export function getPolicyHistory(params: { limit?: number; cursor?: number; signal?: AbortSignal } = {}): Promise<PolicyHistoryResponse> {
  const sp = new URLSearchParams();
  sp.set("limit", String(params.limit ?? 25));
  if (params.cursor !== undefined) sp.set("cursor", String(params.cursor));
  return policyFetch<PolicyHistoryResponse>(`/api/admin/settings/product/history?${sp}`, { signal: params.signal });
}

// Global budget — shared_database scope, owner-only capability
export function previewGlobalBudget(
  expectedVersion: number,
  limitMicros: string,
): Promise<BudgetPreviewResult> {
  return policyFetch<BudgetPreviewResult>("/api/admin/controls/global-budget/preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ expectedVersion, limitMicros }),
  });
}

export function updateGlobalBudget(
  expectedVersion: number,
  limitMicros: string,
  reason: string,
  idempotencyKey: string,
): Promise<BudgetUpdateResult> {
  return policyFetch<BudgetUpdateResult>("/api/admin/controls/global-budget", {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
    body: JSON.stringify({ expectedVersion, limitMicros, reason }),
  });
}

// Helper: stable Idempotency-Key for one intended mutation
export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}
