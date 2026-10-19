"use client";

import { Check, LogOut, Shield } from "lucide-react";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useProfile, useSetProfile } from "@/components/shell/profile-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { signOut } from "@/lib/auth-client";
import { type Dashboard, fetchDashboard } from "@/lib/dashboard-client";
import { TEMPLATE_CHOICES } from "@/lib/documents-client";
import { saveProfile } from "@/lib/profile-client";
import { ROLES } from "@/lib/roles";
import { formatMinutes } from "@/lib/status";

const PRIVACY = [
  "Recordings, transcripts and documents are private to you.",
  "Meeting assistants are always visible and join as “Calmaster Notetaker”.",
  "You confirm you have the right to record every meeting. Nothing records automatically.",
  "Deleting a recording deletes its audio and transcript. Documents you made from it are kept.",
];

const noSubscribe = () => () => {};
const useBrowserTimezone = () => useSyncExternalStore(noSubscribe, () => Intl.DateTimeFormat().resolvedOptions().timeZone, () => null);

export function SettingsView() {
  const profile = useProfile();
  const setProfile = useSetProfile();
  const browserTz = useBrowserTimezone();

  // `undefined` means "not changed yet": show the saved value, and keep the user's pick once they make one.
  const [name, setName] = useState<string | undefined>(undefined);
  const [timezone, setTimezone] = useState<string | undefined>(undefined);
  const [role, setRole] = useState<string | null | undefined>(undefined);
  const shown = {
    name: name ?? profile?.name ?? "",
    timezone: timezone ?? profile?.timezone ?? "UTC",
    role: role === undefined ? (profile?.role ?? null) : role,
  };
  const dirty = !!profile && (shown.name.trim() !== (profile.name ?? "") || shown.timezone !== profile.timezone || shown.role !== profile.role);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usage, setUsage] = useState<Dashboard["stats"] | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchDashboard().then(
      (d) => !cancelled && setUsage(d.stats),
      () => {},
    );
    return () => {
      cancelled = true;
    };
  }, []);

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

  const defaultTemplate = ROLES.find((r) => r.id === shown.role)?.template;
  const initial = (shown.name.trim() || profile?.email || "?")[0];

  return (
    <div className="grid max-w-3xl gap-6">
      <Card>
        <CardHeader title="Profile" />
        {!profile ? (
          <p className="px-5 py-6 text-sm text-muted">Sign in to see your profile.</p>
        ) : (
          <div className="space-y-6 p-5">
            <div className="flex items-center gap-4">
              <span aria-hidden className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-accent/15 text-xl font-semibold uppercase text-accent">
                {initial}
              </span>
              <div className="min-w-0">
                <p className="truncate font-medium">{shown.name.trim() || "No name yet"}</p>
                <p className="truncate text-sm text-muted">{profile.email}</p>
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="font-medium">Name</span>
                <input
                  value={shown.name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setSaved(false);
                  }}
                  maxLength={100}
                  autoComplete="name"
                  placeholder="Your name"
                  className="mt-1.5 block w-full rounded-lg border border-border bg-background px-3 py-2"
                />
              </label>

              <div className="text-sm">
                <span className="font-medium">Email</span>
                <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2">
                  <span className="min-w-0 flex-1 truncate" title={profile.email}>
                    {profile.email}
                  </span>
                  <Badge tone={profile.emailVerified ? "success" : "warning"}>{profile.emailVerified ? "Verified" : "Unverified"}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted">Managed by your sign-in provider, so it can&rsquo;t be changed here.</p>
              </div>

              <label className="block text-sm sm:col-span-2">
                <span className="font-medium">Timezone</span>
                <select
                  value={shown.timezone}
                  onChange={(e) => {
                    setTimezone(e.target.value);
                    setSaved(false);
                  }}
                  className="mt-1.5 block w-full rounded-lg border border-border bg-background px-3 py-2"
                >
                  {zones.map((z) => (
                    <option key={z} value={z}>
                      {z.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
                <span className="mt-1 block text-xs text-muted">
                  Used for &ldquo;this month&rdquo; and times you see.{" "}
                  {browserTz && browserTz !== shown.timezone && zones.includes(browserTz) && (
                    <button type="button" onClick={() => setTimezone(browserTz)} className="text-accent underline">
                      Use my browser&rsquo;s ({browserTz.replace(/_/g, " ")})
                    </button>
                  )}
                </span>
              </label>
            </div>

            <fieldset>
              <legend className="text-sm font-medium">Your role</legend>
              <p className="mt-1 text-sm text-muted">We use this only to suggest the document that fits best. You can always pick another.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {ROLES.map((r) => (
                  <label
                    key={r.id}
                    className="group cursor-pointer rounded-lg border border-border px-4 py-2 text-sm transition-colors hover:bg-surface has-[:checked]:border-accent has-[:checked]:bg-accent/20 has-[:checked]:font-medium has-[:checked]:ring-1 has-[:checked]:ring-accent has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent"
                  >
                    <input
                      type="radio"
                      name="role"
                      value={r.id}
                      checked={shown.role === r.id}
                      onChange={() => {
                        setRole(r.id);
                        setSaved(false);
                      }}
                      className="sr-only"
                    />
                    <span aria-hidden className="mr-1.5 hidden group-has-[:checked]:inline">✓</span>
                    {r.label}
                  </label>
                ))}
              </div>
              {defaultTemplate && <p className="mt-2 text-xs text-muted">Suggested document: {TEMPLATE_CHOICES.find((t) => t.id === defaultTemplate)?.label}</p>}
            </fieldset>

            <div className="flex items-center gap-3">
              <Button variant="primary" disabled={!dirty || saving} onClick={() => void save()}>
                {saving ? "Saving…" : "Save changes"}
              </Button>
              {saved && (
                <span role="status" className="inline-flex items-center gap-1.5 text-sm text-success">
                  <Check aria-hidden className="h-4 w-4" /> Saved
                </span>
              )}
            </div>
            {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          </div>
        )}
      </Card>

      <Card>
        <CardHeader title="Security" />
        <div className="space-y-4 p-5 text-sm">
          <p className="text-muted">Your password, multi-factor sign-in and account recovery are managed by your sign-in provider.</p>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="secondary" onClick={() => void signOut()}>
              <LogOut aria-hidden className="h-4 w-4" /> Sign out
            </Button>
            {!confirmAll ? (
              <Button variant="ghost" onClick={() => setConfirmAll(true)}>
                Sign out of all devices
              </Button>
            ) : (
              <span className="flex flex-wrap items-center gap-2" role="alertdialog" aria-label="Confirm sign out everywhere">
                <span className="text-muted">Sign out on every device you&rsquo;re signed in on?</span>
                <Button variant="danger" onClick={() => void signOut(true)}>
                  Yes, sign out everywhere
                </Button>
                <Button variant="ghost" onClick={() => setConfirmAll(false)}>
                  Cancel
                </Button>
              </span>
            )}
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="This month" />
        <dl className="grid grid-cols-3 divide-x divide-border text-sm">
          {[
            ["Recordings", usage ? String(usage.recordingsThisMonth) : "–"],
            ["Transcribed", usage ? formatMinutes(usage.minutesTranscribedThisMonth) : "–"],
            ["Documents", usage ? String(usage.documents) : "–"],
          ].map(([label, value]) => (
            <div key={label} className="px-5 py-4">
              <dt className="text-muted">{label}</dt>
              <dd className="mt-1 text-xl font-semibold tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card>
        <CardHeader title="Privacy and recording" />
        <ul className="space-y-3 p-5 text-sm">
          {PRIVACY.map((line) => (
            <li key={line} className="flex gap-3">
              <Shield aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
              {line}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
