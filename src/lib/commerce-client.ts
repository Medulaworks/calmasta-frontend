import { ApiError } from "./upload-client";
async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) }, ...init });
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, body.error ?? "Failed", body.code);
  return body as T;
}
export const getCatalog = (): Promise<{ items: Array<{ sku: string; plan: string; amount_cents: number; currency: string; credits_seconds: number }> }> => req("/api/commerce/catalog");
export const createCheckout = (sku: string, returnUrl?: string, idempotencyKey?: string) =>
  req<{ id: string; checkout_url: string; status: string }>("/api/commerce/checkout", { method: "POST", headers: { "Idempotency-Key": idempotencyKey ?? crypto.randomUUID() }, body: JSON.stringify({ sku, returnUrl }) });
export const getCheckoutIntent = (id: string) => req<{ id: string; status: string; checkout_url: string }>(`/api/commerce/checkout/${encodeURIComponent(id)}`);
export const getPortal = () => req<{ url: string | null }>("/api/commerce/portal", { method: "POST" });
