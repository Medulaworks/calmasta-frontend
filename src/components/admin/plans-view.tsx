"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ToastStack, useToasts } from "@/components/ui/toast";
import { type Json, adminPatch, adminPost } from "@/lib/admin-client";
import type { AdminPack, AdminPlan, PlanList } from "@/lib/admin-types";
import { formatMinutes } from "@/lib/status";
import { BillingPlans } from "./billing-plans";
import { PlanCard } from "./plan-card";
import { PlanEditor } from "./plan-editor";
import { MenuTd, RowMenu } from "./row-menu";
import { AdminUnavailable, DataTable, ResourceBoundary, SimpleDialog, Td, Th, inputClass, useResource } from "./ui";

type Plan = Json<AdminPlan>;
type Pack = Json<AdminPack>;

const field = `mt-2 ${inputClass}`;
const httpsOk = (t: string) => { if (!t.trim()) return true; try { return new URL(t.trim()).protocol === "https:"; } catch { return false; } };

/** The three plans, the yearly discount, and the extra-hours packs: the same things the app's Plan page shows. */
export function PlansView() {
  const res = useResource<Json<PlanList>>("/api/admin/plans");
  const toasts = useToasts("plans-admin");
  const [editing, setEditing] = useState<Plan | null>(null);
  const [discount, setDiscount] = useState(false);
  const [pack, setPack] = useState<Pack | "new" | null>(null);
  const [deleting, setDeleting] = useState<Pack | null>(null);
  const done = (message: string) => { toasts.push({ tone: "success", message }); res.reload(); };

  return (
    <ResourceBoundary resource={res}>
      {(data: Json<PlanList> & { available?: boolean; reason?: string; items?: unknown[] }) => {
        if ((data as { available?: boolean }).available === false) {
          return <div className="space-y-10"><BillingPlans /><AdminUnavailable title="Legacy store plans aren’t available yet"><p className="text-sm text-muted">Dynamic plan config above works without WooCommerce.</p></AdminUnavailable></div>;
        }
        const { plans, packs, annualDiscountPct, enterpriseUrl } = data as Json<PlanList>;
        return (
        <div className="space-y-10">
          <BillingPlans />
          <ul className="grid gap-5 md:grid-cols-3">
            {plans.map((p) => <li key={p.id}><PlanCard plan={p} discountPct={annualDiscountPct} onOpen={() => setEditing(p)} /></li>)}
          </ul>

          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3 p-5 text-sm">
              <div>
                <p className="font-medium">Yearly billing: {annualDiscountPct > 0 ? `${annualDiscountPct}% off` : "no discount"}</p>
                <p className="mt-1 text-muted">{enterpriseUrl ? "Custom terms link is set." : "No custom terms link."}</p>
              </div>
              <Button onClick={() => setDiscount(true)}>Edit</Button>
            </div>
          </Card>

          <section aria-labelledby="packs" className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="packs" className="text-sm font-semibold">Extra hours</h2>
              <Button onClick={() => setPack("new")}><Plus aria-hidden className="size-4" /> Add pack</Button>
            </div>
            {packs.length === 0 ? (
              <Card><EmptyState title="No packs yet" body="People can’t buy extra hours until you add one." /></Card>
            ) : (
              <DataTable label="Extra-hours packs">
                <thead><tr><Th>Pack</Th><Th>Size</Th><Th>Checkout</Th><Th><span className="sr-only">Actions</span></Th></tr></thead>
                <tbody>
                  {packs.map((k) => (
                    <tr key={k.sku}>
                      <Td className="font-medium">{k.label}</Td>
                      <Td className="text-muted">{formatMinutes(k.minutes)}</Td>
                      <Td>{k.checkoutUrl ? <Badge tone="success">Connected</Badge> : <Badge tone="warning">Not connected</Badge>}</Td>
                      <MenuTd><RowMenu label={`Actions for ${k.label}`} items={[{ label: "Edit pack…", onSelect: () => setPack(k) }, { label: "Delete pack…", onSelect: () => setDeleting(k), danger: true, divider: true }]} /></MenuTd>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            )}
          </section>

          {editing && <PlanEditor plan={editing} discountPct={annualDiscountPct} onClose={() => setEditing(null)} onSaved={done} />}
          {discount && <DiscountDialog pct={annualDiscountPct} url={enterpriseUrl} onClose={() => setDiscount(false)} onSaved={() => done("Saved.")} />}
          {pack && <PackDialog pack={pack === "new" ? null : pack} onClose={() => setPack(null)} onSaved={done} />}
          {deleting && (
            <SimpleDialog danger title={`Delete ${deleting.label}?`} description="Hours already bought stay." confirmLabel="Delete pack" busyLabel="Deleting…" onClose={() => setDeleting(null)}
              onSubmit={async () => { await adminPost(`/api/admin/plans/packs/${deleting.sku}/delete`, {}); done(`${deleting.label} deleted.`); }} />
          )}
          <ToastStack items={toasts.items} onDismiss={toasts.dismiss} />
        </div>
        );
      }}
    </ResourceBoundary>
  );
}

function DiscountDialog({ pct, url, onClose, onSaved }: { pct: number; url: string | null; onClose: () => void; onSaved: () => void }) {
  const [p, setP] = useState(String(pct));
  const [u, setU] = useState(url ?? "");
  const n = /^\d+$/.test(p.trim()) ? Number(p) : NaN;
  const valid = n >= 0 && n <= 90 && httpsOk(u);
  return (
    <SimpleDialog title="Yearly billing" confirmLabel="Save" busyLabel="Saving…" canSubmit={valid} onClose={onClose}
      onSubmit={async () => { await adminPatch("/api/admin/plans/pricing", { annualDiscountPct: n, enterpriseUrl: u.trim() || null }); onSaved(); }}>
      <label className="block text-sm"><span className="font-medium">Yearly discount (%)</span>
        <input value={p} onChange={(e) => setP(e.target.value)} inputMode="numeric" aria-invalid={Number.isNaN(n) || n > 90} className={field} />
        <span className="mt-1 block text-xs text-muted">Applies to Pro and Business.</span>
      </label>
      <label className="block text-sm"><span className="font-medium">Custom terms link <span className="font-normal text-muted">(optional)</span></span>
        <input value={u} onChange={(e) => setU(e.target.value)} inputMode="url" placeholder="https://" aria-invalid={!httpsOk(u)} className={field} />
        {!httpsOk(u) && <span role="alert" className="mt-1 block text-xs text-danger">Use a link that starts with https://</span>}
      </label>
    </SimpleDialog>
  );
}

function PackDialog({ pack, onClose, onSaved }: { pack: Pack | null; onClose: () => void; onSaved: (message: string) => void }) {
  const [label, setLabel] = useState(pack?.label ?? "");
  const [minutes, setMinutes] = useState(pack ? String(pack.minutes) : "");
  const [url, setUrl] = useState(pack?.checkoutUrl ?? "");
  const m = /^\d+$/.test(minutes.trim()) ? Number(minutes) : NaN;
  return (
    <SimpleDialog title={pack ? `Edit ${pack.label}` : "Add a pack"} confirmLabel={pack ? "Save" : "Add pack"} busyLabel="Saving…" canSubmit={!!label.trim() && m >= 1 && httpsOk(url)} onClose={onClose}
      onSubmit={async () => {
        const body = { label: label.trim(), minutes: m, checkoutUrl: url.trim() || null };
        if (pack) await adminPatch(`/api/admin/plans/packs/${pack.sku}`, body); else await adminPost("/api/admin/plans/packs", body);
        onSaved(pack ? "Pack saved." : `${label.trim()} added.`);
      }}>
      <label className="block text-sm"><span className="font-medium">Name</span><input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={40} placeholder="5 hours" className={field} /></label>
      <label className="block text-sm"><span className="font-medium">Minutes in the pack</span><input value={minutes} onChange={(e) => setMinutes(e.target.value)} inputMode="numeric" placeholder="300" className={field} /></label>
      <label className="block text-sm"><span className="font-medium">Checkout link <span className="font-normal text-muted">(optional)</span></span>
        <input value={url} onChange={(e) => setUrl(e.target.value)} inputMode="url" placeholder="https://" aria-invalid={!httpsOk(url)} className={field} />
        {!httpsOk(url) && <span role="alert" className="mt-1 block text-xs text-danger">Use a link that starts with https://</span>}
      </label>
    </SimpleDialog>
  );
}
