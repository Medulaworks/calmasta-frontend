"use client";

import { Camera, Check, ExternalLink, KeyRound, LogOut, RotateCcw, Trash2 } from "lucide-react";
import { useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useProfile, useSetProfile } from "@/components/shell/profile-context";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { signOut } from "@/lib/auth-client";
import { prepareAvatar, removeAvatar, uploadAvatar } from "@/lib/avatar-client";
import { TEMPLATE_CHOICES } from "@/lib/documents-client";
import { getProfile, saveProfile } from "@/lib/profile-client";
import { ROLES } from "@/lib/roles";
import { ApiError } from "@/lib/upload-client";

const noSubscribe = () => () => {};
const useBrowserTimezone = () => useSyncExternalStore(noSubscribe, () => Intl.DateTimeFormat().resolvedOptions().timeZone, () => null);

/** Your picture: crops, uploads, refreshes on conflict, or removes your profile photo via the authenticated BFF. */
function PhotoCard() {
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
    <Card>
      <CardHeader title="Profile photo" />
      <div className="flex flex-wrap items-center gap-6 p-5">
        <Avatar name={name} src={currentProfile.avatarUrl} size={96} />
        <div className="min-w-0 flex-1 space-y-3 text-sm">
          <p className="text-muted">
            PNG, JPG or WebP up to 1 MB. We crop it to a square and strip camera/location metadata before saving.
          </p>
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            aria-label="Choose profile photo"
            onChange={(e) => void onPick(e)}
            disabled={busy !== null}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              disabled={busy !== null}
              onClick={() => inputRef.current?.click()}
            >
              <Camera aria-hidden className="h-4 w-4" />
              {busy === "uploading" ? "Uploading…" : currentProfile.avatarUrl ? "Change photo" : "Upload photo"}
            </Button>
            {pendingBlob && busy === null && (
              <Button variant="secondary" onClick={() => void runUpload(pendingBlob)}>
                <RotateCcw aria-hidden className="h-4 w-4" /> Try again
              </Button>
            )}
            {currentProfile.avatarUrl && (
              <Button
                variant="ghost"
                disabled={busy !== null}
                onClick={() => void onRemove()}
              >
                <Trash2 aria-hidden className="h-4 w-4" />
                {busy === "removing" ? "Removing…" : "Remove photo"}
              </Button>
            )}
            {photoSaved && (
              <span role="status" className="inline-flex items-center gap-1.5 text-sm text-success">
                <Check aria-hidden className="h-4 w-4" /> {photoSaved}
              </span>
            )}
          </div>
          {photoError && (
            <p role="alert" className="text-sm text-danger">
              {photoError}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}

export function ProfileView() {
  const profile = useProfile();
  const setProfile = useSetProfile();
  const browserTz = useBrowserTimezone();

  // `undefined` means "not changed yet": show the saved value, and keep the person's pick once they make one.
  const [name, setName] = useState<string | undefined>(undefined);
  const [timezone, setTimezone] = useState<string | undefined>(undefined);
  const [role, setRole] = useState<string | null | undefined>(undefined);
  const shown = { name: name ?? profile?.name ?? "", timezone: timezone ?? profile?.timezone ?? "UTC", role: role === undefined ? (profile?.role ?? null) : role };
  const dirty = !!profile && (shown.name.trim() !== (profile.name ?? "") || shown.timezone !== profile.timezone || shown.role !== profile.role);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);

  const savedTimezone = profile?.timezone;
  const zones = useMemo(() => {
    const all = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [];
    return Array.from(new Set(["UTC", ...all, ...(savedTimezone ? [savedTimezone] : [])])).sort();
  }, [savedTimezone]);

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      setProfile(await saveProfile({ name: shown.name.trim() || null, timezone: shown.timezone, role: shown.role }));
      setName(undefined);
      setTimezone(undefined);
      setRole(undefined);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  if (!profile) return <p className="text-sm text-muted">Sign in to see your profile.</p>;
  const defaultTemplate = ROLES.find((r) => r.id === shown.role)?.template;
  const field = "mt-1.5 block w-full rounded-lg border border-border bg-background px-3 py-2";

  return (
    <div className="grid max-w-3xl gap-6">
      <PhotoCard />

      <Card>
        <CardHeader title="Personal details" />
        <div className="space-y-6 p-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="font-medium">Name</span>
              <input value={shown.name} onChange={(e) => { setName(e.target.value); setSaved(false); }} maxLength={100} autoComplete="name" placeholder="Your name" className={field} />
            </label>
            <div className="text-sm">
              <span className="font-medium">Email</span>
              <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2">
                <span className="min-w-0 flex-1 truncate" title={profile.email}>{profile.email}</span>
                <Badge tone={profile.emailVerified ? "success" : "warning"}>{profile.emailVerified ? "Verified" : "Unverified"}</Badge>
              </div>
              <p className="mt-1 text-xs text-muted">Managed by your sign-in provider, so it can&rsquo;t be changed here.</p>
            </div>
            <label className="block text-sm sm:col-span-2">
              <span className="font-medium">Time zone</span>
              <select value={shown.timezone} onChange={(e) => { setTimezone(e.target.value); setSaved(false); }} className={field}>
                {zones.map((z) => <option key={z} value={z}>{z.replace(/_/g, " ")}</option>)}
              </select>
              <span className="mt-1 block text-xs text-muted">
                Used for &ldquo;this month&rdquo; and every time you see.{" "}
                {browserTz && browserTz !== shown.timezone && zones.includes(browserTz) && (
                  <button type="button" onClick={() => setTimezone(browserTz)} className="text-accent underline">Use my browser&rsquo;s ({browserTz.replace(/_/g, " ")})</button>
                )}
              </span>
            </label>
          </div>

          <fieldset>
            <legend className="text-sm font-medium">Your role</legend>
            <p className="mt-1 text-sm text-muted">We use this only to suggest the document that fits best. You can always pick another.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {ROLES.map((r) => (
                <label key={r.id} className="group cursor-pointer rounded-lg border border-border px-4 py-2 text-sm transition-colors hover:bg-surface has-[:checked]:border-accent has-[:checked]:bg-accent/20 has-[:checked]:font-medium has-[:checked]:ring-1 has-[:checked]:ring-accent has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent">
                  <input type="radio" name="role" value={r.id} checked={shown.role === r.id} onChange={() => { setRole(r.id); setSaved(false); }} className="sr-only" />
                  <span aria-hidden className="mr-1.5 hidden group-has-[:checked]:inline">✓</span>
                  {r.label}
                </label>
              ))}
            </div>
            {defaultTemplate && <p className="mt-2 text-xs text-muted">Suggested document: {TEMPLATE_CHOICES.find((t) => t.id === defaultTemplate)?.label}</p>}
          </fieldset>

          <div className="flex items-center gap-3">
            <Button variant="primary" disabled={!dirty || saving} onClick={() => void save()}>{saving ? "Saving…" : "Save changes"}</Button>
            {saved && <span role="status" className="inline-flex items-center gap-1.5 text-sm text-success"><Check aria-hidden className="h-4 w-4" /> Saved</span>}
          </div>
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        </div>
      </Card>

      <Card>
        <CardHeader title="Sign-in and security" />
        <div className="space-y-5 p-5 text-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="max-w-md">
              <p className="flex items-center gap-2 font-medium"><KeyRound aria-hidden className="h-4 w-4 text-muted" /> Password and two-step sign-in</p>
              <p className="mt-1 text-muted">Your password and extra sign-in checks are kept by our sign-in provider. Mojooba never sees or stores your password, so changes are made on the provider&rsquo;s own page.</p>
            </div>
            {profile.passwordUrl ? (
              <a href={profile.passwordUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 font-medium hover:bg-surface">
                Change password <ExternalLink aria-hidden className="h-4 w-4" />
              </a>
            ) : (
              <p className="max-w-[16rem] rounded-lg border border-border bg-surface px-3 py-2 text-xs text-muted">Not available in this setup: no sign-in provider page is configured.</p>
            )}
          </div>

          <div className="border-t border-border pt-5">
            <p className="font-medium">Where you&rsquo;re signed in</p>
            <p className="mt-1 text-muted">Signing out of all devices ends every session, including this one. Use it if you lost a device or used a shared computer.</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button onClick={() => void signOut()}><LogOut aria-hidden className="h-4 w-4" /> Sign out</Button>
              {!confirmAll ? (
                <Button variant="ghost" onClick={() => setConfirmAll(true)}>Sign out of all devices</Button>
              ) : (
                <span className="flex flex-wrap items-center gap-2" role="alertdialog" aria-label="Confirm sign out everywhere">
                  <span className="text-muted">Sign out on every device?</span>
                  <Button variant="danger" onClick={() => void signOut(true)}>Yes, sign out everywhere</Button>
                  <Button variant="ghost" onClick={() => setConfirmAll(false)}>Cancel</Button>
                </span>
              )}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
