"use client";

import { Users } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ToastStack, useToasts } from "@/components/ui/toast";
import { Avatar } from "@/components/ui/avatar";
import { type Json, fmtUtc } from "@/lib/admin-client";
import type { UserList, UserRow } from "@/lib/admin-types";
import { ClickRow, MenuTd, RowMenu, RowOpen } from "./row-menu";
import { AdminUnavailable, FilterSelect, SearchField, DataTable, Notice, Td, Th, usePaged } from "./ui";
import { type UserDialogKind, UserDialogs, userMenuItems } from "./user-admin";

type Row = Json<UserRow>;
type Page = Json<UserList>;


/** "plan_free" or "free" -> "Free". */
const planLabel = (plan: string | null | undefined) => {
  const t = String(plan ?? "free").replace(/^plan[_-]/i, "").replace(/_/g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
};
/** "18 Nov 2026, 13:53" in the admin's own time zone. The exact UTC time is in the tooltip. */
const friendlyDate = (iso: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
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
        <SearchField label="Search by name or email" placeholder="Search by name or email" value={q} onChange={setQ} />
        <FilterSelect label="Plan" value={f.plan} onChange={(v) => setF((x) => ({ ...x, plan: v }))} options={[{ value: "all", label: "All" }, { value: "free", label: "Free" }, { value: "pro", label: "Pro" }, { value: "business", label: "Business" }]} />
        <FilterSelect label="Status" value={f.status} onChange={(v) => setF((x) => ({ ...x, status: v }))} options={[{ value: "all", label: "All" }, { value: "active", label: "Active" }, { value: "suspended", label: "Suspended" }]} />
        <Button type="submit" variant="primary" className="h-10">Search</Button>
        {filtered && <Button variant="ghost" className="h-10" onClick={() => { setQ(""); setF({ q: "", plan: "all", status: "all" }); }}>Clear</Button>}
      </form>

      {list.status === "error" && <Notice tone="danger">{list.message}</Notice>}
      {list.status === "loading" && <div role="status" aria-label="Loading" aria-busy="true" className="h-64 jb-skel rounded-2xl border border-border bg-surface" />}
      {list.status === "ready" && list.rows.length === 0 && (
        <Card><EmptyState icon={<Users />} title={filtered ? "No users match" : "No users yet"} body={filtered ? "Check the spelling, or clear a filter." : "People appear here once they sign up."} /></Card>
      )}
      {list.status === "ready" && list.rows.length > 0 && (
        <>
          <DataTable label="Users">
            <thead><tr><Th>Full name</Th><Th>Email</Th><Th wide>Plan</Th><Th>Status</Th><Th wide>Last seen</Th><Th><span className="sr-only">Actions</span></Th></tr></thead>
            <tbody>
              {list.rows.map((u) => {
                const href = `${basePath}/${u.id}`;
                const full = (u.name ?? "").trim().replace(/\s+/g, " ");
                const note = PLAN_NOTE[(u.planStatus as string) ?? ""];
                return (
                  <ClickRow key={u.id} href={href}>
                    <Td>
                      <span className="flex items-center gap-3">
                        <Avatar name={u.name ?? u.email} src={(u as unknown as { avatarUrl?: string | null }).avatarUrl ?? null} size={32} />
                        <RowOpen href={href}>{full || <span className="font-normal text-muted">No name</span>}</RowOpen>
                      </span>
                    </Td>
                    <Td className="max-w-64 truncate text-muted" ><span title={u.email}>{u.email}</span></Td>
                    <Td wide className="whitespace-nowrap">{planLabel(u.plan as string)}{note && <Badge tone="warning">{note}</Badge>}</Td>
                    <Td>
                      <span className="flex flex-wrap items-center gap-1.5">
                        <Badge tone={u.status === "suspended" ? "danger" : "success"}>{u.status === "suspended" ? "Suspended" : "Active"}</Badge>
                        {u.staff && <Badge tone="info">Admin</Badge>}
                        {!u.emailVerified && <Badge tone="warning">Email not confirmed</Badge>}
                      </span>
                    </Td>
                    <Td wide className="whitespace-nowrap text-muted"><span title={u.lastActiveAt ? fmtUtc(u.lastActiveAt) : undefined}>{u.lastActiveAt ? friendlyDate(u.lastActiveAt as unknown as string) : "Never"}</span></Td>
                    <MenuTd>
                      <RowMenu
                        label={`Actions for ${u.email}`}
                        header={<><p className="truncate text-sm font-semibold">{u.name ?? u.email}</p><p className="truncate text-xs text-muted">{u.email}</p></>}
                        items={userMenuItems({ id: u.id, email: u.email, name: u.name, suspended: u.status === "suspended", emailVerified: u.emailVerified, plan: u.plan }, (dialog) => setActing({ user: u, dialog }), href)}
                      />
                    </MenuTd>
                  </ClickRow>
                );
              })}
            </tbody>
          </DataTable>
          <div className="flex items-center justify-between text-sm text-muted">
            <span>Showing {list.rows.length}{list.first?.total != null ? ` of ${list.first.total}` : ""} {list.rows.length === 1 && list.first?.total == null ? "user" : "users"}</span>
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
