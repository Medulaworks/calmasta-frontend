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

type NewUsage = { period: string; timezone: "UTC"; items: Array<{ id: string; plan: string; period: string; usedSeconds: number; reservedSeconds: number }>; nextCursor: string | null; costBasis: string; spend: Array<{ day: string; reservedCostMicros: number; settledCostMicros: number }> };

export function UsageView() {
  const res = useResource<Json<UsageReport> & NewUsage>("/api/admin/usage");
  const [dialog, setDialog] = useState<"pause" | "resume" | null>(null);
  const toasts = useToasts("usage");

  return (
    <ResourceBoundary resource={res}>
      {(r: Json<UsageReport> & Partial<NewUsage>) => {
        const isNew = typeof (r as NewUsage).period === "string" && Array.isArray((r as NewUsage).items);
        if (isNew) {
          const nu = r as unknown as NewUsage;
          return (
            <div className="space-y-6">
              <p className="text-sm text-muted">Period {nu.period} · {nu.timezone} · cost basis {nu.costBasis} — estimate versus settled preserved</p>
              <DataTable label="Usage by workspace">
                <thead><tr><Th>Workspace</Th><Th>Plan</Th><Th>Used</Th><Th>Reserved</Th></tr></thead>
                <tbody>{nu.items.map((it) => <tr key={it.id}><Td>{it.id.slice(0, 8)}</Td><Td>{it.plan}</Td><Td>{formatMinutes(Math.round(it.usedSeconds / 60))}</Td><Td>{formatMinutes(Math.round(it.reservedSeconds / 60))}</Td></tr>)}</tbody>
              </DataTable>
              {nu.spend.length > 0 && (
                <DataTable label="Spend by day" narrow>
                  <thead><tr><Th>Day</Th><Th>Reserved cost</Th><Th>Settled cost</Th></tr></thead>
                  <tbody>{nu.spend.map((s) => <tr key={s.day}><Td>{s.day}</Td><Td>{(s.reservedCostMicros / 1e6).toFixed(2)}</Td><Td>{(s.settledCostMicros / 1e6).toFixed(2)}</Td></tr>)}</tbody>
                </DataTable>
              )}
              <p className="text-xs text-muted">No totals fabricated; null stays –. <button type="button" onClick={res.reload} className="underline">Refresh</button></p>
              <ToastStack items={toasts.items} onDismiss={toasts.dismiss} />
            </div>
          );
        }
        const ro = r as Json<UsageReport>;
        return (
          <div className="space-y-6">
            {ro.paused.paused && (
              <Notice tone="danger">
                New work is <strong>paused</strong> for everyone{ro.paused.by ? ` (by ${ro.paused.by}, ${fmtUtc(ro.paused.at)})` : ""}. {ro.paused.reason && <>Reason: {ro.paused.reason}.</>}
              </Notice>
            )}
            {ro.month.overGuard && <Notice tone="warning">Spend passed the alert level this month.</Notice>}
            {!ro.month.costKnown && <Notice>Prices aren&rsquo;t set. Showing minutes only.</Notice>}

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Metric label="Minutes this month" value={ro.month.minutes.toLocaleString("en")} />
              <Metric label="Estimated cost" value={usd(ro.month.costUsd)} tone={ro.month.overTarget ? "warning" : undefined} />
              <Metric label="Monthly target" value={ro.month.targetUsd === null ? "Not set" : usd(ro.month.targetUsd)} hint={ro.month.overTarget ? "Over target" : undefined} />
              <Metric label="Alert level" value={ro.month.guardUsd === null ? "Not set" : usd(ro.month.guardUsd)} hint="Only a warning" />
            </div>

            <Card>
              <CardHeader title="Pause everything" />
              <div className="flex flex-wrap items-center justify-between gap-3 p-5 text-sm">
                <p className="max-w-xl text-muted">Stops new uploads and meeting recordings for everyone.</p>
                {ro.paused.paused ? <Button variant="primary" onClick={() => setDialog("resume")}>Resume…</Button> : <Button variant="danger" onClick={() => setDialog("pause")}>Pause new work…</Button>}
              </div>
            </Card>

            <section aria-labelledby="top" className="space-y-3">
              <h2 id="top" className="text-sm font-semibold">Heaviest users this month</h2>
              {ro.topCustomers.length === 0 ? (
                <Card><EmptyState title="No usage yet this month" /></Card>
              ) : (
                <DataTable label="Heaviest users this month" narrow>
                  <thead><tr><Th>User</Th><Th>Minutes</Th><Th><span className="sr-only">Actions</span></Th></tr></thead>
                  <tbody>
                    {ro.topCustomers.map((t) => {
                      const href = `/admin/customers/${t.userId}`;
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
                      {ro.days.length === 0 && <tr><Td className="text-muted">No usage in the last 30 days.</Td><Td /><Td /><Td /></tr>}
                      {ro.days.map((d) => <tr key={`${d.day}-${d.operation}`}><Td>{d.day}</Td><Td className="capitalize">{d.operation.replace("_", " ")}</Td><Td className="tabular-nums">{d.minutes}</Td><Td>{usd(d.costUsd)}</Td></tr>)}
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
                  await adminPost("/api/admin/controls/processing", { paused: dialog === "pause", reason: v.reason, version: 1 } as unknown as Record<string, unknown>, { "Idempotency-Key": crypto.randomUUID().replace(/-/g, "").slice(0, 16).padEnd(8, "0") });
                  toasts.push({ tone: "success", message: dialog === "pause" ? "New work is paused." : "New work has resumed." });
                  res.reload();
                }}
              />
            )}
            <ToastStack items={toasts.items} onDismiss={toasts.dismiss} />
          </div>
        );
      }}
    </ResourceBoundary>
  );
}
