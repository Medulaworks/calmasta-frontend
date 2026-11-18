"use client";

import { Mail, Plus } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ToastStack, useToasts } from "@/components/ui/toast";
import { type Json, adminPost, fmtUtc } from "@/lib/admin-client";
import { capability } from "@/lib/admin-capabilities";
import type { AdminInvite, AdminList, AdminMember } from "@/lib/admin-types";
import { ClickRow, MenuTd, RowMenu, RowOpen } from "./row-menu";
import { DataTable, ResourceBoundary, SelectField, SimpleDialog, Td, Th, inputClass, useResource } from "./ui";

type Member = Json<AdminMember>;
type Invite = Json<AdminInvite>;

const field = `mt-2 ${inputClass}`;
const EMAIL = /^\S+@\S+\.\S+$/;
const daysLeft = (iso: string) => Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
const key = () => crypto.randomUUID().replace(/-/g, "").slice(0, 16).padEnd(8, "0");

export function AdminsView() {
  const res = useResource<Json<AdminList> & { items?: Array<{ id: string; role: string; name: string | null; email: string; active: boolean }> }>("/api/admin/staff");
  const toasts = useToasts("admins");
  const can = capability("staff_manage");
  const [inviting, setInviting] = useState(false);
  const [removing, setRemoving] = useState<Member | null>(null);
  const [cancelling, setCancelling] = useState<Invite | null>(null);

  async function resend(i: Invite) {
    try {
      await adminPost(`/api/admin/staff/invites/${i.id}/resend`, { reason: "Resend staff invite" }, { "Idempotency-Key": key() });
      toasts.push({ tone: "success", message: `Invite sent again to ${i.email}.` });
      res.reload();
    } catch (err) {
      toasts.push({ tone: "danger", message: err instanceof Error ? err.message : "Couldn’t send it again." });
    }
  }

  return (
    <ResourceBoundary resource={res}>
      {(data: Json<AdminList> & { items?: Array<{ id: string; role: string; name: string | null; email: string; active: boolean }> }) => {
        // New shape: {items, nextCursor} vs old {admins, invites}
        const isNew = Array.isArray((data as { items?: unknown[] }).items);
        const admins: Member[] = isNew ? (data as { items: Array<{ id: string; name: string | null; email: string }> }).items.map((it) => ({ id: it.id, email: it.email, name: it.name, addedAt: null, addedBy: null, lastSignInAt: null, you: false })) : (data as Json<AdminList>).admins;
        const invites: Invite[] = isNew ? [] : (data as Json<AdminList>).invites;
        const lastOne = admins.length <= 1;
        const adminMenu = (a: Member) => [
          { label: "Open account", href: `/admin/customers/${a.id}`, disabled: a.id.startsWith("p-"), reason: "No account page for this sample person." },
          { label: "Remove admin…", onSelect: () => setRemoving(a), danger: true, divider: true, disabled: !can.allowed || a.you || lastOne, reason: !can.allowed ? can.reason : a.you ? "You can’t remove yourself. Ask another admin." : "There must always be at least one admin." },
        ];
        const inviteMenu = (i: Invite) => [
          { label: daysLeft(i.expiresAt) <= 0 ? "Send a new invite" : "Resend invite", onSelect: () => void resend(i), disabled: !can.allowed, reason: can.reason },
          { label: "Cancel invite…", onSelect: () => setCancelling(i), danger: true, divider: true, disabled: !can.allowed, reason: can.reason },
        ];
        return (
          <div className="space-y-6">
            <section aria-labelledby="adm" className="space-y-4">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 id="adm" className="text-sm font-semibold">Admins <span className="font-normal text-muted">({admins.length})</span></h2>
                </div>
                <Button variant="primary" disabled={!can.allowed} title={can.reason ?? undefined} onClick={() => setInviting(true)}><Plus aria-hidden className="size-4" /> Invite admin</Button>
              </div>
              {admins.length === 0 ? (
                <Card><EmptyState title="No admins yet" body="The first admin is set up by the tech team." /></Card>
              ) : (
                <DataTable label="Admins">
                  <thead><tr><Th>Admin</Th><Th>Added</Th><Th wide>Last signed in</Th><Th><span className="sr-only">Actions</span></Th></tr></thead>
                  <tbody>
                    {admins.map((a) => {
                      const open = a.id.startsWith("p-") ? undefined : `/admin/customers/${a.id}`;
                      return (
                        <ClickRow key={a.id} href={open}>
                          <Td>
                            <span className="flex flex-wrap items-center gap-2">
                              {open ? <RowOpen href={open}>{a.name ?? a.email}</RowOpen> : <span className="font-medium">{a.name ?? a.email}</span>}
                              {a.you && <Badge tone="info">You</Badge>}
                            </span>
                            {a.name && <span className="block text-xs text-muted">{a.email}</span>}
                          </Td>
                          <Td className="text-muted">{a.addedAt ? fmtUtc(a.addedAt) : "–"}{a.addedBy && <span className="block text-xs">by {a.addedBy}</span>}</Td>
                          <Td wide className="whitespace-nowrap text-muted">{a.lastSignInAt ? fmtUtc(a.lastSignInAt) : "Not yet"}</Td>
                          <MenuTd><RowMenu label={`Actions for ${a.email}`} items={adminMenu(a)} /></MenuTd>
                        </ClickRow>
                      );
                    })}
                  </tbody>
                </DataTable>
              )}
            </section>

            {invites.length > 0 && (
              <section aria-labelledby="inv" className="space-y-3">
                <h2 id="inv" className="text-sm font-semibold">Invites waiting <span className="font-normal text-muted">({invites.length})</span></h2>
                <DataTable label="Invites waiting">
                  <thead><tr><Th>Email</Th><Th>Status</Th><Th wide>Sent</Th><Th><span className="sr-only">Actions</span></Th></tr></thead>
                  <tbody>
                    {invites.map((i) => {
                      const left = daysLeft(i.expiresAt);
                      return (
                        <tr key={i.id}>
                          <Td><span className="inline-flex items-center gap-2 font-medium"><Mail aria-hidden className="size-4 text-muted" />{i.email}</span></Td>
                          <Td>{left <= 0 ? <Badge tone="warning">Expired</Badge> : <><Badge tone="info">Waiting</Badge><span className="mt-1 block text-xs text-muted">Expires in {left} {left === 1 ? "day" : "days"}</span></>}</Td>
                          <Td wide className="text-muted">{fmtUtc(i.invitedAt)}<span className="block text-xs">by {i.invitedBy}</span></Td>
                          <MenuTd><RowMenu label={`Actions for the invite to ${i.email}`} items={inviteMenu(i)} /></MenuTd>
                        </tr>
                      );
                    })}
                  </tbody>
                </DataTable>
              </section>
            )}

            {inviting && <InviteDialog onClose={() => setInviting(false)} onSent={(email) => { toasts.push({ tone: "success", message: `Invite sent to ${email}.` }); res.reload(); }} />}
            {removing && (
              <SimpleDialog
                danger
                title={`Remove ${removing.name ?? removing.email}?`}
                description={<>They lose admin access now. Their Joobah account stays.</>}
                confirmLabel="Remove admin"
                busyLabel="Removing…"
                onClose={() => setRemoving(null)}
                onSubmit={async () => {
                  await adminPost(`/api/admin/staff/${removing.id}/remove`, { reason: "Remove staff member" }, { "Idempotency-Key": key() });
                  toasts.push({ tone: "success", message: `${removing.email} is no longer an admin.` });
                  res.reload();
                }}
              />
            )}
            {cancelling && (
              <SimpleDialog
                danger
                title="Cancel this invite?"
                description={<>The link sent to <strong className="font-medium text-foreground">{cancelling.email}</strong> stops working.</>}
                confirmLabel="Cancel invite"
                busyLabel="Cancelling…"
                onClose={() => setCancelling(null)}
                onSubmit={async () => {
                  await adminPost(`/api/admin/staff/invites/${cancelling.id}/cancel`, { reason: "Cancel staff invite" }, { "Idempotency-Key": key() });
                  toasts.push({ tone: "success", message: "Invite cancelled." });
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

function InviteDialog({ onClose, onSent }: { onClose: () => void; onSent: (email: string) => void }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("viewer");
  const [reason, setReason] = useState("");
  const clean = email.trim();
  const touched = clean.length > 3 && !EMAIL.test(clean);

  return (
    <SimpleDialog
      title="Invite an admin"
      description="They get an email link that expires in 48 hours. The link itself is never shown here."
      confirmLabel="Send invite"
      busyLabel="Sending…"
      canSubmit={EMAIL.test(clean) && reason.trim().length > 0}
      onClose={onClose}
      onSubmit={async () => {
        await adminPost("/api/admin/staff/invites", { email: clean, role, reason: reason.trim() }, { "Idempotency-Key": key() });
        onSent(clean);
      }}
    >
      <label className="block text-sm">
        <span className="font-medium">Email address</span>
        <input type="email" autoComplete="off" inputMode="email" spellCheck={false} placeholder="me@joobah.com" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={touched} className={field} />
        {touched && <span role="alert" className="mt-1 block text-xs text-danger">Enter a full email address, like name@company.com.</span>}
      </label>
      <label className="block text-sm">
        <span className="font-medium">Role</span>
        <SelectField value={role} onChange={(e) => setRole(e.target.value)} className="mt-2">
          <option value="viewer">Viewer</option>
          <option value="operator">Operator</option>
          <option value="owner">Owner</option>
        </SelectField>
      </label>
      <label className="block text-sm">
        <span className="font-medium">Reason (required, no secrets)</span>
        <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} placeholder="Why invite this person" className={field} />
      </label>
    </SimpleDialog>
  );
}
