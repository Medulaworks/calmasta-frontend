"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { getCatalog, createCheckout, getPortal } from "@/lib/commerce-client";
export function BillingView() {
  const catalog = useQuery({ queryKey: ["commerce-catalog"], queryFn: getCatalog });
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  async function checkout(sku: string) {
    setErr(null); setBusy(sku);
    try {
      const r = await createCheckout(sku, `${window.location.origin}/billing/return`);
      window.location.href = r.checkout_url;
    } catch (e) { setErr(e instanceof Error ? e.message : "Checkout failed"); } finally { setBusy(null); }
  }
  async function portal() {
    try { const r = await getPortal(); if (r.url) window.location.href = r.url; else setErr("Portal not configured"); } catch (e) { setErr(e instanceof Error ? e.message : "Portal failed"); }
  }
  if (catalog.isLoading) return <Card><div className="p-6 text-sm text-muted">Loading plans…</div></Card>;
  if (catalog.isError) return <Card><div className="p-6 text-sm text-danger">Failed to load catalog</div></Card>;
  return (
    <div className="space-y-4">
      {err && <div role="alert" className="rounded-lg bg-danger/10 p-3 text-sm text-danger">{err}</div>}
      <div className="grid gap-4 md:grid-cols-3">
        {(catalog.data?.items ?? []).map(item => (
          <Card key={item.sku} className="p-5">
            <h3 className="font-medium">{item.sku}</h3>
            <p className="mt-1 text-sm text-muted">{(item.amount_cents/100).toFixed(2)} {item.currency.toUpperCase()} · {Math.round(item.credits_seconds/60)} min</p>
            <Button className="mt-3 w-full" disabled={busy===item.sku} onClick={() => checkout(item.sku)}>{busy===item.sku ? "Redirecting…" : "Checkout"}</Button>
          </Card>
        ))}
      </div>
      <Card><CardHeader title="Manage billing" /><div className="p-5"><Button variant="secondary" onClick={portal}>Open billing portal</Button></div></Card>
    </div>
  );
}
