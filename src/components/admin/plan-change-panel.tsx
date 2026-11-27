"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { adminPost, fmtUtc } from "@/lib/admin-client";
import { capability } from "@/lib/admin-capabilities";
import { ToastStack, useToasts } from "@/components/ui/toast";
import { SimpleDialog, inputClass } from "./ui";
import { useResource } from "./ui";

type Plan = { id: string; name: string; version: number; priceCents: number; currency: string; minutesAllowance: number; status: string };
type Sub = { plan_id: string; plan_version: number; price_at_assignment: number; currency_at_assignment: string; minutes_allowance_at_assignment: number; status: string; period_start: string; period_end: string | null; scheduled_plan_id: string | null; scheduled_effective_at: string | null; pending_promo_code: string | null } | null;
type Data = { workspaceId: string; subscription: Sub; usage: { used_seconds: number; limit_seconds: number } | null; plans: Plan[] };

const money = (c: number, cur = "USD") => `${cur} ${(c / 100).toFixed(2)}`;

/** Change a customer's plan (Plan and minutes tab). Upgrades immediate; downgrades scheduled at period end. Values are the locked snapshot. */
export function PlanChangePanel({ customerId, onDone }: { customerId: string; onDone?: (m: string) => void }) {
  const toasts = useToasts(`plan-change-${customerId}`);
  const canChange = capability("user_suspend").allowed;
  const res = useResource<Data>(`/api/admin/billing/customers/${customerId}/plan`);
  const [target, setTarget] = useState("");
  const [promo, setPromo] = useState("");
  const [reason, setReason] = useState("");
  const [preview, setPreview] = useState<{ discountCents: number; finalPriceCents: number; originalPriceCents: number } | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (res.loading) return <Card><p className="p-5 text-sm text-muted">Loading plan…</p></Card>;
  if (res.error || !res.data) return <Card><p role="alert" className="p-5 text-sm text-danger">Couldn’t load plan. Non-admins get 403. {res.error?.message}</p></Card>;
  const d = res.data; const sub = d.subscription; const plans = d.plans.filter((p) => p.status === "active");
  const currentId = sub?.plan_id ?? "free";
  const selected = plans.find((p) => p.id === target);
  const usedMin = d.usage ? Math.round(d.usage.used_seconds / 60) : 0;
  const loseWarning = selected && selected.minutesAllowance < usedMin ? `Warning: ${usedMin} minutes already used exceeds the new ${selected.minutesAllowance} limit — remaining becomes 0, never negative.` : null;

  async function validatePromo() {
    setPromoError(null); setPreview(null);
    if (!promo.trim() || !target) return;
    try {
      const p = await adminPost<{ discountCents: number; finalPriceCents: number; originalPriceCents: number }>(`/api/admin/billing/customers/${customerId}/plan/validate-promo`, { planId: target, code: promo.trim() });
      setPreview(p);
      toasts.push({ tone: "success", message: `Promo applied: ${money(p.originalPriceCents)} → ${money(p.finalPriceCents)}.` });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Invalid promo code.";
      setPromoError(msg);
      toasts.push({ tone: "danger", message: msg });
    }
  }
  return (
    <Card>
      <CardHeader title="Change plan" />
      <div className="space-y-4 p-5 text-sm">
        <p>Current: <strong className="capitalize">{currentId}</strong>{sub ? <> · v{sub.plan_version} (locked to this version until plan change) · {money(Number(sub.price_at_assignment), sub.currency_at_assignment)} · {sub.minutes_allowance_at_assignment} min/period · {sub.status}</> : null}</p>
        <p className="text-muted">Period: {sub ? `${fmtUtc(sub.period_start)} → ${fmtUtc(sub.period_end)}` : "—"} · Used: {usedMin} min</p>
        {!canChange && <p className="text-xs text-muted">View-only access: you can review this plan and usage, but can’t change the customer’s plan.</p>}
        {canChange && <>
        {sub?.scheduled_plan_id && <p role="status" className="rounded-lg border border-border px-3 py-2">Downgrade scheduled: current plan until {fmtUtc(sub.scheduled_effective_at)}, then <strong className="capitalize">{sub.scheduled_plan_id}</strong>. <Button variant="ghost" onClick={async () => { try { await adminPost(`/api/admin/billing/customers/${customerId}/plan/cancel-downgrade`, { reason: "Cancelled by admin" }, { "Idempotency-Key": crypto.randomUUID().replace(/-/g, "").slice(0, 16) }); const msg = "Scheduled downgrade cancelled."; onDone?.(msg); toasts.push({ tone: "success", message: msg }); res.reload(); } catch (e) { const msg = e instanceof Error ? e.message : "Couldn’t cancel the scheduled downgrade."; setError(msg); toasts.push({ tone: "danger", message: msg }); } }}>Cancel scheduled downgrade</Button></p>}
        <label className="block"><span className="font-medium">New plan</span><select aria-label="New plan" value={target} onChange={(e) => { setTarget(e.target.value); setPreview(null); }} className={inputClass}><option value="">Select plan…</option>{plans.map((p) => <option key={p.id} value={p.id}>{p.name} — {money(p.priceCents, p.currency)} · {p.minutesAllowance} min · v{p.version}</option>)}</select></label>
        <label className="block"><span className="font-medium">Promo code (optional, one only)</span><span className="mt-2 flex gap-2"><input value={promo} onChange={(e) => setPromo(e.target.value.toUpperCase())} className={inputClass} placeholder="CODE" /><Button type="button" variant="secondary" onClick={() => void validatePromo()}>Validate</Button></span></label>
        {promoError && <p role="alert" className="text-danger">{promoError}</p>}
        {preview && <p role="status">Discount {money(preview.discountCents)} · {money(preview.originalPriceCents)} → <strong>{money(preview.finalPriceCents)}</strong></p>}
        <label className="block"><span className="font-medium">Admin note / reason (required)</span><textarea value={reason} onChange={(e) => setReason(e.target.value)} className={inputClass} maxLength={500} /></label>
        {loseWarning && <p role="alert" className="text-danger">{loseWarning}</p>}
        {error && <p role="alert" className="text-danger">{error}</p>}
        <Button disabled={!target || !reason.trim()} onClick={() => setConfirm(true)}>Review change…</Button>
        </>}
      </div>
      {confirm && selected && (
        <SimpleDialog title="Confirm plan change" confirmLabel="Confirm change" busyLabel="Applying…" canSubmit={!!reason.trim()} onClose={() => setConfirm(false)} onSubmit={async () => {
          try {
            const r = await adminPost<{ effective: string; effectiveAt: string }>(`/api/admin/billing/customers/${customerId}/plan/change`, { newPlanId: target, promoCode: promo.trim() || undefined, reason: reason.trim() }, { "Idempotency-Key": crypto.randomUUID().replace(/-/g, "").slice(0, 16) });
            const msg = r.effective === "scheduled" ? `Downgrade scheduled for ${fmtUtc(r.effectiveAt)}.` : `Plan changed to ${selected.name}.`;
            onDone?.(msg);
            toasts.push({ tone: "success", message: msg });
            res.reload();
          } catch (e) {
            const msg = e instanceof Error ? e.message : "Couldn\u2019t change the plan.";
            setError(msg);
            toasts.push({ tone: "danger", message: msg });
            throw e;
          }
        }}>
          <p>{currentId} → <strong className="capitalize">{selected.name}</strong> (latest v{selected.version})</p>
          <p>Minutes: {sub?.minutes_allowance_at_assignment ?? "—"} → {selected.minutesAllowance} · Price: {money(selected.priceCents, selected.currency)}{preview ? ` → ${money(preview.finalPriceCents)} after promo` : ""}</p>
          <p>{selected.id === "free" || plans.find((p) => p.id === selected.id)!.id < currentId ? "" : ""}Upgrades apply immediately (used minutes kept). Downgrades take effect at period end{loseWarning ? ` — ${loseWarning}` : ""}.</p>
          <p className="text-muted">Reason: {reason}</p>
        </SimpleDialog>
      )}
      <ToastStack items={toasts.items} onDismiss={toasts.dismiss} />
    </Card>
  );
}
