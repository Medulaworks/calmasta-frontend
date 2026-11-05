"use client";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { type Json, fmtUtc } from "@/lib/admin-client";
import type { DunningReport } from "@/lib/admin-types";
import { ClickRow, MenuTd, RowMenu, RowOpen } from "./row-menu";
import { DataTable, Metric, ResourceBoundary, Td, Th, useResource } from "./ui";

type Data = Json<DunningReport>;
const STATUS: Record<string, { label: string; tone: "warning" | "info" | "neutral" }> = {
  grace: { label: "Payment late", tone: "warning" },
  pending_activation: { label: "Waiting for payment", tone: "info" },
};

export function DunningView() {
  const res = useResource<Data>("/api/admin/dunning");
  return (
    <ResourceBoundary resource={res}>
      {(d) => (
        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-3">
            <Metric label="Payment late" value={d.counts.grace} tone={d.counts.grace > 0 ? "warning" : undefined} hint="Still have access for now" />
            <Metric label="Waiting for payment" value={d.counts.pending} />
            <Metric label="Ended, 30 days" value={d.counts.expired30d} />
          </div>
          {d.rows.length === 0 ? (
            <Card><EmptyState title="No payment problems" body="Nobody is late, waiting to pay, or recently ended." /></Card>
          ) : (
            <DataTable label="Failed payments">
              <thead><tr><Th>User</Th><Th>Status</Th><Th wide>Keeps access until</Th><Th><span className="sr-only">Actions</span></Th></tr></thead>
              <tbody>
                {d.rows.map((r) => {
                  const href = `/admin/customers/${r.userId}`;
                  const s = STATUS[r.status] ?? { label: "Ended", tone: "neutral" as const };
                  return (
                    <ClickRow key={r.userId} href={href}>
                      <Td><RowOpen href={href}>{r.email}</RowOpen><span className="block max-w-sm text-xs text-muted">{r.recovery}</span></Td>
                      <Td><Badge tone={s.tone}>{s.label}</Badge></Td>
                      <Td wide className="whitespace-nowrap text-muted">{r.status === "grace" ? fmtUtc(r.endsAt) : "–"}</Td>
                      <MenuTd>
                        <RowMenu label={`Actions for ${r.email}`} items={[
                          { label: "Open account", href },
                          { label: "Open in store", href: r.storeUrl ?? undefined, external: true, disabled: !r.storeUrl, reason: "No store link for this one." },
                        ]} />
                      </MenuTd>
                    </ClickRow>
                  );
                })}
              </tbody>
            </DataTable>
          )}
        </div>
      )}
    </ResourceBoundary>
  );
}
