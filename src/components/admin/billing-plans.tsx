"use client";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loading, Skeleton, SkeletonPanel } from "@/components/ui/skeleton";
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
  const [historyLoading, setHistoryLoading] = useState<string | null>(null);
  const [promoForm, setPromoForm] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="space-y-8">
      <section aria-labelledby="dyn-plans" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 id="dyn-plans" className="text-sm font-semibold">Plan configuration (live, versioned)</h2><Button onClick={() => setEdit("new")}>New plan</Button></div>
        {msg && <p role="status" className="text-sm">{msg}</p>}
        {plans.loading && (
          <Loading label="Loading plans" className="grid items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <SkeletonPanel key={i} className="h-64 p-5">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="mt-4 h-9 w-1/2" />
                <Skeleton className="mt-3 h-3 w-full" />
                <div className="mt-4 space-y-2"><Skeleton className="h-3 w-full" /><Skeleton className="h-3 w-5/6" /><Skeleton className="h-3 w-4/6" /></div>
                <div className="mt-5 flex gap-2"><Skeleton className="h-8 flex-1 rounded-xl" /><Skeleton className="h-8 flex-1 rounded-xl" /><Skeleton className="h-8 flex-1 rounded-xl" /></div>
              </SkeletonPanel>
            ))}
          </Loading>
        )}
        {plans.error && <p role="alert" className="text-sm text-danger">Couldn’t load plans (admin only). {plans.error.message}</p>}
        <div className="grid items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {plans.data?.plans.map((p) => (
            <Card key={p.id} className="h-full min-w-0 overflow-hidden">
              <div className="flex h-full flex-col p-5 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="min-w-0 flex-1 truncate text-base font-semibold">{p.name}</h3>
                  <span className="rounded-full bg-surface px-2 py-0.5 text-xs font-medium text-muted ring-1 ring-border">v{p.version}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${p.status === "active" ? "bg-success/10 text-success ring-success/30" : "bg-surface text-muted ring-border"}`}>{p.status}</span>
                </div>
                <p className="mt-4 text-3xl font-semibold tracking-tight tabular-nums">{p.priceCents === 0 ? "Free" : money(p.priceCents, p.currency)}<span className="ml-1 text-sm font-normal text-muted">/ {p.billingCycle}</span></p>
                <p className="mt-2 min-h-10 text-muted">{p.description || "—"}</p>
                <dl className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
                  <div className="flex items-center justify-between gap-3"><dt className="text-muted">Minutes</dt><dd className="font-medium tabular-nums">{p.minutesAllowance.toLocaleString()} / period</dd></div>
                  <div className="flex items-center justify-between gap-3"><dt className="text-muted">Trial</dt><dd className="font-medium tabular-nums">{p.trialDays} days</dd></div>
                  <div className="flex items-center justify-between gap-3"><dt className="text-muted">Rollover</dt><dd className="font-medium">{p.rollover ? "Yes" : "No"}</dd></div>
                  <div className="flex items-center justify-between gap-3"><dt className="text-muted">Active users</dt><dd className="font-medium tabular-nums">{p.activeUsers}</dd></div>
                </dl>
                <p className="mt-3 text-xs leading-relaxed text-muted">Updated {fmtUtc(p.updatedAt)}. Existing users keep their snapshot; edits apply only to future assignments.</p>
                <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-border pt-4">
                  <Button size="sm" variant="secondary" className="min-w-0 flex-1" onClick={() => setEdit(p)}>Edit</Button>
                  <Button size="sm" variant="ghost" className="min-w-0 flex-1" disabled={historyLoading === p.id} aria-busy={historyLoading === p.id} onClick={async () => { setHistoryLoading(p.id); try { setHistory({ planId: p.id, items: (await adminGet<{ items: never[] }>(`/api/admin/billing/plans/${p.id}/history`)).items }); } finally { setHistoryLoading(null); } }}>{historyLoading === p.id ? <span className="inline-flex items-center gap-2"><Loader2 aria-hidden className="size-4 animate-spin" />Loading…</span> : "History"}</Button>
                  {p.status === "active" && <Button size="sm" variant="ghost" className="min-w-0 flex-1" onClick={async () => { await adminPost(`/api/admin/billing/plans/${p.id}/archive`, { reason: "Archived in admin" }); setMsg(`${p.name} archived.`); plans.reload(); }}>Archive</Button>}
                </div>
              </div>
            </Card>
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
