"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ToastStack, useToasts } from "@/components/ui/toast";
import { type Json, adminPost, fmtUtc } from "@/lib/admin-client";
import type { PrivacyReport } from "@/lib/admin-types";
import { ClickRow, DetailsDialog, MenuTd, RowMenu, RowOpen } from "./row-menu";
import { ActionDialog, AdminUnavailable, DataTable, Notice, ResourceBoundary, Td, Th, useResource } from "./ui";

type Data = Json<PrivacyReport>;
type Del = Data["deletions"][number];
const STATUS: Record<string, { label: string; tone: "neutral" | "info" | "success" | "warning" | "danger" }> = {
  requested: { label: "Waiting to start", tone: "info" },
  in_progress: { label: "In progress", tone: "info" },
  partial_failure: { label: "Stuck, needs a retry", tone: "danger" },
  completed: { label: "Done", tone: "success" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

/** People who asked us to delete their account. The history of what staff did lives under Activity. */
export function PrivacyView() {
  const res = useResource<Data & { available?: boolean; reason?: string }>(`/api/admin/privacy`);
  const toasts = useToasts("deletions");
  const [open, setOpen] = useState<Del | null>(null);
  const [retrying, setRetrying] = useState<Del | null>(null);
  const status = (x: Del) => STATUS[x.status] ?? { label: x.status.replace("_", " "), tone: "neutral" as const };
  const who = (x: Del) => x.email ?? "Account already removed";

  return (
    <ResourceBoundary resource={res}>
      {(d: Data & { available?: boolean; reason?: string }) => {
        if ((d as { available?: boolean }).available === false) return <AdminUnavailable title="Deletions unavailable"><p className="text-sm text-muted">{(d as { reason?: string }).reason ?? "Not available yet."} — deletion not implemented.</p></AdminUnavailable>;
        return (
        <div className="space-y-5">
          <Notice>Done means every stored file is gone.</Notice>
          {d.deletions.length === 0 ? (
            <Card><EmptyState title="No deletion requests" body="Nobody has asked to delete their account." /></Card>
          ) : (
            <DataTable label="Deletion requests">
              <thead><tr><Th>Who</Th><Th>Status</Th><Th wide>Asked on</Th><Th wide>Files</Th><Th><span className="sr-only">Actions</span></Th></tr></thead>
              <tbody>
                {d.deletions.map((x) => (
                  <ClickRow key={x.id} onOpen={() => setOpen(x)}>
                    <Td><RowOpen onOpen={() => setOpen(x)}>{who(x)}</RowOpen></Td>
                    <Td><Badge tone={status(x).tone}>{status(x).label}</Badge></Td>
                    <Td wide className="whitespace-nowrap text-muted">{fmtUtc(x.requestedAt)}</Td>
                    <Td wide className="tabular-nums">{x.filesRemoved} removed{x.filesFailed > 0 && <span className="block text-danger">{x.filesFailed} failed</span>}</Td>
                    <MenuTd>
                      <RowMenu label={`Actions for ${who(x)}`} items={[
                        { label: "See details", onSelect: () => setOpen(x) },
                        { label: "Try again now…", onSelect: () => setRetrying(x), divider: true, disabled: !x.retry.allowed, reason: x.retry.reason },
                        ...(x.customerId ? [{ label: "Open account", href: `/admin/customers/${x.customerId}` }] : []),
                      ]} />
                    </MenuTd>
                  </ClickRow>
                ))}
              </tbody>
            </DataTable>
          )}

          {open && (
            <DetailsDialog
              title="Deletion request"
              onClose={() => setOpen(null)}
              rows={[
                ["Who", who(open)],
                ["Status", status(open).label],
                ["Asked on", fmtUtc(open.requestedAt)],
                ...(open.completedAt ? ([["Finished", fmtUtc(open.completedAt)]] as Array<[string, React.ReactNode]>) : []),
                ["Files", `${open.filesRemoved} removed, ${open.filesFailed} failed`],
                ["Tries so far", open.attempts],
                ["Problem", open.lastError ?? "None"],
                ...(open.nextAttemptAt && open.status === "partial_failure" ? ([["Next automatic try", fmtUtc(open.nextAttemptAt)]] as Array<[string, React.ReactNode]>) : []),
              ]}
              actions={open.retry.allowed ? <Button variant="primary" onClick={() => { setRetrying(open); setOpen(null); }}>Try again now…</Button> : null}
            />
          )}
          {retrying && (
            <ActionDialog
              title="Try this deletion again now?"
              description="Tries to remove the remaining files now."
              confirmLabel="Try again now"
              onClose={() => setRetrying(null)}
              onSubmit={async (v) => {
                await adminPost(`/api/admin/privacy/deletions/${retrying.id}/retry`, { reason: v.reason });
                toasts.push({ tone: "success", message: "Trying again." });
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
