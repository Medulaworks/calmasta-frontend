"use client";

import { Card, CardHeader } from "@/components/ui/card";
import { type Json, adminPatch, adminPost, fmtUtc } from "@/lib/admin-client";
import { type CapabilityState, capability } from "@/lib/admin-capabilities";
import type { UserExtras } from "@/lib/admin-types";
import { formatMinutes } from "@/lib/status";
import { ActionDialog } from "./ui";
import type { MenuItem } from "./row-menu";

type Extras = Json<UserExtras>;

export type UserDialogKind = "edit" | "suspend" | "reactivate" | "revoke" | "recovery" | "verification" | "add_minutes" | "take_minutes" | "grant_pro" | "end_pro";

/** What the actions need to know about someone. Everything past `email` is optional: a list row knows less than the account page. */
export interface UserLike {
  id: string;
  email: string;
  name?: string | null;
  timezone?: string;
  suspended?: boolean;
  emailVerified?: boolean;
  plan?: string;
  /** "staff" when the plan was given by staff rather than bought in the store. */
  planSource?: string | null;
  sessionCount?: number;
  deleting?: boolean;
}

const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
const gate = (c: CapabilityState): Pick<MenuItem, "disabled" | "reason"> => ({ disabled: !c.allowed, reason: c.reason });

/**
 * Everything staff can do to one account, as the items of a "⋯" menu: the same list on the Users table, the plans table
 * and the account page. An item that can't be used stays visible and says why, so nobody hunts for a missing button.
 */
export function userMenuItems(u: UserLike, open: (d: UserDialogKind) => void, openHref?: string): MenuItem[] {
  const edit = capability("user_edit_profile");
  const suspend = capability("user_suspend");
  const sessions = capability("user_revoke_sessions");
  const mail = capability("user_send_mail");
  const gone = u.deleting;
  const deleting = "This account is being deleted.";
  const items: MenuItem[] = [];
  if (openHref) items.push({ label: "Open account", href: openHref });
  if (u.timezone !== undefined) items.push({ label: "Edit name and time zone…", onSelect: () => open("edit"), ...gate(edit) });
  items.push({ label: "Send password reset email", onSelect: () => open("recovery"), divider: items.length > 0, ...gate(mail) });
  if (u.emailVerified === false) items.push({ label: "Resend confirm-email message", onSelect: () => open("verification"), ...gate(mail) });
  if (u.sessionCount !== 0) items.push({ label: "Sign out of all devices…", onSelect: () => open("revoke"), ...gate(sessions) });
  items.push({ label: "Add minutes…", onSelect: () => open("add_minutes"), divider: true, disabled: gone, reason: gone ? deleting : null });
  items.push({ label: "Remove minutes…", onSelect: () => open("take_minutes"), disabled: gone, reason: gone ? deleting : null });
  if (u.planSource === "staff" && u.plan !== "free") items.push({ label: "End the Pro we gave them…", onSelect: () => open("end_pro") });
  else if (u.plan === "free") items.push({ label: "Give Pro for a while…", onSelect: () => open("grant_pro"), disabled: gone, reason: gone ? deleting : null });
  items.push(u.suspended
    ? { label: "Turn account back on…", onSelect: () => open("reactivate"), divider: true, ...gate(suspend) }
    : { label: "Suspend account…", onSelect: () => open("suspend"), danger: true, divider: true, ...gate(suspend) });
  return items;
}

/** The confirm dialogs behind those menu items. Every one asks why and is recorded in Activity. */
const key = () => crypto.randomUUID().replace(/-/g, "").slice(0, 16).padEnd(8, "0");
export function UserDialogs({ user, dialog, onClose, onDone }: { user: UserLike; dialog: UserDialogKind | null; onClose: () => void; onDone: (message: string) => void }) {
  if (!dialog) return null;
  const id = user.id;
  const act = (action: string, done: string) => async (v: Record<string, string>) => {
    await adminPost(`/api/admin/customers/${id}/actions`, { action, reason: v.reason }, { "Idempotency-Key": key() });
    onDone(done);
  };
  const entitle = (action: string, done: string) => async (v: Record<string, string>) => {
    const body: Record<string, unknown> = { action, reason: v.reason };
    if (v.minutes) body.minutes = Number(v.minutes);
    // Dates are picked as a day; the grant runs to the end of that day, UTC.
    if (v.expiresAt) body.expiresAt = `${v.expiresAt}T23:59:59.000Z`;
    await adminPost(`/api/admin/entitlements/${id}`, body);
    onDone(done);
  };
  const ends = { name: "expiresAt", label: "Ends on", type: "date" as const, defaultValue: inDays(30), hint: "Up to a year ahead." };
  const who = <strong className="font-medium text-foreground">{user.email}</strong>;

  switch (dialog) {
    case "edit":
      return <ActionDialog title="Edit name and time zone" description="The email can't be changed here." confirmLabel="Save" fields={[{ name: "name", label: "Name", defaultValue: user.name ?? "" }, { name: "timezone", label: "Time zone", defaultValue: user.timezone ?? "", hint: "For example Europe/London or America/New_York." }]} onClose={onClose} onSubmit={async (v) => { await adminPatch(`/api/admin/customers/${id}`, { name: v.name.trim() || undefined, timezone: v.timezone.trim() || undefined, reason: v.reason }, { "Idempotency-Key": key() }); onDone("Saved."); }} />;
    case "suspend":
      return <ActionDialog danger title="Suspend this account?" description={<>{who} can&rsquo;t sign in until you turn the account back on. Nothing is deleted.</>} confirmLabel="Suspend account" onClose={onClose} onSubmit={act("suspend", "Account suspended.")} />;
    case "reactivate":
      return <ActionDialog title="Turn this account back on?" description={<>{who} can sign in again.</>} confirmLabel="Turn back on" onClose={onClose} onSubmit={act("reactivate", "Account is back on.")} />;
    case "revoke":
      return <ActionDialog danger title="Sign out of all devices?" description="Signs them out on every device." confirmLabel="Sign out everywhere" onClose={onClose} onSubmit={act("revoke_sessions", "Signed out of all devices.")} />;
    case "recovery":
      return <ActionDialog title="Send a password reset email?" description={<>Emails {who} a one-time code.</>} confirmLabel="Send email" onClose={onClose} onSubmit={act("send_recovery", "Password reset email sent.")} />;
    case "verification":
      return <ActionDialog title="Resend the confirm email?" description={<>Emails {who} a new confirm code.</>} confirmLabel="Send email" onClose={onClose} onSubmit={act("send_verification", "Message sent.")} />;
    case "add_minutes":
      return <ActionDialog title="Add minutes" description="Extra minutes until the end date. Free." confirmLabel="Add minutes" fields={[{ name: "minutes", label: "How many minutes", type: "number", min: 1, max: 6000 }, ends]} onClose={onClose} onSubmit={entitle("grant", "Minutes added.")} />;
    case "take_minutes":
      return <ActionDialog danger title="Remove minutes" description="Takes minutes away. Nothing is refunded." confirmLabel="Remove minutes" fields={[{ name: "minutes", label: "How many minutes", type: "number", min: 1, max: 6000 }]} onClose={onClose} onSubmit={entitle("correct", "Minutes removed.")} />;
    case "grant_pro":
      return <ActionDialog title="Give Pro for a while" description="Pro until the end date, then back to Free. Free of charge." confirmLabel="Give Pro" fields={[ends]} onClose={onClose} onSubmit={entitle("grant_pro", "Pro given.")} />;
    case "end_pro":
      return <ActionDialog danger title="End the Pro we gave them?" description="Back to Free now. Their work is kept." confirmLabel="End Pro" onClose={onClose} onSubmit={entitle("clear_pro", "Pro ended.")} />;
  }
}

/** Signed-in devices and workspaces on the account page. */
export function DevicesAndWorkspaces({ user }: { user: Extras }) {
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <Card>
        <CardHeader title="Signed-in devices" />
        {user.sessions.length === 0 ? <p className="p-5 text-sm text-muted">Not signed in anywhere.</p> : (
          <ul className="divide-y divide-border text-sm">
            {user.sessions.map((s) => (
              <li key={s.id} className="px-5 py-3">
                <p className="font-medium">{s.device}</p>
                <p className="text-xs text-muted">Last seen {fmtUtc(s.lastSeenAt)}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card>
        <CardHeader title="Workspaces" />
        <ul className="divide-y divide-border text-sm">
          {user.workspaces.map((w) => {
            const pct = w.allowanceSeconds > 0 ? Math.min(100, Math.round((w.usedSeconds / w.allowanceSeconds) * 100)) : 0;
            return (
              <li key={w.id} className="space-y-2 px-5 py-3">
                <div className="flex items-center justify-between gap-3"><span className="font-medium">{w.name}</span><span className="text-xs capitalize text-muted">{w.role}</span></div>
                <div role="img" aria-label={`${pct}% of the allowance used`} className="h-2 overflow-hidden rounded-full bg-border"><div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} /></div>
                <p className="text-xs text-muted">{formatMinutes(Math.round(w.usedSeconds / 60))} of {formatMinutes(Math.round(w.allowanceSeconds / 60))} used{w.processingPaused ? " · paused" : ""}</p>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}
