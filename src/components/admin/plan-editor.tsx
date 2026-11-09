"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { type Json, adminPatch } from "@/lib/admin-client";
import { centsToInput, toCents } from "@/lib/admin-money";
import type { AdminPlan } from "@/lib/admin-types";
import { PlanCard } from "./plan-card";

type Plan = Json<AdminPlan>;
const input = "mt-2 block h-10 w-full rounded-lg border border-border bg-background px-3 text-sm tabular-nums outline-none transition focus:border-accent focus:ring-4 focus:ring-accent-solid/15 disabled:opacity-60";
const label = "text-sm font-medium";

const hours = (minutes: number) => String(Math.round((minutes / 60) * 100) / 100);
const toMinutes = (text: string) => {
  const n = Number(text.trim());
  return text.trim() !== "" && Number.isFinite(n) && n >= 0 && n <= 16_000 ? Math.round(n * 60) : null;
};
const okUrl = (t: string) => {
  if (!t.trim()) return true;
  try { return new URL(t.trim()).protocol === "https:"; } catch { return false; }
};

/**
 * Edit one of the three plans. The form is on the left and the card people see is on the right, updating as you type.
 * Errors show once you press Save. A plan that has subscribers says what a price change will and won't do first.
 */
export function PlanEditor({ plan, discountPct, onClose, onSaved }: { plan: Plan; discountPct: number; onClose: () => void; onSaved: (message: string) => void }) {
  const id = useId();
  const free = plan.id === "free";
  const [f, setF] = useState({ tagline: plan.tagline, monthly: centsToInput(plan.monthlyCents), hours: hours(plan.allowanceMinutes), monthlyUrl: plan.checkoutMonthlyUrl ?? "", yearlyUrl: plan.checkoutYearlyUrl ?? "" });
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const first = useRef<HTMLInputElement>(null);
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));

  useEffect(() => {
    first.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  const monthly = toCents(f.monthly);
  const minutes = toMinutes(f.hours);
  const errors: Record<string, string> = {};
  if (monthly === null) errors.monthly = "Enter a price, like 19 or 19.99.";
  else if (!free && monthly === 0) errors.monthly = "A paid plan needs a price above $0.";
  if (minutes === null) errors.hours = "Enter the hours each month, like 10.";
  if (f.tagline.length > 100) errors.tagline = "Keep it under 100 characters.";
  if (!okUrl(f.monthlyUrl)) errors.monthlyUrl = "Use a link that starts with https://";
  if (!okUrl(f.yearlyUrl)) errors.yearlyUrl = "Use a link that starts with https://";
  const priceChanged = monthly !== null && monthly !== plan.monthlyCents;

  async function save() {
    setTried(true);
    if (Object.keys(errors).length > 0) return;
    setBusy(true);
    setError(null);
    try {
      await adminPatch(`/api/admin/plans/${plan.id}`, { tagline: f.tagline.trim(), monthlyCents: monthly, allowanceMinutes: minutes, ...(free ? {} : { checkoutMonthlyUrl: f.monthlyUrl.trim() || null, checkoutYearlyUrl: f.yearlyUrl.trim() || null }) });
      onSaved(`${plan.name} saved.`);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save. Try again.");
      setBusy(false);
    }
  }

  const err = (k: string) => (tried && errors[k] ? <span role="alert" className="mt-1 block text-xs text-danger">{errors[k]}</span> : null);
  const preview = { name: plan.name, tagline: f.tagline.trim(), monthlyCents: monthly ?? 0, allowanceMinutes: minutes ?? 0, checkoutMonthlyUrl: f.monthlyUrl.trim() || null, checkoutYearlyUrl: f.yearlyUrl.trim() || null, subscribers: plan.subscribers };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-3 sm:p-5" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <form role="dialog" aria-modal="true" aria-labelledby={`${id}-t`} noValidate onSubmit={(e) => { e.preventDefault(); void save(); }} className="flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl">
        <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
          <h2 id={`${id}-t`} className="text-base font-semibold">Edit {plan.name}</h2>
          <button type="button" aria-label="Close" onClick={onClose} disabled={busy} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-surface hover:text-foreground"><X aria-hidden className="size-4" /></button>
        </header>

        <div className="grid min-h-0 flex-1 overflow-y-auto md:grid-cols-[1fr_17rem]">
          <div className="space-y-5 p-5">
            <label className="block"><span className={label}>Description</span>
              <input ref={first} value={f.tagline} onChange={(e) => set("tagline", e.target.value)} maxLength={100} className={`${input}`} />{err("tagline")}
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block"><span className={label}>Price per month</span>
                <span className="relative block"><span aria-hidden className="pointer-events-none absolute inset-y-0 left-3 grid place-items-center text-sm text-muted">$</span>
                  <input value={f.monthly} onChange={(e) => set("monthly", e.target.value)} inputMode="decimal" disabled={free} className={`${input} pl-7`} /></span>
                {err("monthly")}
              </label>
              <label className="block"><span className={label}>Hours each month</span>
                <input value={f.hours} onChange={(e) => set("hours", e.target.value)} inputMode="decimal" className={input} />{err("hours")}
              </label>
            </div>
            {plan.subscribers > 0 && priceChanged && (
              <p role="note" className="rounded-lg border border-accent/30 bg-accent/10 px-4 py-3 text-sm">
                <b className="font-medium">Existing subscribers keep their current price.</b>
              </p>
            )}
            {!free && (
              <>
                <label className="block"><span className={label}>Monthly checkout link</span>
                  <input value={f.monthlyUrl} onChange={(e) => set("monthlyUrl", e.target.value)} inputMode="url" placeholder="https://" className={input} />{err("monthlyUrl")}
                </label>
                <label className="block"><span className={label}>Yearly checkout link</span>
                  <input value={f.yearlyUrl} onChange={(e) => set("yearlyUrl", e.target.value)} inputMode="url" placeholder="https://" className={input} />{err("yearlyUrl")}
                </label>
              </>
            )}
          </div>
          <aside aria-label="Preview" className="hidden border-l border-border bg-surface/40 p-5 md:block">
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted">Preview</p>
            <PlanCard plan={preview} discountPct={discountPct} preview />
          </aside>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3">
          <p role="alert" className="min-h-5 text-sm text-danger">{error ?? (tried && Object.keys(errors).length > 0 ? "Fix the marked fields." : "")}</p>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
          </div>
        </footer>
      </form>
    </div>
  );
}
