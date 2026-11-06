"use client";

import { Search, Users } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ToastStack, useToasts } from "@/components/ui/toast";
import { type Json, fmtUtc } from "@/lib/admin-client";
import type { UserList, UserRow } from "@/lib/admin-types";
import { ClickRow, MenuTd, RowMenu, RowOpen } from "./row-menu";
import { AdminUnavailable, DataTable, Notice, Td, Th, usePaged } from "./ui";
import { type UserDialogKind, UserDialogs, userMenuItems } from "./user-admin";

type Row = Json<UserRow>;
type Page = Json<UserList>;

const field = "h-9 rounded-lg border border-border bg-background px-3 text-sm";
const PLAN_NOTE: Record<string, string> = { grace: "Payment late", pending_activation: "Waiting for payment", expired: "Ended" };

/** Everyone with an account. Click a row to open it, or use the ⋯ at the end for quick actions. */
export function UserDirectory({ basePath }: { basePath: string }) {
  const [q, setQ] = useState("");
  const [f, setF] = useState({ q: "", plan: "all", status: "all" });
  const [acting, setActing] = useState<{ user: Row; dialog: UserDialogKind } | null>(null);
  const toasts = useToasts("users");
  const p = new URLSearchParams();
  if (f.q) p.set("search", f.q);
  for (const k of ["plan", "status"] as const) if (f[k] !== "all") p.set(k, f[k]);
  const list = usePaged<Row, Page & { items?: Row[]; available?: boolean }>(`/api/admin/customers${p.size ? `?${p}` : ""}`, (pg) => (pg as unknown as { items?: Row[]; users?: Row[] }).items ?? (pg as unknown as { users: Row[] }).users ?? []);
  const filtered = f.q !== "" || f.plan !== "all" || f.status !== "all";

  if (list.status === "unavailable") return <AdminUnavailable />;
  return (
    <div className="space-y-4">
      <form role="search" aria-label="Find a user" onSubmit={(e) => { e.preventDefault(); setF((x) => ({ ...x, q: q.trim() })); }} className="flex flex-wrap items-center gap-2">
        <label className="min-w-48 flex-1 sm:max-w-sm">
          <span className="sr-only">Search by email or name</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by email or name" maxLength={100} className={`${field} block w-full`} />
        </label>
        <label><span className="sr-only">Plan</span>
          <select value={f.plan} onChange={(e) => setF((x) => ({ ...x, plan: e.target.value }))} className={field}>
            <option value="all">All plans</option><option value="free">Free</option><option value="pro">Pro</option><option value="business">Business</option>
          </select>
        </label>
        <label><span className="sr-only">Status</span>
          <select value={f.status} onChange={(e) => setF((x) => ({ ...x, status: e.target.value }))} className={field}>
            <option value="all">All accounts</option><option value="active">Active</option><option value="suspended">Suspended</option>
          </select>
        </label>
        <Button type="submit"><Search aria-hidden className="size-4" /> Search</Button>
        {filtered && <Button variant="ghost" onClick={() => { setQ(""); setF({ q: "", plan: "all", status: "all" }); }}>Clear</Button>}
      </form>

      {list.status === "error" && <Notice tone="danger">{list.message}</Notice>}
      {list.status === "loading" && <div role="status" aria-label="Loading" aria-busy="true" className="h-64 jb-skel rounded-xl border border-border bg-surface" />}
      {list.status === "ready" && list.rows.length === 0 && (
        <Card><EmptyState icon={<Users />} title={filtered ? "No users match" : "No users yet"} body={filtered ? "Check the spelling, or clear a filter." : "People appear here once they sign up."} /></Card>
      )}
      {list.status === "ready" && list.rows.length > 0 && (
        <>
          <DataTable label="Users">
            <thead><tr><Th>User</Th><Th wide>Plan</Th><Th>Status</Th><Th wide>Last seen</Th><Th><span className="sr-only">Actions</span></Th></tr></thead>
            <tbody>
              {list.rows.map((u) => {
                const href = `${basePath}/${u.id}`;
                return (
                  <ClickRow key={u.id} href={href}>
                    <Td>
                      <RowOpen href={href}>{u.email}</RowOpen>
                      <span className="block text-xs text-muted">{u.name ?? "No name"}<span className="capitalize md:hidden"> · {u.plan}</span>{u.emailVerified ? "" : " · email not confirmed"}</span>
                    </Td>
                    <Td wide><span className="capitalize">{u.plan}</span>{PLAN_NOTE[u.planStatus] && <span className="block text-xs text-muted">{PLAN_NOTE[u.planStatus]}</span>}</Td>
                    <Td>
                      <span className="flex flex-wrap gap-1">
                        <Badge tone={u.status === "suspended" ? "danger" : "success"}>{u.status === "suspended" ? "Suspended" : "Active"}</Badge>
                        {u.staff && <Badge tone="info">Admin</Badge>}
                      </span>
                    </Td>
                    <Td wide className="whitespace-nowrap text-muted">{u.lastActiveAt ? fmtUtc(u.lastActiveAt) : "Never"}</Td>
                    <MenuTd>
                      <RowMenu
                        label={`Actions for ${u.email}`}
                        items={userMenuItems({ id: u.id, email: u.email, name: u.name, suspended: u.status === "suspended", emailVerified: u.emailVerified, plan: u.plan }, (dialog) => setActing({ user: u, dialog }), href)}
                      />
                    </MenuTd>
                  </ClickRow>
                );
              })}
            </tbody>
          </DataTable>
          <div className="flex items-center justify-between text-xs text-muted">
            <span>Showing {list.rows.length}{list.first?.total != null ? ` of ${list.first.total}` : ""}</span>
            {list.hasMore && <Button onClick={() => void list.loadMore()} disabled={list.more}>{list.more ? "Loading…" : "Show more"}</Button>}
          </div>
        </>
      )}
      {acting && (
        <UserDialogs
          user={{ id: acting.user.id, email: acting.user.email, name: acting.user.name }}
          dialog={acting.dialog}
          onClose={() => setActing(null)}
          onDone={(message) => { toasts.push({ tone: "success", message }); list.reload(); }}
        />
      )}
      <ToastStack items={toasts.items} onDismiss={toasts.dismiss} />
    </div>
  );
}
