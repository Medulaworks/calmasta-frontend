"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ToastStack, useToasts } from "@/components/ui/toast";
import { type Json, adminPost, fmtUtc } from "@/lib/admin-client";
import { formatMinutes } from "@/lib/status";
import type { UsageReport } from "@/lib/admin-types";
import { ClickRow, MenuTd, RowMenu, RowOpen } from "./row-menu";
import { ActionDialog, DataTable, Metric, Notice, ResourceBoundary, Td, Th, useResource } from "./ui";

const usd = (n: number | null) => (n === null ? "unknown" : `$${n.toFixed(2)}`);

export function UsageView() {
  const res = useResource<Json<UsageReport>>("/api/admin/usage");
  const [dialog, setDialog] = useState<"pause" | "resume" | null>(null);
  const toasts = useToasts("usage");

  return (
    <ResourceBoundary resource={res}>
      {(r) => (
        <div className="space-y-6">
          {r.paused.paused && (
            <Notice tone="danger">
              New work is <strong>paused</strong> for everyone{r.paused.by ? ` (by ${r.paused.by}, ${fmtUtc(r.paused.at)})` : ""}. {r.paused.reason && <>Reason: {r.paused.reason}.</>} 
            </Notice>
          )}
          {r.month.overGuard && <Notice tone="warning">Spend passed the alert level this month.</Notice>}
          {!r.month.costKnown && <Notice>Prices aren&rsquo;t set. Showing minutes only.</Notice>}

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Metric label="Minutes this month" value={r.month.minutes.toLocaleString("en")} />
            <Metric label="Estimated cost" value={usd(r.month.costUsd)} tone={r.month.overTarget ? "warning" : undefined} />
            <Metric label="Monthly target" value={r.month.targetUsd === null ? "Not set" : usd(r.month.targetUsd)} hint={r.month.overTarget ? "Over target" : undefined} />
            <Metric label="Alert level" value={r.month.guardUsd === null ? "Not set" : usd(r.month.guardUsd)} hint="Only a warning" />
          </div>

          <Card>
            <CardHeader title="Pause everything" />
            <div className="flex flex-wrap items-center justify-between gap-3 p-5 text-sm">
              <p className="max-w-xl text-muted">Stops new uploads and meeting recordings for everyone.</p>
              {r.paused.paused ? <Button variant="primary" onClick={() => setDialog("resume")}>Resume…</Button> : <Button variant="danger" onClick={() => setDialog("pause")}>Pause new work…</Button>}
            </div>
          </Card>

          <section aria-labelledby="top" className="space-y-3">
            <h2 id="top" className="text-sm font-semibold">Heaviest users this month</h2>
            {r.topCustomers.length === 0 ? (
              <Card><EmptyState title="No usage yet this month" /></Card>
            ) : (
              <DataTable label="Heaviest users this month" narrow>
                <thead><tr><Th>User</Th><Th>Minutes</Th><Th><span className="sr-only">Actions</span></Th></tr></thead>
                <tbody>
                  {r.topCustomers.map((t) => {
                    const href = `/dashboard/admin/customers/${t.userId}`;
                    return (
                      <ClickRow key={t.userId} href={href}>
                        <Td><RowOpen href={href}>{t.email}</RowOpen></Td>
                        <Td className="tabular-nums">{formatMinutes(t.minutes)}</Td>
                        <MenuTd><RowMenu label={`Actions for ${t.email}`} items={[{ label: "Open account", href }]} /></MenuTd>
                      </ClickRow>
                    );
                  })}
                </tbody>
              </DataTable>
            )}
          </section>

          <Card>
            <details className="group">
              <summary className="cursor-pointer list-none px-5 py-4 text-sm font-medium marker:hidden [&::-webkit-details-marker]:hidden">
                Day by day, last 30 days <span className="ml-1 text-xs font-normal text-muted group-open:hidden">Show</span><span className="ml-1 hidden text-xs font-normal text-muted group-open:inline">Hide</span>
              </summary>
              <div className="border-t border-border p-5">
                <DataTable label="Usage by day" narrow>
                  <thead><tr><Th>Day (UTC)</Th><Th>Type</Th><Th>Minutes</Th><Th>Cost</Th></tr></thead>
                  <tbody>
                    {r.days.length === 0 && <tr><Td className="text-muted">No usage in the last 30 days.</Td><Td /><Td /><Td /></tr>}
                    {r.days.map((d) => <tr key={`${d.day}-${d.operation}`}><Td>{d.day}</Td><Td className="capitalize">{d.operation.replace("_", " ")}</Td><Td className="tabular-nums">{d.minutes}</Td><Td>{usd(d.costUsd)}</Td></tr>)}
                  </tbody>
                </DataTable>
              </div>
            </details>
          </Card>

          {dialog && (
            <ActionDialog
              danger={dialog === "pause"}
              title={dialog === "pause" ? "Pause new work for everyone?" : "Resume new work?"}
              description={dialog === "pause" ? "Nobody can start new work until you resume." : "Everyone can start new work again."}
              confirmLabel={dialog === "pause" ? "Pause" : "Resume"}
              onClose={() => setDialog(null)}
              onSubmit={async (v) => {
                await adminPost("/api/admin/controls/processing", { paused: dialog === "pause", reason: v.reason });
                toasts.push({ tone: "success", message: dialog === "pause" ? "New work is paused." : "New work has resumed." });
                res.reload();
              }}
            />
          )}
          <ToastStack items={toasts.items} onDismiss={toasts.dismiss} />
        </div>
      )}
    </ResourceBoundary>
  );
}
