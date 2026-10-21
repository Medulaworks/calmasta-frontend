"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { type Json, fmtUtc, shortId } from "@/lib/admin-client";
import { formatMinutes } from "@/lib/status";
import type { RegistryRow } from "@/lib/admin-types";
import { CustomerSearch } from "./customers-view";
import { DataTable, Notice, ResourceBoundary, Td, Th, useResource } from "./ui";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "pro", label: "Pro" },
  { id: "staff", label: "Staff-granted" },
  { id: "grace", label: "Payment trouble" },
] as const;

export function RegistryView() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const res = useResource<{ rows: Json<RegistryRow>[] }>(`/api/admin/registry?filter=${filter}`);
  return (
    <div className="space-y-6">
      <Notice>Entitlements are what a customer can <strong>use</strong>. Changing them here never charges or refunds anyone: payments and charges are managed in the store.</Notice>
      <section aria-labelledby="find" className="space-y-3">
        <h2 id="find" className="text-sm font-semibold">Find a customer to change</h2>
        <CustomerSearch basePath="/admin/customers" />
      </section>
      <section aria-labelledby="reg" className="space-y-3">
        <h2 id="reg" className="text-sm font-semibold">Plan registry</h2>
        <div role="group" aria-label="Filter" className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button key={f.id} type="button" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)} className={`rounded-full border px-3 py-1 text-sm ${filter === f.id ? "border-accent bg-accent/10 font-medium text-accent" : "border-border text-muted hover:bg-surface"}`}>
              {f.label}
            </button>
          ))}
        </div>
        <ResourceBoundary resource={res}>
          {({ rows }) =>
            rows.length === 0 ? (
              <Card><EmptyState title="Nothing here" body="No accounts match this filter." /></Card>
            ) : (
              <DataTable label="Plan registry">
                <thead><tr><Th>Customer</Th><Th>Plan</Th><Th>Status</Th><Th>From</Th><Th>Ends or renews</Th><Th>Extra minutes</Th><Th>Store ref</Th></tr></thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <Td><Link href={`/admin/customers/${r.id}`} className="font-medium text-accent underline underline-offset-2">{r.email}</Link><code className="block text-xs text-muted">{shortId(r.id)}</code></Td>
                      <Td className="capitalize">{r.plan}</Td>
                      <Td><Badge tone={r.status === "active" ? "success" : r.status === "grace" ? "warning" : "neutral"}>{r.status.replace("_", " ")}</Badge></Td>
                      <Td>{r.source ?? "–"}</Td>
                      <Td className="whitespace-nowrap">{fmtUtc(r.endsAt)}</Td>
                      <Td className="tabular-nums">{formatMinutes(r.purchasedMinutes)}</Td>
                      <Td>{r.storeReference ?? "–"}</Td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            )
          }
        </ResourceBoundary>
      </section>
    </div>
  );
}
