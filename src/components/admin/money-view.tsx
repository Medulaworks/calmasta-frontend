"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { type Json, fmtUtc } from "@/lib/admin-client";
import type { DunningReport } from "@/lib/admin-types";
import { ClickRow } from "./row-menu";
import { DataTable, FilterSelect, ResourceBoundary, Td, Th, useResource } from "./ui";

type Payments = Json<DunningReport> & { available?: boolean; reason?: string };

/** A payment's status in plain words. "Late" still has access for now; "Ended" no longer does. */
const STATUS: Record<string, { label: string; tone: "warning" | "info" | "danger" }> = {
  grace: { label: "Late", tone: "warning" },
  pending_activation: { label: "Pending", tone: "info" },
  expired: { label: "Ended", tone: "danger" },
};
const STATUS_FILTER = [{ value: "all", label: "All" }, { value: "grace", label: "Late" }, { value: "pending_activation", label: "Pending" }, { value: "expired", label: "Ended" }];

/** One simple table of payments that need attention. Select a row to open the account. */
export function MoneyView() {
  const res = useResource<Payments>("/api/admin/dunning");
  const [status, setStatus] = useState("all");

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <FilterSelect label="Status" value={status} onChange={setStatus} options={STATUS_FILTER} />
      </div>
      <ResourceBoundary resource={res}>
        {(d: Payments) => {
          if (d.available === false) return <Card><EmptyState title="Payments aren’t available yet" body="They will appear here once billing is switched on." /></Card>;
          const rows = d.rows.filter((r) => status === "all" || r.status === status);
          if (rows.length === 0) return <Card><EmptyState title={d.rows.length === 0 ? "No payment problems" : "Nothing with that status"} body={d.rows.length === 0 ? "Nobody is late, waiting to pay, or recently ended." : "Try a different status."} /></Card>;
          return (
            <DataTable label="Payments">
              <thead><tr><Th>Customer</Th><Th>Status</Th><Th wide>Details</Th><Th wide>Access until</Th><Th><span className="sr-only">Open</span></Th></tr></thead>
              <tbody>
                {rows.map((r) => {
                  const href = `/admin/customers/${r.userId}`;
                  const st = STATUS[r.status] ?? STATUS.expired;
                  return (
                    <ClickRow key={r.userId} href={href}>
                      <Td className="font-medium">{r.email}</Td>
                      <Td><Badge tone={st.tone}>{st.label}</Badge></Td>
                      <Td wide className="max-w-sm text-muted">{r.recovery}</Td>
                      <Td wide className="whitespace-nowrap text-muted">{r.status === "grace" ? fmtUtc(r.endsAt) : "–"}</Td>
                      <td className="w-10 border-b border-border px-2 py-2 text-right align-middle"><Link href={href} aria-label={`Open ${r.email}’s account`} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-surface hover:text-foreground"><ChevronRight aria-hidden className="size-4" /></Link></td>
                    </ClickRow>
                  );
                })}
              </tbody>
            </DataTable>
          );
        }}
      </ResourceBoundary>
    </div>
  );
}
