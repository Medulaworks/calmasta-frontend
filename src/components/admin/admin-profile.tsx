"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { ToastStack, useToasts } from "@/components/ui/toast";
import { type Json, fmtUtc } from "@/lib/admin-client";
import type { AdminList, AuditPage } from "@/lib/admin-types";
import { type ProfileView, getProfile, saveProfile } from "@/lib/profile-client";
import { Avatar } from "@/components/ui/avatar";
import { actionLabel } from "@/lib/admin-words";
import { Notice, inputClass, usePaged, useResource } from "./ui";

const field = inputClass;

/** The signed-in admin: their details (the name can be changed here), their existing Joobah session, and available activity. */
export function AdminProfile() {
  const router = useRouter();
  const toasts = useToasts("admin-profile");
  const [profile, setProfile] = useState<ProfileView | null>(null);
  const [failed, setFailed] = useState(false);
  const [name, setName] = useState(profile?.name ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let off = false;
    getProfile().then((p) => { if (!off) { setProfile(p); setName(p.name ?? ""); } }, () => !off && setFailed(true));
    return () => { off = true; };
  }, []);

  const admins = useResource<Json<AdminList>>("/api/admin/staff");
  // The live API sends { items, nextCursor } (no "you" flag); the sample data sends { admins }. Anything else means "unknown".
  const raw = admins.data as unknown as { admins?: unknown; items?: unknown } | unknown[] | null;
  const list = Array.isArray(raw) ? raw : Array.isArray(raw?.admins) ? raw.admins : Array.isArray(raw?.items) ? raw.items : [];
  const me = (list as Array<{ you?: boolean; email?: string; addedAt?: string | null; addedBy?: string | null }>).find((a) => a?.you || (!!profile && a?.email?.toLowerCase() === profile.email.toLowerCase()));
  const mine = usePaged<Json<AuditPage>["entries"][number], Json<AuditPage>>(profile ? `/api/admin/audit?q=${encodeURIComponent(profile.email)}` : null, (p) => p.entries);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const next = name.trim();
    setSaving(true);
    try {
      setProfile(await saveProfile({ name: next || null }));
      toasts.push({ tone: "success", message: "Name saved." });
    } catch (err) {
      toasts.push({ tone: "danger", message: err instanceof Error ? err.message : "Couldn’t save your name." });
    } finally {
      setSaving(false);
    }
  }

  async function signOut() {
    router.push("/dashboard");
  }

  if (failed) return <Notice tone="danger">Couldn&rsquo;t load your profile. Refresh to try again.</Notice>;
  if (!profile) return <div role="status" aria-label="Loading" aria-busy="true" className="h-64 jb-skel rounded-xl border border-border bg-surface" />;

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex items-center gap-4 p-5">
          <Avatar name={profile.name || profile.email} src={(profile as { avatarUrl?: string | null }).avatarUrl ?? null} size={56} className="ring-4 ring-accent/10" />
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold">{profile.name || profile.email}</p>
            <p className="flex flex-wrap items-center gap-2 text-sm text-muted"><span className="truncate">{profile.email}</span><Badge tone="info">Admin</Badge></p>
          </div>
        </div>
        <form onSubmit={save} className="space-y-4 border-t border-border p-5">
          <label className="block text-sm">
            <span className="font-medium">Name</span>
            <span className="mt-2 flex gap-2">
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="How your name appears in Activity" className={`${field} max-w-sm`} />
              <Button type="submit" variant="primary" disabled={saving || name.trim() === (profile.name ?? "")}>{saving ? "Saving…" : "Save"}</Button>
            </span>
          </label>
          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            <div><dt className="text-xs font-medium text-muted">Email</dt><dd className="mt-1">{profile.email}</dd></div>
            <div><dt className="text-xs font-medium text-muted">Time zone</dt><dd className="mt-1">{profile.timezone}</dd></div>
            <div><dt className="text-xs font-medium text-muted">Admin since</dt><dd className="mt-1">{me?.addedAt ? `${fmtUtc(me.addedAt)}${me.addedBy ? ` · added by ${me.addedBy}` : ""}` : "–"}</dd></div>
          </dl>
          <p className="text-xs"><Link href="/dashboard/profile" target="_blank" rel="noopener noreferrer" className="text-muted underline hover:text-foreground">Change email or password</Link></p>
        </form>
      </Card>

      <Card>
        <CardHeader title="Session" />
        <div className="flex flex-wrap items-center justify-between gap-3 p-5 text-sm">
          <p className="text-muted">Signed in to Joobah.</p>
          <Button onClick={() => void signOut()}><ArrowLeft aria-hidden className="size-4" /> Back to Joobah</Button>
        </div>
      </Card>

      <Card>
        <CardHeader title="Recent activity" />
        {mine.status !== "ready" ? (
          <p className="p-5 text-sm text-muted">{mine.status === "loading" ? "Loading…" : mine.status === "unavailable" ? "Not available yet." : "We couldn’t load this. Please try again."}</p>
        ) : mine.rows.length === 0 ? (
          <p className="p-5 text-sm text-muted">Nothing yet.</p>
        ) : (
          <ul className="divide-y divide-border text-sm">
            {mine.rows.slice(0, 6).map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                <span>{actionLabel(e.action)}{e.reason && <span className="block text-xs text-muted">{e.reason}</span>}</span>
                <span className="whitespace-nowrap text-xs text-muted">{fmtUtc(e.at)}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="border-t border-border px-5 py-3 text-xs"><Link href="/admin/audit" className="text-muted underline hover:text-foreground">See all activity</Link></p>
      </Card>
      <ToastStack items={toasts.items} onDismiss={toasts.dismiss} />
    </div>
  );
}
