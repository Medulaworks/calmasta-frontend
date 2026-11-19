"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { adminGet, adminPatch, adminPost, fmtUtc } from "@/lib/admin-client";
import { SimpleDialog, inputClass } from "./ui";
import { useResource } from "./ui";

type Plan = { id: string; name: string; description: string; status: string; version: number; priceCents: number; currency: string; billingCycle: string; durationDays: number; minutesAllowance: number; rollover: boolean; features: string[]; trialDays: number; activeUsers: number; updatedAt: string | null };
type Promo = { id: string; code: string; type: string; value: number; applicablePlans: string[]; maxUses: number | null; usedCount: number; expiresAt: string | null; active: boolean };
const money = (c: number, cur = "USD") => `${cur} ${(c / 100).toFixed(2)}`;

/** Dynamic plan config (versioned templates) + promo codes. Editing creates a new version; existing users keep snapshots. No WooCommerce dependency. */
export function BillingPlans() {
  const plans = useResource<{ plans: Plan[] }>("/api/admin/billing/plans");
  const promos = useResource<{ items: Promo[] }>("/api/admin/billing/promo-codes");
  const [edit, setEdit] = useState<Plan | "new" | null>(null);
  const [history, setHistory] = useState<{ planId: string; items: Array<{ version: number; priceCents: number; minutesAllowance: number; createdAt: string }> } | null>(null);
  const [promoForm, setPromoForm] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="space-y-8">
      <section aria-labelledby="dyn-plans" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 id="dyn-plans" className="text-sm font-semibold">Plan configuration (live, versioned)</h2><Button onClick={() => setEdit("new")}>New plan</Button></div>
        {msg && <p role="status" className="text-sm">{msg}</p>}
        {plans.loading && <p className="text-sm text-muted">Loading plans…</p>}
        {plans.error && <p role="alert" className="text-sm text-danger">Couldn’t load plans (admin only). {plans.error.message}</p>}
        <div className="grid gap-4 md:grid-cols-3">
          {plans.data?.plans.map((p) => (
            <Card key={p.id}><div className="space-y-2 p-5 text-sm">
              <p className="font-semibold">{p.name} <span className="font-normal text-muted">v{p.version} · {p.status}</span></p>
              <p className="text-muted">{p.description || "—"}</p>
              <p>{money(p.priceCents, p.currency)} / {p.billingCycle} · {p.minutesAllowance} min · trial {p.trialDays}d · rollover {p.rollover ? "yes" : "no"}</p>
              <p className="text-muted">{p.activeUsers} active users · updated {fmtUtc(p.updatedAt)}</p>
              <p className="text-xs text-muted">Existing users keep their snapshot; edits apply only to future assignments.</p>
              <div className="flex gap-2"><Button variant="secondary" onClick={() => setEdit(p)}>Edit (new version)</Button><Button variant="ghost" onClick={async () => setHistory({ planId: p.id, items: (await adminGet<{ items: never[] }>(`/api/admin/billing/plans/${p.id}/history`)).items })}>History</Button>{p.status === "active" && <Button variant="ghost" onClick={async () => { await adminPost(`/api/admin/billing/plans/${p.id}/archive`, { reason: "Archived in admin" }); setMsg(`${p.name} archived.`); plans.reload(); }}>Archive</Button>}</div>
            </div></Card>
          ))}
        </div>
      </section>
      <section aria-labelledby="promos" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 id="promos" className="text-sm font-semibold">Promo codes</h2><Button onClick={() => setPromoForm(true)}>New promo code</Button></div>
        {promos.data?.items.length === 0 && <p className="text-sm text-muted">No promo codes yet.</p>}
        <ul className="space-y-2">{promos.data?.items.map((p) => <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border px-4 py-3 text-sm"><span><strong>{p.code}</strong> · {p.type} {p.value} · plans {p.applicablePlans.join(", ") || "all"} · used {p.usedCount}/{p.maxUses ?? "∞"} · {p.active ? "active" : "inactive"}{p.expiresAt ? ` · expires ${fmtUtc(p.expiresAt)}` : ""}</span><Button variant="ghost" onClick={async () => { await adminPatch(`/api/admin/billing/promo-codes/${p.id}`, { active: !p.active }); promos.reload(); }}>{p.active ? "Deactivate" : "Activate"}</Button></li>)}</ul>
      </section>
      {edit && <PlanForm plan={edit === "new" ? null : edit} onClose={() => setEdit(null)} onSaved={(m) => { setMsg(m); setEdit(null); plans.reload(); }} />}
      {history && <SimpleDialog title={`Version history — ${history.planId}`} confirmLabel="Close" onClose={() => setHistory(null)} onSubmit={async () => {}}><ul className="space-y-1 text-sm">{history.items.map((h) => <li key={h.version}>v{h.version} · {money(h.priceCents)} · {h.minutesAllowance} min · {fmtUtc(h.createdAt)}</li>)}</ul></SimpleDialog>}
      {promoForm && <PromoForm onClose={() => setPromoForm(false)} onSaved={(m) => { setMsg(m); setPromoForm(false); promos.reload(); }} />}
    </div>
  );
}
function PlanForm({ plan, onClose, onSaved }: { plan: Plan | null; onClose: () => void; onSaved: (m: string) => void }) {
  const [f, setF] = useState({ id: plan?.id ?? "", name: plan?.name ?? "", description: plan?.description ?? "", price: plan ? String(plan.priceCents / 100) : "", minutes: plan ? String(plan.minutesAllowance) : "", trialDays: String(plan?.trialDays ?? 0), confirmRisk: false });
  const priceCents = Math.round(Number(f.price) * 100); const minutes = Number(f.minutes);
  const risky = plan ? (minutes < plan.minutesAllowance || priceCents > plan.priceCents) : false;
  return <SimpleDialog title={plan ? `Edit ${plan.name} (creates v${plan.version + 1})` : "New plan"} confirmLabel="Save new version" busyLabel="Saving…" canSubmit={!!f.name.trim() && Number.isFinite(priceCents) && priceCents >= 0 && Number.isInteger(minutes) && minutes >= 0 && (!risky || f.confirmRisk)} onClose={onClose} onSubmit={async () => {
    const body = { name: f.name.trim(), description: f.description.trim(), priceCents, minutesAllowance: minutes, trialDays: Number(f.trialDays) || 0, confirmRisk: f.confirmRisk };
    if (plan) await adminPatch(`/api/admin/billing/plans/${plan.id}`, body); else await adminPost("/api/admin/billing/plans", { ...body, id: f.id.trim().toLowerCase() });
    onSaved(plan ? `${f.name} saved as new version. Existing users unchanged.` : `${f.name} created.`);
  }}>
    {!plan && <label className="block text-sm"><span className="font-medium">Plan ID (slug)</span><input value={f.id} onChange={(e) => setF({ ...f, id: e.target.value })} className={inputClass} placeholder="team" /></label>}
    <label className="block text-sm"><span className="font-medium">Name</span><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className={inputClass} /></label>
    <label className="block text-sm"><span className="font-medium">Description</span><input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} className={inputClass} /></label>
    <label className="block text-sm"><span className="font-medium">Price (USD)</span><input value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} inputMode="decimal" className={inputClass} /></label>
    <label className="block text-sm"><span className="font-medium">Minutes allowance / period</span><input value={f.minutes} onChange={(e) => setF({ ...f, minutes: e.target.value })} inputMode="numeric" className={inputClass} /></label>
    <label className="block text-sm"><span className="font-medium">Trial days</span><input value={f.trialDays} onChange={(e) => setF({ ...f, trialDays: e.target.value })} inputMode="numeric" className={inputClass} /></label>
    {risky && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.confirmRisk} onChange={(e) => setF({ ...f, confirmRisk: e.target.checked })} /> This lowers minutes or raises price — apply to future assignments only. Confirm.</label>}
  </SimpleDialog>;
}
function PromoForm({ onClose, onSaved }: { onClose: () => void; onSaved: (m: string) => void }) {
  const [f, setF] = useState({ code: "", type: "percent", value: "", plans: "", maxUses: "", expiresAt: "" });
  return <SimpleDialog title="New promo code" confirmLabel="Create code" busyLabel="Creating…" canSubmit={f.code.trim().length >= 3 && !!f.value} onClose={onClose} onSubmit={async () => {
    await adminPost("/api/admin/billing/promo-codes", { code: f.code.trim().toUpperCase(), type: f.type, value: Number(f.value), applicablePlans: f.plans.split(",").map((s) => s.trim()).filter(Boolean), maxUses: f.maxUses ? Number(f.maxUses) : undefined, expiresAt: f.expiresAt || undefined });
    onSaved(`Promo ${f.code.toUpperCase()} created.`);
  }}>
    <label className="block text-sm"><span className="font-medium">Code</span><input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} className={inputClass} /></label>
    <label className="block text-sm"><span className="font-medium">Type</span><select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })} className={inputClass}><option value="percent">Percent discount</option><option value="fixed">Fixed amount (cents)</option><option value="free_period">Free period (days)</option></select></label>
    <label className="block text-sm"><span className="font-medium">Value (percent 1–100, fixed in cents, free period in days)</span><input value={f.value} onChange={(e) => setF({ ...f, value: e.target.value })} inputMode="decimal" className={inputClass} /></label>
    <label className="block text-sm"><span className="font-medium">Applicable plans (comma slugs, empty = all)</span><input value={f.plans} onChange={(e) => setF({ ...f, plans: e.target.value })} className={inputClass} placeholder="pro,business" /></label>
    <label className="block text-sm"><span className="font-medium">Max uses (optional)</span><input value={f.maxUses} onChange={(e) => setF({ ...f, maxUses: e.target.value })} inputMode="numeric" className={inputClass} /></label>
    <label className="block text-sm"><span className="font-medium">Expires at (optional ISO)</span><input value={f.expiresAt} onChange={(e) => setF({ ...f, expiresAt: e.target.value })} className={inputClass} placeholder="2027-01-01T00:00:00Z" /></label>
    <p className="text-xs text-muted">One promo per plan change. No stacking.</p>
  </SimpleDialog>;
}
