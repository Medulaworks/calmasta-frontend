"use client";

import { Loading, SkeletonLines } from "@/components/ui/skeleton";
import { CalendarDays, Clock, FileLock, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useProfile, useSetProfile } from "@/components/shell/profile-context";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card, CardHeader } from "@/components/ui/card";
import { type ConnectionView, getConnections } from "@/lib/calendar-client";
import { type DeletionView, cancelDeletion, fetchDeletion, formatDate, requestDeletion } from "@/lib/plan-client";
import { saveProfile } from "@/lib/profile-client";
import { ApiError } from "@/lib/upload-client";
import { qk } from "@/lib/queries";

/** Connected accounts, in one place. Managing them happens on the Calendar page. */
export function ConnectionsCard() {
  const [conns, setConns] = useState<ConnectionView[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [calendarOutcome, setCalendarOutcome] = useState<{ ok: boolean; text: string } | null>(null);
  const search = useSearchParams();
  const qc = useQueryClient();
  useEffect(() => {
    const cal = search.get("calendar");
    if (!cal) return;
    const map: Record<string, { ok: boolean; text: string }> = {
      connected: { ok: true, text: "Google Calendar connected." },
      denied: { ok: false, text: "Calendar connection was cancelled." },
      missing_scope: { ok: false, text: "Required calendar permissions were not granted. Please reconnect and allow them." },
      missing_grant: { ok: false, text: "Google did not return the credentials needed to keep the calendar connected. Please reconnect." },
      error: { ok: false, text: "We couldn’t connect your calendar. Please try again." },
    };
    setCalendarOutcome(map[cal] ?? { ok: false, text: "We couldn’t connect your calendar. Please try again." });
    const url = new URL(window.location.href);
    url.searchParams.delete("calendar");
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
    void qc.invalidateQueries({ queryKey: qk.calendarConnections() });
    void qc.invalidateQueries({ queryKey: ["calendar", "agenda"] });
    // also refresh local list
    getConnections().then((r) => setConns(r.connections), () => {});
  }, [search, qc]);
  useEffect(() => {
    let cancelled = false;
    getConnections().then(
      (r) => !cancelled && setConns(r.connections),
      () => !cancelled && setFailed(true),
    );
    return () => {
      cancelled = true;
    };
  }, []);
  return (
    <Card>
      <CardHeader title="Connections" />
      <div className="space-y-4 p-5 text-sm">
        {calendarOutcome && (
          <p role={calendarOutcome.ok ? "status" : "alert"} className={`rounded-xl border px-4 py-3 text-sm ${calendarOutcome.ok ? "border-success/30 bg-success/10" : "border-border bg-surface"}`}>
            {calendarOutcome.text}
          </p>
        )}
        {failed ? (
          <p className="text-muted">Couldn&rsquo;t load your connections right now.</p>
        ) : !conns ? (
          <Loading label="Loading your calendars"><SkeletonLines lines={2} /></Loading>
        ) : conns.length === 0 ? (
          <div className="flex flex-wrap items-center gap-4">
            <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface text-muted"><CalendarDays className="size-5" /></span>
            <div className="min-w-0 flex-1">
              <p className="font-medium">No calendar connected</p>
              <p className="mt-1 text-muted">Connect one to see your agenda, avoid double-booking and send the assistant to meetings.</p>
            </div>
            <ButtonLink href="/dashboard/calendar" variant="secondary">Connect a calendar</ButtonLink>
          </div>
        ) : (
          <>
            <ul className="divide-y divide-border rounded-xl border border-border">
              {conns.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <span className="flex min-w-0 items-center gap-3">
                    <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface text-muted"><CalendarDays className="size-4" /></span>
                    <span className="truncate font-medium">{c.accountEmail}</span>
                  </span>
                  <Badge tone={c.status === "connected" ? "success" : "warning"}>{c.status === "connected" ? "Connected" : "Needs reconnecting"}</Badge>
                </li>
              ))}
            </ul>
            <Link href="/dashboard/calendar" className="inline-block font-medium text-accent underline underline-offset-2">Manage on the Calendar page</Link>
          </>
        )}
      </div>
    </Card>
  );
}

/** How long audio is kept, and the choice to keep none of it. */
export function DataPrivacyCard() {
  const profile = useProfile();
  const setProfile = useSetProfile();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!profile) return null;
  const days = profile.audioRetentionDays;

  async function toggle(next: boolean) {
    setBusy(true);
    setError(null);
    try {
      setProfile(await saveProfile({ outputsOnly: next }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn’t save. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader title="Data and privacy" />
      <div className="divide-y divide-border text-sm">
        <div className="flex flex-wrap items-center gap-4 px-5 py-3">
          <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface text-muted"><Clock className="size-5" /></span>
          <div className="min-w-0 flex-1">
            <p className="font-medium">How long recordings are kept</p>
            <p className="mt-1 text-muted">Original audio, and video of meetings you chose to record, is removed <strong className="text-foreground">{days} {days === 1 ? "day" : "days"}</strong> after it has been processed. Transcripts and documents stay until you delete them.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4 px-5 py-3">
          <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface text-muted"><FileLock className="size-5" /></span>
          <div className="min-w-0 flex-1">
            <p id="outputs-only-label" className="font-medium">Outputs only</p>
            <p className="mt-1 text-muted">Remove the original recording as soon as it has been transcribed. You keep the transcript and any documents, but you won&rsquo;t be able to play the recording back, and meeting video can&rsquo;t be recorded. This applies to recordings from now on.</p>
          </div>
          <Switch checked={profile.outputsOnly} onChange={(v) => void toggle(v)} labelledBy="outputs-only-label" disabled={busy} />
        </div>
        {error && <p role="alert" className="px-5 py-3 text-danger">{error}</p>}
        <p className="px-5 py-3 text-xs text-muted">Removing recordings can&rsquo;t be undone. Deleting your account removes everything, as described under Delete account.</p>
      </div>
    </Card>
  );
}

const WILL_REMOVE = [
  "Your recordings, including the original audio and video files",
  "Transcripts, documents and action items",
  "Your booking pages, meeting types and bookings (upcoming guests are told their booking was cancelled)",
  "Connected calendars and any meeting assistants that haven’t joined yet",
  "Your plan record, usage history and sign-in sessions",
];

export function DeleteAccountCard() {
  const router = useRouter();
  const profile = useProfile();
  const [deletion, setDeletion] = useState<DeletionView | null | undefined>(undefined); // undefined = still loading
  const [unavailable, setUnavailable] = useState(false);
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const status = deletion?.status;

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = async () => {
      try {
        const d = await fetchDeletion();
        if (cancelled) return;
        setDeletion(d);
        if (d && d.status !== "requested") timer = setTimeout(() => void load(), 5000);
      } catch (err) {
        if (!cancelled && err instanceof ApiError && err.code === "feature_unavailable") setUnavailable(true);
        else if (err instanceof ApiError && err.status === 401 && !cancelled) router.replace("/auth/login?returnTo=/dashboard/settings&reason=expired");
        else if (!cancelled) setDeletion((d) => d ?? null);
      }
    };
    void load();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [router, status]);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      setDeletion(await requestDeletion(typed));
      setOpen(false);
      setTyped("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn’t start deletion. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  async function cancel() {
    setBusy(true);
    setError(null);
    try {
      await cancelDeletion();
      setDeletion(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn’t cancel. Please try again.");
      setDeletion(await fetchDeletion().catch(() => deletion));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="border-danger/30">
      <CardHeader id="delete-account" title="Delete account" />
      <div className="space-y-4 p-5 text-sm">
        {unavailable ? (
          <p role="status" className="text-muted">Account deletion is not available yet.</p>
        ) : deletion === undefined ? (
          <Loading label="Loading"><SkeletonLines lines={2} /></Loading>
        ) : deletion ? (
          <div role="status" className="space-y-3">
            <p className="flex items-center gap-2 font-medium">
              <Badge tone={deletion.status === "requested" ? "warning" : deletion.status === "partial_failure" ? "danger" : "info"} active={deletion.status === "in_progress"}>
                {deletion.status === "requested" ? "Waiting to start" : deletion.status === "in_progress" ? "Deleting" : "Still finishing"}
              </Badge>
              Requested {formatDate(deletion.requestedAt, profile?.timezone ?? "UTC", true)}
            </p>
            {deletion.status === "requested" && (
              <p className="text-muted">
                Nothing has been removed yet.{deletion.startsAt ? ` Removal starts after ${formatDate(deletion.startsAt, profile?.timezone ?? "UTC", true)}.` : ""} You can change your mind until then.
              </p>
            )}
            {deletion.status === "in_progress" && <p className="text-muted">Removal has started and can&rsquo;t be stopped. {deletion.filesRemoved > 0 && `${deletion.filesRemoved} audio ${deletion.filesRemoved === 1 ? "file" : "files"} removed so far. `}This page will close when it&rsquo;s done.</p>}
            {deletion.status === "partial_failure" && (
              <p className="text-danger">
                {deletion.filesFailed} audio {deletion.filesFailed === 1 ? "file" : "files"} could not be removed yet. Your account is not reported as deleted until every file is gone, and we keep retrying automatically. You don&rsquo;t need to do anything.
              </p>
            )}
            {deletion.canCancel && (
              <Button onClick={() => void cancel()} disabled={busy}>
                Cancel deletion
              </Button>
            )}
          </div>
        ) : !open ? (
          <>
            <p className="text-muted">Permanently remove your account and everything in it.</p>
            <Button variant="danger" onClick={() => setOpen(true)}>
              <Trash2 aria-hidden className="h-4 w-4" /> Delete my account…
            </Button>
          </>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (typed === "DELETE") void submit();
            }}
            className="space-y-4"
            aria-label="Confirm account deletion"
          >
            <div>
              <p className="font-medium">This permanently removes:</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
                {WILL_REMOVE.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
              <p className="mt-3 text-muted">It can&rsquo;t be undone. We keep only a one-way fingerprint of your email address, so we can find this request if you contact us. Copies you exported or downloaded are yours and aren&rsquo;t affected.</p>
            </div>
            <label className="block">
              <span className="font-medium">Type DELETE to confirm</span>
              <input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" spellCheck={false} className="mt-2 block w-full max-w-xs min-h-10 rounded-xl border border-border bg-background px-4 py-2" />
            </label>
            {error && <p role="alert" className="text-danger">{error}</p>}
            <div className="flex gap-2">
              <Button type="submit" variant="danger" disabled={typed !== "DELETE" || busy}>
                {busy ? "Starting…" : "Delete everything"}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setOpen(false);
                  setTyped("");
                  setError(null);
                }}
              >
                Keep my account
              </Button>
            </div>
          </form>
        )}
        {(deletion || !open) && error && <p role="alert" className="text-danger">{error}</p>}
      </div>
    </Card>
  );
}
