"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ToastStack, useToasts } from "@/components/ui/toast";
import { type Json, fmtUtc } from "@/lib/admin-client";
import type { RegistryRow } from "@/lib/admin-types";
import { ClickRow, MenuTd, RowMenu, RowOpen } from "./row-menu";
import { DataTable, ResourceBoundary, Td, Th, useResource } from "./ui";
import { type UserDialogKind, UserDialogs, userMenuItems } from "./user-admin";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "paid", label: "Paid" },
  { id: "staff", label: "Given by an admin" },
  { id: "grace", label: "Payment late" },
] as const;
const STATUS: Record<string, { label: string; tone: "success" | "warning" | "neutral" }> = {
  active: { label: "Active", tone: "success" },
  grace: { label: "Payment late", tone: "warning" },
};

type Row = Json<RegistryRow>;

/** Who is on a paid plan, or was given one. Same row actions as the Users table. */
export function RegistryView() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const [acting, setActing] = useState<{ row: Row; dialog: UserDialogKind } | null>(null);
  const toasts = useToasts("plans");
  const res = useResource<{ rows: Row[] }>(`/api/admin/registry?filter=${filter}`);
  return (
    <div className="space-y-4">
      <div role="group" aria-label="Show" className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button key={f.id} type="button" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)} className={`rounded-full border px-3 py-1 text-sm ${filter === f.id ? "border-accent bg-accent/10 font-medium text-accent" : "border-border text-muted hover:bg-surface"}`}>
            {f.label}
          </button>
        ))}
      </div>
      <ResourceBoundary resource={res}>
        {({ rows }) =>
          rows.length === 0 ? (
            <Card><EmptyState title="Nobody here" body="No one matches this filter." /></Card>
          ) : (
            <DataTable label="Paid plans">
              <thead><tr><Th>User</Th><Th>Plan</Th><Th>Status</Th><Th wide>Ends or renews</Th><Th><span className="sr-only">Actions</span></Th></tr></thead>
              <tbody>
                {rows.map((r) => {
                  const href = `/admin/customers/${r.id}`;
                  const s = STATUS[r.status] ?? { label: r.status.replace("_", " "), tone: "neutral" as const };
                  return (
                    <ClickRow key={r.id} href={href}>
                      <Td><RowOpen href={href}>{r.email}</RowOpen></Td>
                      <Td><span className="capitalize">{r.plan}</span>{r.source === "staff" && <span className="block text-xs text-muted">Given by an admin</span>}</Td>
                      <Td><Badge tone={s.tone}>{s.label}</Badge></Td>
                      <Td wide className="whitespace-nowrap text-muted">{fmtUtc(r.endsAt)}</Td>
                      <MenuTd>
                        <RowMenu label={`Actions for ${r.email}`} items={userMenuItems({ id: r.id, email: r.email, plan: r.plan, planSource: r.source }, (dialog) => setActing({ row: r, dialog }), href)} />
                      </MenuTd>
                    </ClickRow>
                  );
                })}
              </tbody>
            </DataTable>
          )
        }
      </ResourceBoundary>
      {acting && <UserDialogs user={{ id: acting.row.id, email: acting.row.email, plan: acting.row.plan, planSource: acting.row.source }} dialog={acting.dialog} onClose={() => setActing(null)} onDone={(message) => { toasts.push({ tone: "success", message }); res.reload(); }} />}
      <ToastStack items={toasts.items} onDismiss={toasts.dismiss} />
    </div>
  );
}
