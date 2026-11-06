"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { type Json, fmtUtc } from "@/lib/admin-client";
import type { WebhookFilter, WebhookList } from "@/lib/admin-types";
import { ClickRow, DetailsDialog } from "./row-menu";
import { DataTable, Notice, ResourceBoundary, Td, Th, useResource } from "./ui";

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
                <Notice>Verified inbox metadata only — payloads/signatures omitted; replay unavailable.</Notice>
                {nd.items.length === 0 ? <Card><EmptyState title="No webhooks" /></Card> : (
                  <DataTable label="Webhooks">
                    <thead><tr><Th>ID</Th><Th>Provider</Th><Th>State</Th><Th>Verified</Th><Th>Created</Th></tr></thead>
                    <tbody>{nd.items.map((w) => <ClickRow key={w.id} onOpen={() => setOpen(w)}><Td>{w.id.slice(0, 8)}</Td><Td>{w.provider}</Td><Td><Badge tone={w.state === "verified" ? "success" : "neutral"}>{w.state}</Badge></Td><Td>{w.verifiedAt ? fmtUtc(w.verifiedAt) : "–"}</Td><Td>{fmtUtc(w.createdAt)}</Td></ClickRow>)}</tbody>
                  </DataTable>
                )}
                {open && <DetailsDialog title="Webhook" onClose={() => setOpen(null)} rows={[["ID", open.id],["Provider", open.provider],["State", open.state],["Verified", open.verifiedAt ? fmtUtc(open.verifiedAt) : "–"],["Created", fmtUtc(open.createdAt)]]} />}
              </>
            );
          }
          const od = d as Data;
          return (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-border bg-background p-4"><p className="text-sm text-muted">Received, 24 hours</p><p className="text-xl font-semibold">{od.counts.total24h}</p></div>
                <div className="rounded-xl border border-border bg-background p-4"><p className="text-sm text-muted">Need a look</p><p className="text-xl font-semibold">{od.counts.attention}</p></div>
                <div className="rounded-xl border border-border bg-background p-4"><p className="text-sm text-muted">Not trusted, 24 hours</p><p className="text-xl font-semibold">{od.counts.rejected24h}</p></div>
              </div>
              {od.rows.length === 0 ? <Card><EmptyState title="Nothing to show" /></Card> : (
                <DataTable label="Store messages">
                  <thead><tr><Th>Received</Th><Th wide>From</Th><Th>Result</Th></tr></thead>
                  <tbody>{od.rows.map((w) => <ClickRow key={w.id} onOpen={() => setOpen(w as unknown as NewItem)}><Td>{fmtUtc(w.receivedAt)}</Td><Td>{w.provider}</Td><Td>{w.health}</Td></ClickRow>)}</tbody>
                </DataTable>
              )}
            </>
          );
        }}
      </ResourceBoundary>
    </div>
  );
}
