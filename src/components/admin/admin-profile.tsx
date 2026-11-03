"use client";

import { LogOut } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { ToastStack, useToasts } from "@/components/ui/toast";
import { type Json, fmtUtc } from "@/lib/admin-client";
import { ADMIN_PREVIEW } from "@/lib/admin-preview";
import type { AdminList, AuditPage } from "@/lib/admin-types";
import { type ProfileView, getProfile, saveProfile } from "@/lib/profile-client";
import { leaveStaffArea, previewProfile } from "./staff-session";
import { Notice, usePaged, useResource } from "./ui";

const field = "h-9 w-full rounded-lg border border-border bg-background px-3 text-sm";
let previewName: string | null = null;

/** The signed-in admin: their details (the name can be changed here), how long this staff sign-in lasts, and what they did lately. */
export function AdminProfile() {
  const router = useRouter();
  const toasts = useToasts("admin-profile");
  const [profile, setProfile] = useState<ProfileView | null>(() => (ADMIN_PREVIEW ? { ...previewProfile(), name: previewName ?? "Preview Admin" } : null));
  const [failed, setFailed] = useState(false);
  const [name, setName] = useState(profile?.name ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (ADMIN_PREVIEW) return;
    let off = false;
    getProfile().then((p) => { if (!off) { setProfile(p); setName(p.name ?? ""); } }, () => !off && setFailed(true));
    return () => { off = true; };
  }, []);

  const admins = useResource<Json<AdminList>>("/api/admin/staff");
  const me = admins.data?.admins.find((a) => a.you);
  const mine = usePaged<Json<AuditPage>["entries"][number], Json<AuditPage>>(profile ? `/api/admin/audit?q=${encodeURIComponent(profile.email)}` : null, (p) => p.entries);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const next = name.trim();
    setSaving(true);
    try {
      if (ADMIN_PREVIEW) { previewName = next || null; setProfile((p) => (p ? { ...p, name: next || null } : p)); }
      else setProfile(await saveProfile({ name: next || null }));
      toasts.push({ tone: "success", message: "Name saved." });
    } catch (err) {
      toasts.push({ tone: "danger", message: err instanceof Error ? err.message : "Couldn't save your name." });
    } finally {
      setSaving(false);
    }
  }

  async function signOut() {
    await leaveStaffArea();
    router.replace("/admin/login");
  }

  if (failed) return <Notice tone="danger">Couldn&rsquo;t load your profile. Refresh to try again.</Notice>;
  if (!profile) return <div role="status" aria-label="Loading" aria-busy="true" className="h-64 jb-skel rounded-xl border border-border bg-surface" />;
  const initial = (profile.name || profile.email).trim().charAt(0).toUpperCase();

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex items-center gap-4 p-5">
          <span aria-hidden className="grid size-14 shrink-0 place-items-center rounded-full bg-accent/10 text-xl font-semibold text-accent">{initial}</span>
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold">{profile.name || profile.email}</p>
            <p className="flex flex-wrap items-center gap-2 text-sm text-muted"><span className="truncate">{profile.email}</span><Badge tone="info">Admin</Badge></p>
          </div>
        </div>
        <form onSubmit={save} className="space-y-4 border-t border-border p-5">
          <label className="block text-sm">
            <span className="font-medium">Name</span>
            <span className="mt-1.5 flex gap-2">
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="How your name appears in Activity" className={`${field} max-w-sm`} />
              <Button type="submit" variant="primary" disabled={saving || name.trim() === (profile.name ?? "")}>{saving ? "Saving…" : "Save"}</Button>
            </span>
          </label>
          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            <div><dt className="text-xs text-muted">Email</dt><dd className="mt-0.5">{profile.email}</dd></div>
            <div><dt className="text-xs text-muted">Time zone</dt><dd className="mt-0.5">{profile.timezone}</dd></div>
            <div><dt className="text-xs text-muted">Admin since</dt><dd className="mt-0.5">{me?.addedAt ? `${fmtUtc(me.addedAt)}${me.addedBy ? ` · added by ${me.addedBy}` : ""}` : "–"}</dd></div>
          </dl>
          <p className="text-xs"><Link href="/dashboard/profile" target="_blank" rel="noopener noreferrer" className="text-muted underline hover:text-foreground">Change email or password</Link></p>
        </form>
      </Card>

      <Card>
        <CardHeader title="Session" />
        <div className="flex flex-wrap items-center justify-between gap-3 p-5 text-sm">
          <p className="text-muted">{profile.staffSessionUntil ? <>Signed in until <span className="text-foreground">{fmtUtc(profile.staffSessionUntil)}</span>.</> : "Signed in."}</p>
          <Button onClick={() => void signOut()}><LogOut aria-hidden className="size-4" /> Log out</Button>
        </div>
      </Card>

      <Card>
        <CardHeader title="Recent activity" />
        {mine.status !== "ready" ? (
          <p className="p-5 text-sm text-muted">{mine.status === "loading" ? "Loading…" : mine.status === "unavailable" ? "Not available yet." : "Couldn’t load this."}</p>
        ) : mine.rows.length === 0 ? (
          <p className="p-5 text-sm text-muted">Nothing yet.</p>
        ) : (
          <ul className="divide-y divide-border text-sm">
            {mine.rows.slice(0, 6).map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                <span>{e.action}{e.reason && <span className="block text-xs text-muted">{e.reason}</span>}</span>
                <span className="whitespace-nowrap text-xs text-muted">{fmtUtc(e.at)}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="border-t border-border px-5 py-3 text-xs"><Link href="/dashboard/admin/audit" className="text-muted underline hover:text-foreground">See all activity</Link></p>
      </Card>
      <ToastStack items={toasts.items} onDismiss={toasts.dismiss} />
    </div>
  );
}
