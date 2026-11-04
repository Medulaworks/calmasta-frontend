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
import { DataTable, ResourceBoundary, SimpleDialog, Td, Th, useResource } from "./ui";

type Member = Json<AdminMember>;
type Invite = Json<AdminInvite>;

const field = "mt-1.5 block h-10 w-full rounded-lg border border-border bg-background px-3 text-sm";
const EMAIL = /^\S+@\S+\.\S+$/;
const daysLeft = (iso: string) => Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);

/**
 * Who can use the staff area. People are added by invitation: you enter an email, they get a link, and they become an admin
 * only when they accept it. Nothing here needs a typed reason or a password; the sign-in to the staff area is the proof.
 */
export function AdminsView() {
  const res = useResource<Json<AdminList>>("/api/admin/staff");
  const toasts = useToasts("admins");
  const can = capability("staff_manage");
  const [inviting, setInviting] = useState(false);
  const [removing, setRemoving] = useState<Member | null>(null);
  const [cancelling, setCancelling] = useState<Invite | null>(null);

  async function resend(i: Invite) {
    try {
      await adminPost(`/api/admin/staff/invites/${i.id}/resend`, {});
      toasts.push({ tone: "success", message: `Invite sent again to ${i.email}.` });
      res.reload();
    } catch (err) {
      toasts.push({ tone: "danger", message: err instanceof Error ? err.message : "Couldn't send it again." });
    }
  }

  return (
    <ResourceBoundary resource={res}>
      {({ admins, invites }) => {
        const lastOne = admins.length <= 1;
        const adminMenu = (a: Member) => [
          { label: "Open account", href: `/admin/customers/${a.id}`, disabled: a.id.startsWith("p-"), reason: "No account page for this sample person." },
          { label: "Remove admin…", onSelect: () => setRemoving(a), danger: true, divider: true, disabled: !can.allowed || a.you || lastOne, reason: !can.allowed ? can.reason : a.you ? "You can't remove yourself. Ask another admin." : "There must always be at least one admin." },
        ];
        const inviteMenu = (i: Invite) => [
          { label: daysLeft(i.expiresAt) <= 0 ? "Send a new invite" : "Resend invite", onSelect: () => void resend(i), disabled: !can.allowed, reason: can.reason },
          { label: "Cancel invite…", onSelect: () => setCancelling(i), danger: true, divider: true, disabled: !can.allowed, reason: can.reason },
        ];
        return (
          <div className="space-y-8">
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
                description={<>They lose admin access now. Their Jooba account stays.</>}
                confirmLabel="Remove admin"
                busyLabel="Removing…"
                onClose={() => setRemoving(null)}
                onSubmit={async () => {
                  await adminPost(`/api/admin/staff/${removing.id}/remove`, {});
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
                  await adminPost(`/api/admin/staff/invites/${cancelling.id}/cancel`, {});
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
  const [note, setNote] = useState("");
  const [noting, setNoting] = useState(false);
  const clean = email.trim();
  const touched = clean.length > 3 && !EMAIL.test(clean);

  return (
    <SimpleDialog
      title="Invite an admin"
      description="They get an email link that works for 7 days."
      confirmLabel="Send invite"
      busyLabel="Sending…"
      canSubmit={EMAIL.test(clean)}
      onClose={onClose}
      onSubmit={async () => {
        await adminPost("/api/admin/staff/invites", { email: clean, ...(note.trim() ? { note: note.trim() } : {}) });
        onSent(clean);
      }}
    >
      <label className="block text-sm">
        <span className="font-medium">Email address</span>
        <input type="email" autoComplete="off" inputMode="email" spellCheck={false} placeholder="name@company.com" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={touched} className={field} />
        {touched && <span role="alert" className="mt-1 block text-xs text-danger">Enter a full email address, like name@company.com.</span>}
      </label>
      {noting ? (
        <label className="block text-sm">
          <span className="font-medium">Personal note <span className="font-normal text-muted">(optional)</span></span>
          <textarea rows={3} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Included in the email" className={`${field} h-auto py-2`} />
        </label>
      ) : (
        <button type="button" onClick={() => setNoting(true)} className="text-sm text-muted underline underline-offset-2 hover:text-foreground">Add a personal note</button>
      )}
    </SimpleDialog>
  );
}
