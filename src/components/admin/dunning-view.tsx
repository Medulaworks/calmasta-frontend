"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { type Json, fmtUtc } from "@/lib/admin-client";
import type { DunningReport } from "@/lib/admin-types";
import { DataTable, Metric, Notice, ResourceBoundary, Td, Th, useResource } from "./ui";

type Data = Json<DunningReport>;

export function DunningView() {
  const res = useResource<Data>("/api/admin/dunning");
  return (
    <ResourceBoundary resource={res}>
      {(d) => (
        <div className="space-y-5">
          <Notice>Billing is handled in the store. This is a read-only view of what the store has told us. Follow a reference to the store to act on an order or subscription.</Notice>
          <div className="grid grid-cols-3 gap-3">
            <Metric label="In grace period" value={d.counts.grace} tone={d.counts.grace > 0 ? "warning" : undefined} />
            <Metric label="Waiting for payment" value={d.counts.pending} />
            <Metric label="Ended, last 30 days" value={d.counts.expired30d} />
          </div>
          {d.rows.length === 0 ? (
            <Card><EmptyState title="No payment problems" body="Nobody is in grace, waiting on a payment, or recently ended." /></Card>
          ) : (
            <DataTable label="Payment status">
              <thead><tr><Th>Customer</Th><Th>Status</Th><Th>Access until</Th><Th>Store</Th><Th>Last store event</Th><Th>What happens next</Th></tr></thead>
              <tbody>
                {d.rows.map((r) => (
                  <tr key={r.userId}>
                    <Td><Link href={`/dashboard/admin/customers/${r.userId}`} className="font-medium text-accent underline underline-offset-2">{r.email}</Link></Td>
                    <Td><Badge tone={r.status === "grace" ? "warning" : r.status === "pending_activation" ? "info" : "neutral"}>{r.status === "grace" ? "Grace period" : r.status === "pending_activation" ? "Waiting for payment" : "Ended"}</Badge></Td>
                    <Td className="whitespace-nowrap">{r.status === "grace" ? fmtUtc(r.endsAt) : "–"}</Td>
                    <Td>{r.storeUrl ? <a href={r.storeUrl} target="_blank" rel="noopener noreferrer" className="text-accent underline underline-offset-2">{r.storeReference}</a> : (r.storeReference ?? "–")}</Td>
                    <Td className="whitespace-nowrap">{r.lastStoreEvent ? <>{fmtUtc(r.lastStoreEvent.receivedAt)}<span className="block text-xs text-muted">{r.lastStoreEvent.note}</span></> : "–"}</Td>
                    <Td className="max-w-xs text-muted">{r.recovery}</Td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          )}
        </div>
      )}
    </ResourceBoundary>
  );
}
