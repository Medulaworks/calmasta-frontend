"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type Json, adminPost, fmtUtc } from "@/lib/admin-client";
import type { WebhookFilter, WebhookList } from "@/lib/admin-types";
import { ActionDialog, DataTable, Metric, Notice, ResourceBoundary, Td, Th, useResource } from "./ui";

type Data = Json<WebhookList>;
const FILTERS: Array<{ id: WebhookFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "attention", label: "Needs attention" },
  { id: "rejected", label: "Rejected" },
  { id: "duplicates", label: "Repeated" },
];

export function WebhooksView({ initialFilter = "all" }: { initialFilter?: WebhookFilter }) {
  const [filter, setFilter] = useState<WebhookFilter>(initialFilter);
  const res = useResource<Data>(`/api/admin/webhooks?filter=${filter}`);
  const [replaying, setReplaying] = useState<Data["rows"][number] | null>(null);
  const [lastResult, setLastResult] = useState<string | null>(null);

  return (
    <div className="space-y-5">
      <ResourceBoundary resource={res}>
        {(d) => (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Metric label="Received, 24 h" value={d.counts.total24h} />
              <Metric label="Need attention" value={d.counts.attention} tone={d.counts.attention > 0 ? "warning" : undefined} />
              <Metric label="Rejected, 24 h" value={d.counts.rejected24h} hint="Bad signature, never trusted" tone={d.counts.rejected24h > 0 ? "warning" : undefined} />
              <Metric label="Repeats, 24 h" value={d.counts.duplicates24h} hint="Same delivery sent again; applied once" />
            </div>
            {lastResult && <Notice>Replay finished: {lastResult}</Notice>}
            <div role="group" aria-label="Filter" className="flex flex-wrap gap-2">
              {FILTERS.map((f) => (
                <button key={f.id} type="button" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)} className={`rounded-full border px-3 py-1 text-sm ${filter === f.id ? "border-accent bg-accent/10 font-medium text-accent" : "border-border text-muted hover:bg-surface"}`}>
                  {f.label}
                </button>
              ))}
            </div>
            <DataTable label="Webhook deliveries">
              <thead><tr><Th>Received</Th><Th>From</Th><Th>Verified</Th><Th>Outcome</Th><Th>Repeats</Th><Th>Replays</Th><Th><span className="sr-only">Action</span></Th></tr></thead>
              <tbody>
                {d.rows.length === 0 && <tr><Td className="text-muted">Nothing to show.</Td><Td /><Td /><Td /><Td /><Td /><Td /></tr>}
                {d.rows.map((w) => (
                  <tr key={w.id}>
                    <Td className="whitespace-nowrap">{fmtUtc(w.receivedAt)}<code className="block max-w-[11rem] truncate text-xs text-muted" title={w.reference}>{w.reference}</code></Td>
                    <Td>{w.provider}</Td>
                    <Td><Badge tone={w.verified ? "success" : "danger"}>{w.verified ? "Yes" : "Rejected"}</Badge></Td>
                    <Td>
                      <Badge tone={w.health === "ok" ? "success" : w.health === "attention" ? "warning" : "danger"}>{w.health === "ok" ? "Processed" : w.health === "attention" ? "Needs attention" : "Not trusted"}</Badge>
                      <span className="mt-1 block max-w-xs break-words text-xs text-muted">{w.error ?? w.note ?? (w.processedAt ? "" : "Never finished processing")}</span>
                    </Td>
                    <Td className="tabular-nums">{w.duplicates}</Td>
                    <Td className="tabular-nums">{w.replays}</Td>
                    <Td>{w.replay.allowed ? <Button onClick={() => setReplaying(w)}>Replay</Button> : <span className="block max-w-[13rem] text-xs text-muted">{w.replay.reason}</span>}</Td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
            <p className="text-xs text-muted">Only a minimal copy of each delivery is kept (ids, status and the customer match). Secrets and signatures are never stored or shown.</p>
          </>
        )}
      </ResourceBoundary>
      {replaying && (
        <ActionDialog
          title="Replay this delivery?"
          description="It is applied again as if it had just arrived. Entitlement changes are safe to repeat. Use this after fixing why it didn't apply, for example a customer who has now signed up."
          confirmLabel="Replay delivery"
          onClose={() => setReplaying(null)}
          onSubmit={async (v) => {
            const r = await adminPost<{ result: string }>(`/api/admin/webhooks/${replaying.id}/replay`, { reason: v.reason });
            setLastResult(r.result);
            res.reload();
          }}
        />
      )}
    </div>
  );
}
