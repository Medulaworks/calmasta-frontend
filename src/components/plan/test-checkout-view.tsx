"use client";

import { FlaskConical } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { type PlanSummary, fetchPlan } from "@/lib/plan-client";
import { PLAN_LABEL } from "@/lib/plan-types";
import { annualPrice, formatPrice } from "@/lib/pricing";
import { formatMinutes } from "@/lib/status";
import { api } from "@/lib/upload-client";

/** Development only. Shows what is being "bought", then sends the same signed webhook a paid store order would. */
export function TestCheckoutView() {
  const router = useRouter();
  const q = useSearchParams();
  const [plan, setPlan] = useState<PlanSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetchPlan().then((p) => !cancelled && setPlan(p), (e) => !cancelled && setError(e instanceof Error ? e.message : "Could not load your plan."));
    return () => {
      cancelled = true;
    };
  }, []);

  const planParam = q.get("plan");
  const periodParam = q.get("period");
  const pack = q.get("pack");
  const chosen = planParam === "pro" || planParam === "business" ? planParam : null;
  const period = periodParam === "annual" ? "annual" : "monthly";

  let title = "";
  let detail = "";
  let price = "";
  if (plan && chosen) {
    const monthly = chosen === "business" ? plan.pricing.businessMonthly : plan.pricing.proMonthly;
    const per = period === "annual" ? annualPrice(monthly, plan.pricing.annualDiscountPct) : monthly;
    title = `${PLAN_LABEL[chosen]}, ${period === "annual" ? "billed yearly" : "billed monthly"}`;
    detail = `${formatMinutes(chosen === "business" ? plan.businessAllowanceMinutes : plan.proAllowanceMinutes)} of processing each month`;
    price = period === "annual" ? `${formatPrice(plan.pricing.currency, per)} per month, ${formatPrice(plan.pricing.currency, Math.round(per * 12 * 100) / 100)} billed yearly` : `${formatPrice(plan.pricing.currency, per)} per month`;
  } else if (plan && pack) {
    const k = plan.packs.find((x) => x.sku === pack);
    if (k) {
      title = `${k.label} of extra processing`;
      detail = "Used after your monthly allowance. Doesn't reset each month.";
    }
  }

  async function pay() {
    setBusy(true);
    setError(null);
    try {
      await api("/api/dev/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(pack ? { pack } : { plan: chosen, period }) });
      router.push("/plan/confirming");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not complete the test purchase.");
      setBusy(false);
    }
  }

  if (error && !plan) return <p role="alert" className="text-sm text-danger">{error}</p>;
  if (!plan) return <div role="status" aria-label="Loading" className="h-48 max-w-xl animate-pulse rounded-xl border border-border bg-surface" />;
  if (!title) return <p role="alert" className="text-sm text-danger">Nothing to buy here. <ButtonLink href="/plan">Back to plans</ButtonLink></p>;

  return (
    <Card className="max-w-xl">
      <CardHeader title="Order summary" />
      <div className="space-y-4 p-5 text-sm">
        <div>
          <p className="text-base font-medium">{title}</p>
          <p className="mt-0.5 text-muted">{detail}</p>
          {price && <p className="mt-2 tabular-nums">{price}</p>}
        </div>
        <p className="flex gap-2 rounded-lg border border-border bg-surface px-4 py-3 text-xs text-muted">
          <FlaskConical aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
          No money moves. This sends the same signed &ldquo;order completed&rdquo; message the store sends, so your plan changes exactly as it would after a real payment.
        </p>
        {error && <p role="alert" className="text-danger">{error}</p>}
        <div className="flex gap-2">
          <Button variant="primary" onClick={() => void pay()} disabled={busy}>
            {busy ? "Completing…" : "Complete test purchase"}
          </Button>
          <ButtonLink href="/plan" variant="ghost">Cancel</ButtonLink>
        </div>
      </div>
    </Card>
  );
}
