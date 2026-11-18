import { ApiError } from "./upload-client";

/**
 * Customer commerce client (woo-entitlements-v1).
 *
 * Browser calls same-origin Next BFF routes only; the BFF holds the session
 * and proxies to the backend. Query parameters and browser input are never
 * treated as proof of payment — activation comes from authenticated intent
 * reads. Absolute return URLs fail closed on the backend, so checkout posts
 * the relative {@link CHECKOUT_RETURN_PATH}.
 */

/** Relative store-return path accepted by POST /commerce/checkout. */
export const CHECKOUT_RETURN_PATH = "/billing/return";

export type ActivationStatus =
  | "unpaid"
  | "pending"
  | "active"
  | "grace"
  | "partially_refunded"
  | "refunded"
  | "expired"
  | "consumed"
  | "blocked"
  | "failed";

export interface EntitlementPolicy {
  kind: "pack" | "subscription";
  expiresAfterDays?: number;
  rollover?: boolean;
  period?: string;
  monthlySeconds?: number;
  graceDays?: number;
}

export interface CatalogItem {
  sku: string;
  plan: string;
  amount_cents: number;
  currency: string;
  credits_seconds: number;
  is_subscription: boolean;
  /** False when the offer cannot be bought (e.g. Pro while subscriptions are unavailable). */
  checkoutEnabled: boolean;
  /** Machine reason for checkoutEnabled === false, e.g. "subscriptions_unavailable". */
  reason: string | null;
  entitlementPolicy?: EntitlementPolicy | null;
}

export interface CommerceCapabilities {
  checkoutIntents: boolean;
  checkout: boolean;
  paidEntitlements: boolean;
  purchasedCredits: boolean;
  subscriptions: boolean;
  refunds: boolean;
  portal: boolean;
}

export interface CatalogResponse {
  contractVersion?: string | null;
  entitlementsVersion?: string | null;
  available: boolean;
  checkoutEnabled: boolean;
  checkoutOrigins: string[];
  capabilities?: CommerceCapabilities;
  items: CatalogItem[];
  reason: string | null;
}

export interface CheckoutResponse {
  id: string;
  sku: string;
  status: string;
  bindingStatus?: string;
  paymentStatus?: string;
  activationStatus?: ActivationStatus;
  entitlementsVersion?: string;
  expires_at?: string;
  /** Null until a real checkout destination exists; never assign null to location. */
  checkout_url: string | null;
  checkoutEnabled?: boolean;
  checkoutOrigins?: string[];
  reason?: string | null;
}

export interface CheckoutIntent extends CheckoutResponse {
  entitlement?: {
    availableSeconds: number;
    consumedSeconds: number;
    reservedSeconds: number;
    refundedSeconds: number;
    expiresAt: string | null;
    periodStart?: string | null;
    periodEnd?: string | null;
    graceUntil?: string | null;
  } | null;
}

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  // Merge headers after the request options so caller headers can add fields
  // (e.g. Idempotency-Key) but can never silently discard the JSON Content-Type.
  const merged = new Headers((init?.headers ?? {}) as HeadersInit);
  merged.set("Content-Type", "application/json");
  const res = await fetch(url, { cache: "no-store", ...init, headers: merged });
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, body.error ?? "Failed", body.code);
  return body as T;
}

/** Low-level JSON helper for commerce BFF routes; exported for focused tests. */
export const commerceRequest = <T>(url: string, init?: RequestInit): Promise<T> =>
  req<T>(url, init);

/** Fresh UUID idempotency key for an explicit new purchase attempt. */
export const newIdempotencyKey = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;

/**
 * Stable per-attempt idempotency keys. Retries of the same purchase attempt
 * reuse the stored key; an explicit new purchase calls `rotate` first so the
 * backend never sees a fresh intent for a retry, nor a reused key for a new
 * purchase.
 */
export function purchaseKeyStore() {
  const keys = new Map<string, string>();
  return {
    keyFor(sku: string): string {
      const existing = keys.get(sku);
      if (existing) return existing;
      const fresh = newIdempotencyKey();
      keys.set(sku, fresh);
      return fresh;
    },
    rotate(sku: string): string {
      const fresh = newIdempotencyKey();
      keys.set(sku, fresh);
      return fresh;
    },
    clear(sku: string): void {
      keys.delete(sku);
    },
  };
}

export const getCatalog = (): Promise<CatalogResponse> =>
  req("/api/commerce/catalog");

export const createCheckout = (
  sku: string,
  returnUrl: string = CHECKOUT_RETURN_PATH,
  idempotencyKey: string = newIdempotencyKey(),
) =>
  req<CheckoutResponse>("/api/commerce/checkout", {
    method: "POST",
    headers: { "Idempotency-Key": idempotencyKey },
    body: JSON.stringify({ sku, returnUrl }),
  });

export const getCheckoutIntent = (id: string) =>
  req<CheckoutIntent>(`/api/commerce/checkout/${encodeURIComponent(id)}`);

export const getPortal = () => req<{ url: string | null }>("/api/commerce/portal", { method: "POST" });

/**
 * A checkout destination is trusted only when it is https and its origin was
 * published by the server for this catalogue/intent. Anything else — http,
 * relative paths, unlisted origins — must not receive a redirect.
 */
export function isTrustedCheckoutUrl(
  raw: string | null | undefined,
  origins: readonly string[] | null | undefined,
): boolean {
  if (!raw || !origins || origins.length === 0) return false;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  return origins.some((origin) => {
    try {
      return new URL(origin).origin === url.origin;
    } catch {
      return false;
    }
  });
}

/** Actionable, non-technical guidance for a disabled offer or missing checkout URL. */
export function checkoutUnavailableMessage(reason: string | null | undefined): string {
  switch (reason) {
    case "subscriptions_unavailable":
      return "Recurring subscriptions aren’t available yet. Extra-hour packs can still be bought below.";
    case "checkout_bridge_unavailable":
      return "Checkout isn’t connected yet. Your plan and usage are unchanged — please try again later.";
    case "busy":
    case "service_unavailable":
      return "The store is busy. Please try again — you won’t be charged twice for the same attempt.";
    case "unknown_sku":
      return "That offer is no longer available. Please choose another pack.";
    default:
      return "This offer is not available right now. Your plan and usage are unchanged.";
  }
}
