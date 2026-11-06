"use client";

import { Lock } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { ToastStack, useToasts } from "@/components/ui/toast";
import { type Json, fmtUtc, shortId } from "@/lib/admin-client";
import { formatMinutes } from "@/lib/status";
import { taskName } from "@/lib/admin-words";
import type { CustomerDetail, UserExtras } from "@/lib/admin-types";
import { RowMenu } from "./row-menu";
import { DataTable, Notice, ResourceBoundary, Td, Th, useResource } from "./ui";
import { DevicesAndWorkspaces, type UserDialogKind, UserDialogs, userMenuItems } from "./user-admin";

type Customer = Json<CustomerDetail> & Json<UserExtras>;
type NewCustomer = { user: { id: string; name: string | null; email: string; emailVerified: boolean; timezone: string | null; isStaff: boolean; suspendedAt: string | null; createdAt: string }; workspaces: Array<{ id: string; plan: string; role: string; processingPaused: boolean }> };

/** One account: who they are, their plan, and a single Actions menu for everything staff can do. */
export function CustomerDetail({ id }: { id: string }) {
  const res = useResource<Customer & NewCustomer>(`/api/admin/customers/${id}`);
  const [dialog, setDialog] = useState<UserDialogKind | null>(null);
  const toasts = useToasts(`user-${id}`);

  return (
    <ResourceBoundary resource={res}>
      {(c: Customer & Partial<NewCustomer>) => {
        if ((c as NewCustomer).user) {
          const nc = c as unknown as NewCustomer;
          const suspended = !!nc.user.suspendedAt;
          const user = { id: nc.user.id, email: nc.user.email, name: nc.user.name, timezone: nc.user.timezone ?? undefined, suspended, emailVerified: nc.user.emailVerified, plan: nc.workspaces[0]?.plan ?? "free", planSource: null, sessionCount: 0, deleting: false };
          return (
            <div className="space-y-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h1 className="break-words text-2xl font-semibold">{nc.user.name ?? nc.user.email}</h1>
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
                    {nc.user.name && <span>{nc.user.email}</span>}
                    <Badge tone={suspended ? "danger" : "success"}>{suspended ? "Suspended" : "Active"}</Badge>
                    {nc.user.isStaff && <Badge tone="info">Admin</Badge>}
                    <Badge tone={nc.user.emailVerified ? "success" : "warning"}>{nc.user.emailVerified ? "Email confirmed" : "Email not confirmed"}</Badge>
                  </p>
                </div>
                <RowMenu label="Actions for this account" items={userMenuItems(user, setDialog)} trigger="Actions ▾" />
              </div>
              <Card>
                <CardHeader title="Account" />
                <dl className="grid gap-x-6 gap-y-3 p-5 text-sm sm:grid-cols-2">
                  <Row label="Joined">{fmtUtc(nc.user.createdAt)}</Row>
                  <Row label="Time zone">{nc.user.timezone ?? "–"}</Row>
                  <Row label="Staff">{nc.user.isStaff ? "Yes" : "No"}</Row>
                  <Row label="Suspended">{nc.user.suspendedAt ? fmtUtc(nc.user.suspendedAt) : "No"}</Row>
                </dl>
                <p className="flex items-center gap-2 border-t border-border px-5 py-3 text-xs text-muted"><Lock aria-hidden className="size-3.5 shrink-0" /> Recordings and documents aren&rsquo;t visible to admins.</p>
              </Card>
              <Card>
                <CardHeader title="Workspaces" />
                {nc.workspaces.length === 0 ? <p className="p-5 text-sm text-muted">No workspaces.</p> : (
                  <ul className="divide-y divide-border text-sm">
                    {nc.workspaces.map((w) => <li key={w.id} className="flex items-center justify-between gap-3 px-5 py-3"><span className="truncate font-medium">{w.id.slice(0, 8)} · {w.plan} · {w.role}</span><Badge tone={w.processingPaused ? "warning" : "success"}>{w.processingPaused ? "paused" : "active"}</Badge></li>)}
                  </ul>
                )}
              </Card>
              <UserDialogs user={user} dialog={dialog} onClose={() => setDialog(null)} onDone={(message) => { toasts.push({ tone: "success", message }); res.reload(); }} />
              <ToastStack items={toasts.items} onDismiss={toasts.dismiss} />
            </div>
          );
        }
        const suspended = (c as Customer).status === "suspended";
        const user = { id, email: (c as Customer).email, name: (c as Customer).name, timezone: (c as Customer).timezone, suspended, emailVerified: (c as Customer).emailVerified, plan: (c as Customer).plan.plan, planSource: (c as Customer).plan.source, sessionCount: (c as Customer).sessions.length, deleting: !!(c as Customer).deletion };
        return (
          <div className="space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h1 className="break-words text-2xl font-semibold">{c.name ?? c.email}</h1>
                <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
                  {c.name && <span>{c.email}</span>}
                  <Badge tone={suspended ? "danger" : "success"}>{suspended ? "Suspended" : "Active"}</Badge>
                  {c.staff && <Badge tone="info">Admin</Badge>}
                  <Badge tone={c.emailVerified ? "success" : "warning"}>{c.emailVerified ? "Email confirmed" : "Email not confirmed"}</Badge>
                </p>
              </div>
              <RowMenu label="Actions for this account" items={userMenuItems(user, setDialog)} trigger="Actions ▾" />
            </div>

            {suspended && <Notice tone="danger"><strong>Suspended.</strong> {c.suspendedReason ?? ""}</Notice>}
            {c.deletion && <Notice tone="warning">Being deleted ({c.deletion.status.replace("_", " ")}). Minutes and plans are locked.</Notice>}

            <Card>
              <CardHeader title="Account" />
              <dl className="grid gap-x-6 gap-y-3 p-5 text-sm sm:grid-cols-2">
                <Row label="Joined">{fmtUtc(c.createdAt)}</Row>
                <Row label="Last seen">{c.lastActiveAt ? fmtUtc(c.lastActiveAt) : "Never"}</Row>
                <Row label="Time zone">{c.timezone}</Row>
                <Row label="Signs in with">{c.providers.length ? c.providers.join(", ") : "–"}</Row>
                <Row label="Recordings">{c.counts.captures}</Row>
                <Row label="Documents">{c.counts.documents}</Row>
              </dl>
              <p className="flex items-center gap-2 border-t border-border px-5 py-3 text-xs text-muted"><Lock aria-hidden className="size-3.5 shrink-0" /> Recordings and documents aren&rsquo;t visible to admins.</p>
            </Card>

            <Card>
              <CardHeader title="Plan and minutes" />
              <dl className="grid gap-x-6 gap-y-3 p-5 text-sm sm:grid-cols-2">
                <Row label="Plan"><span className="capitalize">{c.plan.plan}</span>{c.plan.status === "none" ? "" : ` · ${c.plan.status.replace("_", " ")}`}{c.plan.source === "staff" ? " · given by an admin" : ""}</Row>
                <Row label="Ends or renews">{fmtUtc(c.plan.graceUntil ?? c.plan.renewsAt)}</Row>
                <Row label="Used this month">{formatMinutes(c.allowance.usedMinutes)} of {formatMinutes(c.allowance.allowanceMinutes)}</Row>
                <Row label="Minutes left">{formatMinutes(c.allowance.remainingMinutes)} (resets {fmtUtc(c.allowance.resetsAt)})</Row>
              </dl>
              <p className="border-t border-border px-5 py-3 text-xs text-muted">Payments are handled in the store.</p>
            </Card>

            <DevicesAndWorkspaces user={c} />

            <Card>
              <details className="group">
                <summary className="cursor-pointer list-none px-5 py-4 text-sm font-medium marker:hidden [&::-webkit-details-marker]:hidden">
                  History and more details <span className="ml-1 text-xs font-normal text-muted group-open:hidden">Show</span><span className="ml-1 hidden text-xs font-normal text-muted group-open:inline">Hide</span>
                </summary>
                <div className="space-y-5 border-t border-border p-5 text-sm">
                  <div>
                    <h3 className="font-medium">Minutes and plan changes</h3>
                    <DataTable label="Minutes and plan changes" narrow>
                      <thead><tr><Th>When</Th><Th>Minutes</Th><Th>Ends</Th><Th>Why</Th></tr></thead>
                      <tbody>
                        {c.grants.length === 0 && <tr><Td className="text-muted">None yet.</Td><Td /><Td /><Td /></tr>}
                        {c.grants.map((g) => (
                          <tr key={g.id}><Td className="whitespace-nowrap">{fmtUtc(g.createdAt)}</Td><Td className="tabular-nums">{g.minutes > 0 ? "+" : ""}{g.minutes}</Td><Td className="whitespace-nowrap">{fmtUtc(g.expiresAt)}</Td><Td className="max-w-xs break-words">{g.reason ?? g.reference ?? "–"}</Td></tr>
                        ))}
                      </tbody>
                    </DataTable>
                  </div>
                  <div>
                    <h3 className="font-medium">Calendars</h3>
                    {c.connections.length === 0 ? <p className="text-muted">None connected.</p> : (
                      <ul className="mt-1 space-y-1">{c.connections.map((k) => <li key={k.id} className="flex items-center gap-2">{k.provider} · {k.calendars} {k.calendars === 1 ? "calendar" : "calendars"} <Badge tone={k.status === "connected" ? "success" : "warning"}>{k.status === "connected" ? "Working" : "Needs reconnecting"}</Badge></li>)}</ul>
                    )}
                  </div>
                  <div>
                    <h3 className="font-medium">Recent processing</h3>
                    {c.recentJobs.length === 0 ? <p className="text-muted">None.</p> : (
                      <ul className="mt-1 space-y-1">{c.recentJobs.map((j) => <li key={j.id}>{taskName(j.kind)} · {j.status.replace("_", " ")} · {fmtUtc(j.updatedAt)}</li>)}</ul>
                    )}
                  </div>
                  <p className="text-xs text-muted">Account id: <code className="break-all">{c.id}</code>{c.plan.storeReference ? <> · Store reference: <code>{c.plan.storeReference}</code></> : null} · <span title="Short form used in lists">{shortId(c.id)}</span></p>
                </div>
              </details>
            </Card>

            <UserDialogs user={user} dialog={dialog} onClose={() => setDialog(null)} onDone={(message) => { toasts.push({ tone: "success", message }); res.reload(); }} />
            <ToastStack items={toasts.items} onDismiss={toasts.dismiss} />
          </div>
        );
      }}
    </ResourceBoundary>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 break-words">{children}</dd>
    </div>
  );
}
