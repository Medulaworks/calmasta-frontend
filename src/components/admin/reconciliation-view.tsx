"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { type Json, fmtUtc } from "@/lib/admin-client";
import type { Reconciliation } from "@/lib/admin-types";
import { ClickRow, DetailsDialog } from "./row-menu";
import { DataTable, Notice, ResourceBoundary, Td, Th, useResource } from "./ui";

type Data = Json<Reconciliation>;
type NewItem = { id: string; workspaceId: string; state: string; reservedCostMicros: number; actualCostMicros: number | null; createdAt: string };
type NewResp = { items: NewItem[]; nextCursor: string | null; available: boolean };

export function ReconciliationView() {
  const res = useResource<Data & NewResp>("/api/admin/reconciliation");
  const [open, setOpen] = useState<NewItem | null>(null);
  return (
    <ResourceBoundary resource={res}>
      {(d: Data & Partial<NewResp>) => {
        const isNew = Array.isArray((d as NewResp).items);
        if (isNew) {
          const nd = d as unknown as NewResp;
          return (
            <>
              <Notice>Hold view only — not permission to repair balances or release jobs.</Notice>
              {nd.items.length === 0 ? <Card><EmptyState title="No reserved holds" /></Card> : (
                <DataTable label="Reserved holds">
                  <thead><tr><Th>ID</Th><Th>Workspace</Th><Th>Reserved</Th><Th>Actual</Th><Th>Created</Th></tr></thead>
                  <tbody>{nd.items.map((r) => <ClickRow key={r.id} onOpen={() => setOpen(r)}><Td>{r.id.slice(0, 8)}</Td><Td>{r.workspaceId.slice(0, 8)}</Td><Td>{(r.reservedCostMicros / 1e6).toFixed(2)}</Td><Td>{r.actualCostMicros == null ? "–" : (r.actualCostMicros / 1e6).toFixed(2)}</Td><Td>{fmtUtc(r.createdAt)}</Td></ClickRow>)}</tbody>
                </DataTable>
              )}
              {open && <DetailsDialog title="Hold" onClose={() => setOpen(null)} rows={[["ID", open.id],["Workspace", open.workspaceId],["Reserved", String(open.reservedCostMicros)],["Actual", open.actualCostMicros == null ? "–" : String(open.actualCostMicros)],["Created", fmtUtc(open.createdAt)]]} />}
            </>
          );
        }
        const od = d as Data;
        return od.findings.length === 0 ? <Card><EmptyState title="Everything agrees" /></Card> : (
          <DataTable label="Mismatches">
            <thead><tr><Th>What</Th><Th>Who</Th><Th>Next step</Th></tr></thead>
            <tbody>{od.findings.map((f) => <ClickRow key={f.key} onOpen={() => setOpen(f as unknown as NewItem)}><Td>{f.summary}</Td><Td>{f.email ?? "–"}</Td><Td>{f.severity}</Td></ClickRow>)}</tbody>
          </DataTable>
        );
      }}
    </ResourceBoundary>
  );
}
