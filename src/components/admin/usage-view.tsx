"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { type Json, adminPost, fmtUtc } from "@/lib/admin-client";
import { formatMinutes } from "@/lib/status";
import type { UsageReport } from "@/lib/admin-types";
import { ActionDialog, DataTable, Metric, Notice, ResourceBoundary, Td, Th, useResource } from "./ui";

const usd = (n: number | null) => (n === null ? "unknown" : `$${n.toFixed(2)}`);

export function UsageView() {
  const res = useResource<Json<UsageReport>>("/api/admin/usage");
  const [dialog, setDialog] = useState<"pause" | "resume" | null>(null);

  return (
    <ResourceBoundary resource={res}>
      {(r) => (
        <div className="space-y-6">
          {r.paused.paused && (
            <Notice tone="danger">
              New processing is <strong>paused</strong> for everyone{r.paused.by ? ` (by ${r.paused.by}, ${fmtUtc(r.paused.at)})` : ""}. {r.paused.reason && <>Reason: {r.paused.reason}.</>} Work already under way finishes, and nothing in anyone&rsquo;s library is affected.
            </Notice>
          )}
          {r.month.overGuard && <Notice tone="warning">This month&rsquo;s estimated cost has reached the spend guard. Nothing is paused automatically: review, then decide whether to pause new processing.</Notice>}
          {!r.month.costKnown && <Notice>Unit costs aren&rsquo;t configured yet, so only minutes are shown. Set <code>COST_PER_TRANSCRIPTION_MINUTE_USD</code> and <code>COST_PER_BOT_MINUTE_USD</code> when the provider prices are known.</Notice>}

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Metric label="Minutes this month" value={r.month.minutes.toLocaleString("en")} />
            <Metric label="Estimated cost" value={usd(r.month.costUsd)} tone={r.month.overTarget ? "warning" : undefined} />
            <Metric label="Target" value={r.month.targetUsd === null ? "not set" : usd(r.month.targetUsd)} hint={r.month.overTarget ? "Over target" : undefined} />
            <Metric label="Spend guard" value={r.month.guardUsd === null ? "not set" : usd(r.month.guardUsd)} hint="Advisory: it doesn't pause anything by itself" />
          </div>

          <Card>
            <CardHeader title="Processing" />
            <div className="flex flex-wrap items-center justify-between gap-3 p-5 text-sm">
              <p className="max-w-xl text-muted">Pausing stops <strong>new</strong> uploads and meeting captures for every customer, with a clear notice. It is for provider outages and runaway spend. Needs a reason and is audited.</p>
              {r.paused.paused ? <Button variant="primary" onClick={() => setDialog("resume")}>Resume processing…</Button> : <Button variant="danger" onClick={() => setDialog("pause")}>Pause new processing…</Button>}
            </div>
          </Card>

          <section aria-labelledby="top" className="space-y-3">
            <h2 id="top" className="text-sm font-semibold">Biggest users this month</h2>
            <DataTable label="Biggest users this month">
              <thead><tr><Th>Customer</Th><Th>Minutes</Th></tr></thead>
              <tbody>
                {r.topCustomers.length === 0 && <tr><Td className="text-muted">No usage yet this month.</Td><Td /></tr>}
                {r.topCustomers.map((t) => <tr key={t.userId}><Td>{t.email}</Td><Td className="tabular-nums">{formatMinutes(t.minutes)}</Td></tr>)}
              </tbody>
            </DataTable>
          </section>

          <section aria-labelledby="days" className="space-y-3">
            <h2 id="days" className="text-sm font-semibold">Last 30 days (UTC days)</h2>
            <DataTable label="Usage by day">
              <thead><tr><Th>Day</Th><Th>Operation</Th><Th>Minutes</Th><Th>Estimated cost</Th></tr></thead>
              <tbody>
                {r.days.length === 0 && <tr><Td className="text-muted">No usage in the last 30 days.</Td><Td /><Td /><Td /></tr>}
                {r.days.map((d) => <tr key={`${d.day}-${d.operation}`}><Td>{d.day}</Td><Td>{d.operation.replace("_", " ")}</Td><Td className="tabular-nums">{d.minutes}</Td><Td>{usd(d.costUsd)}</Td></tr>)}
              </tbody>
            </DataTable>
          </section>

          {dialog && (
            <ActionDialog
              danger={dialog === "pause"}
              title={dialog === "pause" ? "Pause new processing for everyone?" : "Resume processing?"}
              description={dialog === "pause" ? "Customers will be told new processing is paused and can't start new work until you resume. Work already under way finishes." : "Customers can start new work again."}
              confirmLabel={dialog === "pause" ? "Pause processing" : "Resume processing"}
              onClose={() => setDialog(null)}
              onSubmit={async (v) => {
                await adminPost("/api/admin/controls/processing", { paused: dialog === "pause", reason: v.reason });
                res.reload();
              }}
            />
          )}
        </div>
      )}
    </ResourceBoundary>
  );
}
