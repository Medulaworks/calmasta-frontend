"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Camera, Check, Clock, FileText, Globe, Loader2, Lock, Mic, Pencil, RotateCcw, Settings as SettingsIcon, Trash2, UserRound, Video } from "lucide-react";
import Link from "next/link";
import { useMemo, useRef, useState, useSyncExternalStore } from "react";
import { ItemRow } from "@/components/dashboard/item-row";
import { useProfile, useSetProfile } from "@/components/shell/profile-context";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { prepareAvatar, removeAvatar, uploadAvatar } from "@/lib/avatar-client";
import { type Dashboard } from "@/lib/dashboard-types";
import { TEMPLATE_CHOICES } from "@/lib/documents-client";
import { dashboardQuery } from "@/lib/queries";
import { getProfile, saveProfile } from "@/lib/profile-client";
import { DUMMY_PLAN, fetchPlan, formatDate, formatNullableMinutes, orZero } from "@/lib/plan-client";
import { PLAN_LABEL, isPaidPlan } from "@/lib/plan-types";
import { ROLES } from "@/lib/roles";
import { formatMinutes } from "@/lib/status";
import { ApiError } from "@/lib/upload-client";

const noSubscribe = () => () => {};
const useBrowserTimezone = () => useSyncExternalStore(noSubscribe, () => Intl.DateTimeFormat().resolvedOptions().timeZone, () => null);

/** Your picture, inside the edit dialog: crops, uploads, refreshes on conflict, or removes it via the authenticated BFF. A photo change is saved straight away. */
function PhotoEditor() {
  const profile = useProfile();
  const setProfile = useSetProfile();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState<"uploading" | "removing" | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [photoSaved, setPhotoSaved] = useState<string | null>(null);
  const [pendingBlob, setPendingBlob] = useState<Blob | null>(null);

  if (!profile) return null;
  const currentProfile = profile;
  const name = currentProfile.name?.trim() || currentProfile.email;

  async function runUpload(blob: Blob) {
    setBusy("uploading");
    setPhotoError(null);
    setPhotoSaved(null);
    try {
      const updated = await uploadAvatar(blob, currentProfile.avatarVersion);
      setProfile({
        ...currentProfile,
        avatarUrl: updated.avatarUrl,
        avatarExpiresAt: updated.avatarExpiresAt,
        avatarVersion: updated.avatarVersion,
      });
      setPendingBlob(null);
      setPhotoSaved("Photo updated");
    } catch (err) {
      if (err instanceof ApiError && (err.code === "avatar_version_conflict" || err.code === "avatar_superseded")) {
        setPendingBlob(null);
        await getProfile().then(setProfile).catch(() => undefined);
      } else if (err instanceof ApiError && (err.code === "invalid_avatar" || err.code === "invalid_image")) {
        setPendingBlob(null);
      }
      setPhotoError(err instanceof Error ? err.message : "Could not upload photo.");
    } finally {
      setBusy(null);
    }
  }

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setPhotoError(null);
    setPhotoSaved(null);
    try {
      const blob = await prepareAvatar(file);
      setPendingBlob(blob);
      await runUpload(blob);
    } catch (err) {
      setPendingBlob(null);
      setPhotoError(err instanceof Error ? err.message : "That picture couldn't be prepared.");
    }
  }

  async function onRemove() {
    setBusy("removing");
    setPhotoError(null);
    setPhotoSaved(null);
    try {
      const updated = await removeAvatar(currentProfile.avatarVersion);
      setProfile({
        ...currentProfile,
        avatarUrl: updated.avatarUrl,
        avatarExpiresAt: updated.avatarExpiresAt,
        avatarVersion: updated.avatarVersion,
      });
      setPendingBlob(null);
      setPhotoSaved("Photo removed");
    } catch (err) {
      if (err instanceof ApiError && (err.code === "avatar_version_conflict" || err.code === "avatar_superseded")) {
        await getProfile().then(setProfile).catch(() => undefined);
      }
      setPhotoError(err instanceof Error ? err.message : "Could not remove photo.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex items-center gap-4">
      <div className="relative shrink-0">
        <Avatar name={name} src={currentProfile.avatarUrl} size={72} />
        <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" aria-label="Choose profile photo" onChange={(e) => void onPick(e)} disabled={busy !== null} />
        {busy === "uploading" && <span className="absolute inset-0 grid place-items-center rounded-full bg-black/40 text-white"><Loader2 aria-hidden className="size-5 animate-spin motion-reduce:animate-none" /></span>}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="secondary" disabled={busy !== null} onClick={() => inputRef.current?.click()}>
            <Camera aria-hidden className="size-4" /> {busy === "uploading" ? "Uploading…" : currentProfile.avatarUrl ? "Change photo" : "Upload photo"}
          </Button>
          {pendingBlob && busy === null && <Button size="sm" variant="secondary" onClick={() => void runUpload(pendingBlob)}><RotateCcw aria-hidden className="size-4" /> Try again</Button>}
          {currentProfile.avatarUrl && <Button size="sm" variant="ghost" disabled={busy !== null} onClick={() => void onRemove()}><Trash2 aria-hidden className="size-4" /> {busy === "removing" ? "Removing…" : "Remove"}</Button>}
        </div>
        {photoSaved && <p role="status" className="mt-2 inline-flex items-center gap-2 text-sm text-success"><Check aria-hidden className="size-4" strokeWidth={3} /> {photoSaved}</p>}
        {photoError && <p role="alert" className="mt-2 text-sm text-danger">{photoError}</p>}
        <p className="mt-2 text-xs text-muted">PNG, JPG or WebP up to 1 MB. We crop it to a square and strip camera and location data. A new photo is saved straight away.</p>
      </div>
    </div>
  );
}

const field = "mt-2 block w-full min-h-10 rounded-xl border border-border bg-background px-4 py-2 text-sm shadow-sm placeholder:text-muted focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent-solid/20";

/** The editable parts of a profile, in a dialog: photo, name, time zone and role. Email comes from the sign-in provider. */
function EditProfileDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const profile = useProfile();
  const setProfile = useSetProfile();
  const browserTz = useBrowserTimezone();
  const [name, setName] = useState(profile?.name ?? "");
  const [timezone, setTimezone] = useState(profile?.timezone ?? "UTC");
  const [role, setRole] = useState<string | null>(profile?.role ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const savedTimezone = profile?.timezone;
  const zones = useMemo(() => {
    const all = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [];
    return Array.from(new Set(["UTC", ...all, ...(savedTimezone ? [savedTimezone] : [])])).sort();
  }, [savedTimezone]);
  if (!profile) return null;
  const dirty = name.trim() !== (profile.name ?? "") || timezone !== profile.timezone || role !== profile.role;
  const defaultTemplate = ROLES.find((r) => r.id === role)?.template;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      setProfile(await saveProfile({ name: name.trim() || null, timezone, role }));
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
      setSaving(false);
    }
  }

  return (
    <Dialog title="Edit profile" onClose={onClose} width="max-w-xl">
      <form onSubmit={save} className="space-y-5">
        <PhotoEditor />
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="font-medium">Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} autoComplete="name" placeholder="Your name" className={field} />
          </label>
          <div className="text-sm">
            <span className="font-medium">Email</span>
            <div className="mt-2 flex min-h-10 items-center gap-2 rounded-xl border border-border bg-surface px-4 text-muted"><Lock aria-hidden className="size-4 shrink-0" /><span className="min-w-0 flex-1 truncate" title={profile.email}>{profile.email}</span></div>
          </div>
        </div>
        <label className="block text-sm">
          <span className="font-medium">Time zone</span>
          <select value={timezone} onChange={(e) => setTimezone(e.target.value)} className={field}>
            {zones.map((z) => <option key={z} value={z}>{z.replace(/_/g, " ")}</option>)}
          </select>
          <span className="mt-2 block text-xs text-muted">
            Used for &ldquo;this month&rdquo; and every time you see.{" "}
            {browserTz && browserTz !== timezone && zones.includes(browserTz) && <button type="button" onClick={() => setTimezone(browserTz)} className="font-medium text-accent underline">Use my browser&rsquo;s ({browserTz.replace(/_/g, " ")})</button>}
          </span>
        </label>
        <fieldset>
          <legend className="text-sm font-medium">Your role</legend>
          <p className="mt-1 text-sm text-muted">We use this only to suggest the document that fits best.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {ROLES.map((r) => (
              <label key={r.id} className="group flex cursor-pointer items-center gap-3 rounded-xl border border-border px-4 py-3 text-sm transition-colors hover:bg-surface has-[:checked]:border-accent-solid has-[:checked]:bg-accent-solid/10 has-[:checked]:font-medium has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent">
                <input type="radio" name="role" value={r.id} checked={role === r.id} onChange={() => setRole(r.id)} className="sr-only" />
                <span aria-hidden className="grid size-5 shrink-0 place-items-center rounded-full border border-border text-transparent transition-colors group-has-[:checked]:border-accent-solid group-has-[:checked]:bg-accent-solid group-has-[:checked]:text-on-accent"><Check className="size-3" strokeWidth={3} /></span>
                {r.label}
              </label>
            ))}
          </div>
          {defaultTemplate && <p className="mt-3 text-xs text-muted">Suggested document: {TEMPLATE_CHOICES.find((t) => t.id === defaultTemplate)?.label}</p>}
        </fieldset>
        {error && <p role="alert" className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>}
        <div className="flex flex-wrap justify-end gap-3 border-t border-border pt-4">
          <Button type="button" variant="ghost" disabled={saving} onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={!dirty || saving}>{saving ? "Saving…" : "Save changes"}</Button>
        </div>
      </form>
    </Dialog>
  );
}

function Row({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-3 text-sm">
      <span aria-hidden className="mt-0.5 text-muted [&>svg]:size-4">{icon}</span>
      <dt className="w-24 shrink-0 text-muted">{label}</dt>
      <dd className="min-w-0 flex-1 font-medium">{children}</dd>
    </div>
  );
}

/**
 * Your profile, as a page to read: who you are, your plan, what you have used this month and what you have been doing.
 * Nothing here is a form. Edit profile opens a dialog for the few things you can change, and passwords and other
 * settings live in Settings.
 */
export function ProfileView() {
  const profile = useProfile();
  const [editing, setEditing] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const { data: dash } = useQuery(dashboardQuery);
  const { data: planData } = useQuery({ queryKey: ["plan-summary"], queryFn: () => fetchPlan().catch(() => DUMMY_PLAN), staleTime: 60_000 });

  const recent = useMemo(() => {
    if (!dash) return null;
    const all: Dashboard["recentRecordings"] = [...dash.inProgress, ...dash.recentMeetings, ...dash.recentRecordings];
    return all.filter((r, i) => all.findIndex((x) => x.id === r.id && x.kind === r.kind) === i).sort((a, b) => (b.at > a.at ? 1 : -1)).slice(0, 5);
  }, [dash]);

  if (!profile) return <p className="text-sm text-muted">Sign in to see your profile.</p>;
  const name = profile.name?.trim() || profile.email;
  const role = ROLES.find((r) => r.id === profile.role)?.label;
  const plan = planData ?? null;
  const total = plan ? orZero(plan.allowanceMinutes) + orZero(plan.purchasedMinutes) : 0;
  const usedPct = plan && total > 0 ? Math.min(100, Math.round((Math.max(0, total - orZero(plan.remainingMinutes)) / total) * 100)) : 0;
  const paid = plan ? isPaidPlan(plan.plan.plan) : false;

  const tiles = [
    { label: "Recordings", value: dash ? String(dash.stats.recordingsThisMonth) : null, Icon: Mic },
    { label: "Meetings", value: dash ? String(dash.metrics.meetingsCaptured.thisMonth) : null, Icon: Video },
    { label: "Minutes transcribed", value: dash ? String(Math.round(dash.stats.minutesTranscribedThisMonth)) : null, Icon: Clock },
    { label: "Documents", value: dash ? (dash.stats.documents === null ? "–" : String(dash.stats.documents)) : null, Icon: FileText },
  ];

  return (
    <div className="grid items-start gap-5 lg:grid-cols-3">
      {/* Who you are. Read only. */}
      <div className="space-y-5 lg:sticky lg:top-24">
        <Card className="overflow-hidden">
          <div aria-hidden className="h-20 bg-gradient-to-br from-accent-solid/30 via-accent-solid/10 to-surface" />
          <div className="px-5 pb-5">
            <span className="-mt-12 block w-fit rounded-full ring-4 ring-background"><Avatar name={name} src={profile.avatarUrl} size={96} /></span>
            <div className="mt-4 min-w-0">
              <h2 className="truncate text-lg font-semibold">{profile.name?.trim() || "Add your name"}</h2>
              <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
                <span className="min-w-0 truncate" title={profile.email}>{profile.email}</span>
                <Badge tone={profile.emailVerified ? "success" : "warning"}>{profile.emailVerified ? "Verified" : "Unverified"}</Badge>
              </p>
            </div>
            <Button variant="primary" className="mt-5 w-full" onClick={() => setEditing(true)}><Pencil aria-hidden className="size-4" /> Edit profile</Button>
            {justSaved && <p role="status" className="mt-3 inline-flex items-center gap-2 text-sm text-success"><Check aria-hidden className="size-4" strokeWidth={3} /> Profile updated</p>}
            <dl className="mt-4 divide-y divide-border border-t border-border">
              <Row icon={<UserRound />} label="Role">{role ?? <span className="font-normal text-muted">Not set</span>}</Row>
              <Row icon={<Globe />} label="Time zone">{profile.timezone.replace(/_/g, " ")}</Row>
              <Row icon={<Lock />} label="Sign-in">{profile.emailVerified ? "Email verified" : "Email not verified"}</Row>
            </dl>
          </div>
        </Card>
        <Link href="/dashboard/settings" className="group flex items-center gap-4 rounded-2xl border border-border bg-background p-4 shadow-sm transition-all hover:-translate-y-px hover:border-foreground/20 hover:shadow-md">
          <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-solid/15 text-accent"><SettingsIcon className="size-5" /></span>
          <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">Settings</span><span className="block text-xs text-muted">Password, appearance, privacy and your data</span></span>
          <ArrowRight aria-hidden className="size-4 text-muted transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>

      <div className="min-w-0 space-y-5 lg:col-span-2">
        {/* Plan */}
        <Card>
          <CardHeader title="Plan" action={plan?.placeholder ? <Badge tone="warning">Sample figures</Badge> : undefined} />
          <div className="space-y-4 p-5">
            {!plan ? (
              <div aria-hidden className="space-y-3"><div className="h-6 w-1/3 jb-skel rounded bg-border" /><div className="h-2 w-full jb-skel rounded bg-border" /></div>
            ) : (
              <>
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p className="text-sm text-muted">{PLAN_LABEL[plan.plan.plan]} plan</p>
                    <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">{plan.exhausted ? "Used up" : formatNullableMinutes(plan.remainingMinutes)} <span className="text-sm font-normal text-muted">{plan.exhausted ? "" : `left of ${formatMinutes(total)}`}</span></p>
                  </div>
                  <ButtonLink href="/dashboard/plan" variant={paid ? "secondary" : "primary"}>{paid ? "Manage plan" : "Upgrade to Pro"}</ButtonLink>
                </div>
                <div role="progressbar" aria-label="Allowance used this month" aria-valuemin={0} aria-valuemax={100} aria-valuenow={usedPct} className="h-2 overflow-hidden rounded-full bg-border">
                  <div className={`h-full rounded-full transition-[width] duration-700 ease-out ${plan.exhausted ? "bg-danger-solid" : usedPct >= 80 ? "bg-warning" : "bg-accent-solid"}`} style={{ width: `${Math.max(usedPct, plan.exhausted ? 100 : 2)}%` }} />
                </div>
                <p className="text-xs text-muted">{usedPct}% used this month · resets {formatDate(plan.resetsAt, profile.timezone)}</p>
              </>
            )}
          </div>
        </Card>

        {/* Usage */}
        <section aria-labelledby="usage-heading">
          <h2 id="usage-heading" className="mb-3 text-base font-semibold">This month</h2>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {tiles.map(({ label, value, Icon }) => (
              <div key={label} className="rounded-2xl border border-border bg-background p-5 shadow-sm">
                <span aria-hidden className="grid size-9 place-items-center rounded-lg bg-accent-solid/15 text-accent"><Icon className="size-4" /></span>
                {value === null ? <span className="mt-4 block h-7 w-12 jb-skel rounded bg-border" /> : <p className="mt-4 text-2xl font-semibold tracking-tight tabular-nums">{value}</p>}
                <p className="mt-1 text-sm text-muted">{label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Activity */}
        <Card>
          <CardHeader title="Recent activity" id="activity-heading" action={<ButtonLink href="/dashboard/library" variant="secondary" size="sm">View all <ArrowRight aria-hidden className="size-4" /></ButtonLink>} />
          {recent === null ? (
            <ul aria-hidden className="divide-y divide-border">{[0, 1, 2].map((i) => <li key={i} className="flex items-center gap-4 px-5 py-3"><span className="size-10 jb-skel rounded-lg bg-border" /><span className="flex-1 space-y-2"><span className="block h-3 w-1/2 jb-skel rounded bg-border" /><span className="block h-3 w-1/3 jb-skel rounded bg-border" /></span></li>)}</ul>
          ) : recent.length === 0 ? (
            <EmptyState icon={<Mic />} title="Nothing yet" body="Your recordings and meetings will show up here." action={<ButtonLink href="/dashboard/voice" variant="primary">Start recording</ButtonLink>} />
          ) : (
            <ul aria-labelledby="activity-heading" className="divide-y divide-border">{recent.map((it) => <ItemRow key={`${it.kind}-${it.id}`} item={it} />)}</ul>
          )}
        </Card>
      </div>

      {editing && <EditProfileDialog onClose={() => setEditing(false)} onSaved={() => { setJustSaved(true); setTimeout(() => setJustSaved(false), 4000); }} />}
    </div>
  );
}
