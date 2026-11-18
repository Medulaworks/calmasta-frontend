"use client";
import { Loading, SkeletonPanel } from "@/components/ui/skeleton";
import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import {
  CHECKOUT_RETURN_PATH,
  checkoutUnavailableMessage,
  createCheckout,
  getCatalog,
  getPortal,
  isTrustedCheckoutUrl,
  purchaseKeyStore,
  type CatalogItem,
} from "@/lib/commerce-client";
import { ApiError } from "@/lib/upload-client";

/** User-facing message for a failed catalogue load; expired sessions ask to sign in. */
/** User-facing message for a failed catalogue load; expired sessions ask to sign in. */
export function catalogErrorMessage(error: unknown): string {
  return error instanceof ApiError && error.status === 401
    ? "Your session ended. Please sign in again."
    : "We couldn’t load the plans. Please try again.";
}

/**
 * Capability-aware purchase flow (woo-entitlements-v1).
 *
 * - Each offer renders from server capabilities: checkoutEnabled === false
 *   disables the button with actionable guidance instead of a dead redirect.
 * - One idempotency key per purchase attempt: retries reuse it, an explicit
 *   new purchase (after a definitive 4xx rejection) rotates it.
 * - A null checkout_url never reaches location: the page shows what to do next.
 * - Redirects go only to server-published https checkout origins.
 */
export function BillingView() {
  const catalog = useQuery({ queryKey: ["commerce-catalog"], queryFn: getCatalog });
  const keysRef = useRef(purchaseKeyStore());
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function checkout(item: CatalogItem) {
    if (item.checkoutEnabled === false || busy) return;
    setErr(null);
    setInfo(null);
    setBusy(item.sku);
    const key = keysRef.current.keyFor(item.sku);
    try {
      const r = await createCheckout(item.sku, CHECKOUT_RETURN_PATH, key);
      if (!r.checkout_url) {
        // No destination: stay on the page with guidance, never assign null.
        setInfo(
          r.reason
            ? checkoutUnavailableMessage(r.reason)
            : "Your purchase was recorded but the store has no checkout page for it yet. Nothing was charged — check back shortly or contact support.",
        );
        return;
      }
      const origins = r.checkoutOrigins ?? catalog.data?.checkoutOrigins ?? [];
      if (!isTrustedCheckoutUrl(r.checkout_url, origins)) {
        setErr("The store returned an unapproved checkout destination, so we stayed here. Nothing was charged.");
        return;
      }
      window.location.assign(r.checkout_url);
    } catch (e) {
      if (e instanceof ApiError && [400, 404, 409].includes(e.status)) {
        // Definitive rejection: the next click starts an explicit new purchase.
        keysRef.current.rotate(item.sku);
      }
      // Unknown outcomes (network loss, 5xx) keep the same key so a retry
      // resumes the same attempt instead of creating another order.
      setErr(e instanceof Error ? e.message : "We couldn’t start checkout");
    } finally {
      setBusy(null);
    }
  }

  async function portal() {
    try {
      const r = await getPortal();
      if (r.url) window.location.href = r.url;
      else setErr("The billing portal isn’t available yet. Your plan and usage are unchanged.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "We couldn’t open billing");
    }
  }

  if (catalog.isLoading)
    return (
      <Loading label="Loading plans" className="grid gap-5 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <SkeletonPanel key={i} className="h-72" />
        ))}
      </Loading>
    );
  if (catalog.isError) {
    const message = catalogErrorMessage(catalog.error);
    return (
      <Card>
        <div className="p-5 text-sm text-danger" role="alert">
          {message}
        </div>
      </Card>
    );
  }
  return (
    <div className="space-y-4">
      {err && (
        <div role="alert" className="rounded-lg bg-danger/10 p-3 text-sm text-danger">
          {err}
        </div>
      )}
      {info && (
        <div role="status" className="rounded-lg border border-border bg-surface p-3 text-sm text-muted">
          {info}
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-3">
        {(catalog.data?.items ?? []).map((item) => {
          const disabled = item.checkoutEnabled === false;
          return (
            <Card key={item.sku} className="p-5">
              <h3 className="font-medium">{item.sku}</h3>
              <p className="mt-1 text-sm text-muted">
                {(item.amount_cents / 100).toFixed(2)} {item.currency.toUpperCase()} ·{" "}
                {Math.round(item.credits_seconds / 60)} min
              </p>
              <Button
                className="mt-3 w-full"
                disabled={disabled || busy !== null}
                aria-disabled={disabled}
                title={disabled ? checkoutUnavailableMessage(item.reason) : undefined}
                onClick={() => void checkout(item)}
              >
                {busy === item.sku ? "Redirecting…" : disabled ? "Not available" : "Checkout"}
              </Button>
              {disabled && (
                <p className="mt-2 text-xs text-muted" role="note">
                  {checkoutUnavailableMessage(item.reason)}
                </p>
              )}
            </Card>
          );
        })}
      </div>
      <Card>
        <CardHeader title="Manage billing" />
        <div className="p-5">
          <Button variant="secondary" onClick={() => void portal()}>
            Open billing portal
          </Button>
        </div>
      </Card>
    </div>
  );
}
