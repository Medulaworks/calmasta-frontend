"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { type Json, fmtUtc } from "@/lib/admin-client";
import type { WebhookFilter, WebhookList } from "@/lib/admin-types";
import { ClickRow, DetailsDialog } from "./row-menu";
import { DataTable, Metric, Notice, ResourceBoundary, Td, Th, useResource } from "./ui";

type Data = Json<WebhookList>;
type NewItem = { id: string; provider: string; state: string; verifiedAt: string | null; createdAt: string };
type NewResp = { items: NewItem[]; nextCursor: string | null; available: boolean };

export function WebhooksView() {
  const asked = useSearchParams().get("filter");
  const [filter] = useState<WebhookFilter>(asked === "attention" || asked === "rejected" ? asked : "all");
  const res = useResource<Data & NewResp>(`/api/admin/webhooks?filter=${filter}`);
  const [open, setOpen] = useState<NewItem | null>(null);

  return (
    <div className="space-y-5">
      <ResourceBoundary resource={res}>
        {(d: Data & Partial<NewResp>) => {
          const isNew = Array.isArray((d as NewResp).items);
          if (isNew) {
            const nd = d as unknown as NewResp;
            return (
              <>
                <Notice>You can see that each message arrived and was checked. The contents are hidden for safety, and messages can’t be replayed from here.</Notice>
                {nd.items.length === 0 ? <Card><EmptyState title="No store messages yet" body="They appear here when the app store tells us about a subscription." /></Card> : (
                  <DataTable label="Webhooks">
                    <thead><tr><Th>Message</Th><Th>From</Th><Th>Status</Th><Th>Checked</Th><Th>Received</Th></tr></thead>
                    <tbody>{nd.items.map((w) => <ClickRow key={w.id} onOpen={() => setOpen(w)}><Td className="font-mono text-xs">{w.id.slice(0, 8)}</Td><Td>{w.provider}</Td><Td><Badge tone={w.state === "verified" ? "success" : "neutral"}>{w.state === "verified" ? "Checked" : w.state.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase())}</Badge></Td><Td>{w.verifiedAt ? fmtUtc(w.verifiedAt) : "–"}</Td><Td>{fmtUtc(w.createdAt)}</Td></ClickRow>)}</tbody>
                  </DataTable>
                )}
                {open && <DetailsDialog title="Store message" onClose={() => setOpen(null)} rows={[["Message ID", open.id],["From", open.provider],["Status", open.state.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase())],["Checked", open.verifiedAt ? fmtUtc(open.verifiedAt) : "–"],["Received", fmtUtc(open.createdAt)]]} />}
              </>
            );
          }
          const od = d as Data;
          return (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Metric label="Received, last 24 hours" value={od.counts.total24h} />
                <Metric label="Need a look" value={od.counts.attention} tone={od.counts.attention > 0 ? "warning" : undefined} />
                <Metric label="Not trusted, last 24 hours" value={od.counts.rejected24h} tone={od.counts.rejected24h > 0 ? "danger" : undefined} />
              </div>
              {od.rows.length === 0 ? <Card><EmptyState title="No store messages yet" body="They appear here when the app store tells us about a subscription." /></Card> : (
                <DataTable label="Store messages">
                  <thead><tr><Th>Received</Th><Th wide>From</Th><Th>Result</Th></tr></thead>
                  <tbody>{od.rows.map((w) => <ClickRow key={w.id} onOpen={() => setOpen(w as unknown as NewItem)}><Td>{fmtUtc(w.receivedAt)}</Td><Td>{w.provider}</Td><Td><Badge tone={w.health === "ok" ? "success" : w.health === "attention" ? "warning" : "danger"}>{w.health === "ok" ? "Processed" : w.health === "attention" ? "Needs a look" : "Not trusted"}</Badge></Td></ClickRow>)}</tbody>
                </DataTable>
              )}
            </>
          );
        }}
      </ResourceBoundary>
    </div>
  );
}
