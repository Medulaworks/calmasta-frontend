"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ToastStack, useToasts } from "@/components/ui/toast";
import { type Json, adminPost, fmtUtc } from "@/lib/admin-client";
import type { Reconciliation } from "@/lib/admin-types";
import { ClickRow, DetailsDialog, MenuTd, RowMenu, RowOpen } from "./row-menu";
import { ActionDialog, DataTable, Metric, ResourceBoundary, Td, Th, useResource } from "./ui";

type Data = Json<Reconciliation>;
type Finding = Data["findings"][number];

export function ReconciliationView() {
  const res = useResource<Data>("/api/admin/reconciliation");
  const toasts = useToasts("mismatches");
  const [open, setOpen] = useState<Finding | null>(null);
  const [fixing, setFixing] = useState<Finding | null>(null);

  return (
    <ResourceBoundary resource={res}>
      {(d) => {
        const fixable = d.findings.filter((f) => f.severity === "safe_to_fix").length;
        const review = d.findings.length - fixable;
        const menu = (f: Finding) => [
          { label: "See details", onSelect: () => setOpen(f) },
          ...(f.severity === "safe_to_fix" ? [{ label: "Fix this…", onSelect: () => setFixing(f), divider: true }] : []),
          ...(f.userId ? [{ label: "Open account", href: `/admin/customers/${f.userId}`, divider: f.severity !== "safe_to_fix" }] : []),
          ...(f.webhookId ? [{ label: "See the store message", href: "/admin/webhooks?filter=attention" }] : []),
        ];
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-3">
              <Metric label="Can fix here" value={fixable} hint="Out-of-date records" />
              <Metric label="Need a person" value={review} tone={review > 0 ? "warning" : undefined} hint="Money or customer data" />
              <Metric label="Usage not matched" value={d.unreconciledUsage} hint="Older than 3 days" />
            </div>
            <p className="text-sm text-muted">Checked {fmtUtc(d.checkedAt)}.</p>

            {d.findings.length === 0 ? (
              <Card><EmptyState title="Everything agrees" body="No mismatches found." /></Card>
            ) : (
              <DataTable label="Mismatches">
                <thead><tr><Th>What</Th><Th wide>Who</Th><Th>Next step</Th><Th><span className="sr-only">Actions</span></Th></tr></thead>
                <tbody>
                  {d.findings.map((f) => (
                    <ClickRow key={f.key} onOpen={() => setOpen(f)}>
                      <Td><RowOpen onOpen={() => setOpen(f)}>{f.summary}</RowOpen></Td>
                      <Td wide className="text-muted">{f.email ?? "–"}</Td>
                      <Td><Badge tone={f.severity === "safe_to_fix" ? "info" : "warning"}>{f.severity === "safe_to_fix" ? "Can fix here" : "Needs a person"}</Badge></Td>
                      <MenuTd><RowMenu label={`Actions for ${f.summary}`} items={menu(f)} /></MenuTd>
                    </ClickRow>
                  ))}
                </tbody>
              </DataTable>
            )}

            {open && (
              <DetailsDialog
                title={open.summary}
                onClose={() => setOpen(null)}
                rows={[["What happened", open.detail], ...(open.email ? ([["Who", open.email]] as Array<[string, React.ReactNode]>) : []), ["Next step", open.severity === "safe_to_fix" ? "Can be fixed here. Only an out-of-date status changes." : "Needs a person to look. Money or customer data is involved."]]}
                actions={open.severity === "safe_to_fix" ? <Button variant="primary" onClick={() => { setFixing(open); setOpen(null); }}>Fix this…</Button> : null}
              />
            )}
            {fixing && (
              <ActionDialog
                title="Fix this record?"
                description={<>{fixing.detail} Only the plan status changes.</>}
                confirmLabel="Fix it"
                onClose={() => setFixing(null)}
                onSubmit={async (v) => {
                  await adminPost("/api/admin/reconciliation", { kind: fixing.kind, userId: fixing.userId, reason: v.reason });
                  toasts.push({ tone: "success", message: "Record fixed." });
                  res.reload();
                }}
              />
            )}
            <ToastStack items={toasts.items} onDismiss={toasts.dismiss} />
          </div>
        );
      }}
    </ResourceBoundary>
  );
}
