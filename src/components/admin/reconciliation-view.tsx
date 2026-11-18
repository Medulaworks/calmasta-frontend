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
              <Notice>This is a read-only list of minutes set aside for work in progress. You can’t change balances or release jobs from here.</Notice>
              {nd.items.length === 0 ? <Card><EmptyState title="Nothing set aside" body="No minutes are being held for work in progress." /></Card> : (
                <DataTable label="Minutes set aside">
                  <thead><tr><Th>Reference</Th><Th>Account</Th><Th>Estimated cost</Th><Th>Final cost</Th><Th>Started</Th></tr></thead>
                  <tbody>{nd.items.map((r) => <ClickRow key={r.id} onOpen={() => setOpen(r)}><Td className="font-mono text-xs">{r.id.slice(0, 8)}</Td><Td className="font-mono text-xs">{r.workspaceId.slice(0, 8)}</Td><Td className="tabular-nums">${(r.reservedCostMicros / 1e6).toFixed(2)}</Td><Td className="tabular-nums">{r.actualCostMicros == null ? "–" : `$${(r.actualCostMicros / 1e6).toFixed(2)}`}</Td><Td>{fmtUtc(r.createdAt)}</Td></ClickRow>)}</tbody>
                </DataTable>
              )}
              {open && <DetailsDialog title="Minutes set aside" onClose={() => setOpen(null)} rows={[["Reference", open.id],["Account", open.workspaceId],["Estimated cost", `$${(open.reservedCostMicros / 1e6).toFixed(2)}`],["Final cost", open.actualCostMicros == null ? "Not known yet" : `$${(open.actualCostMicros / 1e6).toFixed(2)}`],["Started", fmtUtc(open.createdAt)]]} />}
            </>
          );
        }
        const od = d as Data;
        return od.findings.length === 0 ? <Card><EmptyState title="Everything agrees" /></Card> : (
          <DataTable label="Mismatches">
            <thead><tr><Th>What</Th><Th>Who</Th><Th>Next step</Th></tr></thead>
            <tbody>{od.findings.map((f) => <ClickRow key={f.key} onOpen={() => setOpen(f as unknown as NewItem)}><Td>{f.summary}</Td><Td>{f.email ?? "–"}</Td><Td>{f.severity === "safe_to_fix" ? "Safe to fix" : "Needs a look"}</Td></ClickRow>)}</tbody>
          </DataTable>
        );
      }}
    </ResourceBoundary>
  );
}
