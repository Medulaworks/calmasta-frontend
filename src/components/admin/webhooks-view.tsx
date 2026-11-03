"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ToastStack, useToasts } from "@/components/ui/toast";
import { type Json, adminPost, fmtUtc } from "@/lib/admin-client";
import type { WebhookFilter, WebhookList } from "@/lib/admin-types";
import { ClickRow, DetailsDialog, MenuTd, RowMenu, RowOpen } from "./row-menu";
import { ActionDialog, DataTable, Metric, ResourceBoundary, Td, Th, useResource } from "./ui";

type Data = Json<WebhookList>;
type Msg = Data["rows"][number];
const FILTERS: Array<{ id: WebhookFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "attention", label: "Needs a look" },
  { id: "rejected", label: "Not trusted" },
];
const RESULT = { ok: { label: "Worked", tone: "success" }, attention: { label: "Needs a look", tone: "warning" }, rejected: { label: "Not trusted", tone: "danger" } } as const;

export function WebhooksView() {
  // A link can open this page already filtered (for example Mismatches links to the ones that need a look).
  const asked = useSearchParams().get("filter");
  const [filter, setFilter] = useState<WebhookFilter>(asked === "attention" || asked === "rejected" ? asked : "all");
  const res = useResource<Data>(`/api/admin/webhooks?filter=${filter}`);
  const toasts = useToasts("webhooks");
  const [open, setOpen] = useState<Msg | null>(null);
  const [replaying, setReplaying] = useState<Msg | null>(null);
  const result = (w: Msg) => RESULT[w.health === "ok" ? "ok" : w.health === "attention" ? "attention" : "rejected"];

  return (
    <div className="space-y-5">
      <ResourceBoundary resource={res}>
        {(d) => (
          <>
            <div className="grid grid-cols-3 gap-3">
              <Metric label="Received, 24 hours" value={d.counts.total24h} />
              <Metric label="Need a look" value={d.counts.attention} tone={d.counts.attention > 0 ? "warning" : undefined} />
              <Metric label="Not trusted, 24 hours" value={d.counts.rejected24h} hint="Failed the safety check" tone={d.counts.rejected24h > 0 ? "warning" : undefined} />
            </div>
            <div role="group" aria-label="Show" className="flex flex-wrap gap-2">
              {FILTERS.map((f) => (
                <button key={f.id} type="button" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)} className={`rounded-full border px-3 py-1 text-sm ${filter === f.id ? "border-accent bg-accent/10 font-medium text-accent" : "border-border text-muted hover:bg-surface"}`}>
                  {f.label}
                </button>
              ))}
            </div>
            {d.rows.length === 0 ? (
              <Card><EmptyState title="Nothing to show" body="No messages match this filter." /></Card>
            ) : (
              <DataTable label="Store messages">
                <thead><tr><Th>Received</Th><Th wide>From</Th><Th>Result</Th><Th><span className="sr-only">Actions</span></Th></tr></thead>
                <tbody>
                  {d.rows.map((w) => (
                    <ClickRow key={w.id} onOpen={() => setOpen(w)}>
                      <Td className="whitespace-nowrap"><RowOpen onOpen={() => setOpen(w)}>{fmtUtc(w.receivedAt)}</RowOpen></Td>
                      <Td wide className="capitalize">{w.provider}</Td>
                      <Td>
                        <Badge tone={result(w).tone}>{result(w).label}</Badge>
                        {(w.error ?? w.note) && <span className="mt-1 block max-w-xs break-words text-xs text-muted">{w.error ?? w.note}</span>}
                      </Td>
                      <MenuTd>
                        <RowMenu label="Actions for this message" items={[
                          { label: "See details", onSelect: () => setOpen(w) },
                          { label: "Run again…", onSelect: () => setReplaying(w), divider: true, disabled: !w.replay.allowed, reason: w.replay.reason },
                        ]} />
                      </MenuTd>
                    </ClickRow>
                  ))}
                </tbody>
              </DataTable>
            )}
          </>
        )}
      </ResourceBoundary>
      {open && (
        <DetailsDialog
          title="Store message"
          onClose={() => setOpen(null)}
          rows={[
            ["Received", fmtUtc(open.receivedAt)],
            ["From", <span key="p" className="capitalize">{open.provider}</span>],
            ["Safety check", open.verified ? "Passed" : "Failed, so it was ignored"],
            ["Result", result(open).label],
            ["Note", open.error ?? open.note ?? (open.processedAt ? "None" : "It never finished processing.")],
            ["Sent again by the store", `${open.duplicates} ${open.duplicates === 1 ? "time" : "times"} (applied once)`],
            ["Run again by an admin", `${open.replays} ${open.replays === 1 ? "time" : "times"}`],
            ["Reference", <code key="r" className="break-all text-xs">{open.reference}</code>],
            ...(open.replay.allowed ? [] : ([["Why it can’t be run again", open.replay.reason ?? "–"]] as Array<[string, React.ReactNode]>)),
          ]}
          actions={open.replay.allowed ? <Button variant="primary" onClick={() => { setReplaying(open); setOpen(null); }}>Run again…</Button> : null}
        />
      )}
      {replaying && (
        <ActionDialog
          title="Run this message again?"
          description="Applies the message again. Safe to repeat."
          confirmLabel="Run again"
          onClose={() => setReplaying(null)}
          onSubmit={async (v) => {
            const r = await adminPost<{ result: string }>(`/api/admin/webhooks/${replaying.id}/replay`, { reason: v.reason });
            toasts.push({ tone: "success", message: `Done: ${r.result}` });
            res.reload();
          }}
        />
      )}
      <ToastStack items={toasts.items} onDismiss={toasts.dismiss} />
    </div>
  );
}
