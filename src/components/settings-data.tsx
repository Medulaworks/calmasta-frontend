"use client";

import { CalendarDays, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useProfile, useSetProfile } from "@/components/shell/profile-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { type ConnectionView, getConnections } from "@/lib/calendar-client";
import { type DeletionView, cancelDeletion, fetchDeletion, formatDate, requestDeletion } from "@/lib/plan-client";
import { saveProfile } from "@/lib/profile-client";
import { ApiError } from "@/lib/upload-client";

/** Connected accounts, in one place. Managing them happens on the Calendar page. */
export function ConnectionsCard() {
  const [conns, setConns] = useState<ConnectionView[] | null>(null);
  const [failed, setFailed] = useState(false);
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
      <div className="space-y-3 p-5 text-sm">
        {failed ? (
          <p className="text-muted">Couldn&rsquo;t load your connections right now.</p>
        ) : !conns ? (
          <p className="text-muted">Loading…</p>
        ) : conns.length === 0 ? (
          <p className="text-muted">No calendar connected. Connect one to see your agenda, avoid double-booking and have meetings captured.</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {conns.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="flex min-w-0 items-center gap-2">
                  <CalendarDays aria-hidden className="h-4 w-4 shrink-0 text-muted" />
                  <span className="truncate">{c.accountEmail}</span>
                </span>
                <Badge tone={c.status === "connected" ? "success" : "warning"}>{c.status === "connected" ? "Connected" : "Needs reconnecting"}</Badge>
              </li>
            ))}
          </ul>
        )}
        <Link href="/calendar" className="inline-block font-medium text-accent underline underline-offset-2">
          {conns && conns.length > 0 ? "Manage on the Calendar page" : "Go to Calendar"}
        </Link>
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
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader title="Data and privacy" />
      <div className="space-y-4 p-5 text-sm">
        <p>
          Your original recordings (audio, and video of meetings you chose to record) are kept for <strong>{days} {days === 1 ? "day" : "days"}</strong> after it has been processed, then removed. Transcripts and documents stay until you delete them.
        </p>
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-4 has-[:checked]:border-accent has-[:checked]:bg-accent/5">
          <input type="checkbox" checked={profile.outputsOnly} disabled={busy} onChange={(e) => void toggle(e.target.checked)} className="mt-1 h-4 w-4 accent-[var(--accent-solid,#2563eb)]" />
          <span>
            <span className="font-medium">Outputs only</span>
            <span className="mt-0.5 block text-muted">Remove the original recording as soon as it has been transcribed. You keep the transcript and any documents, but you won&rsquo;t be able to play the recording back, and meeting video can&rsquo;t be recorded. This applies to recordings from now on.</span>
          </span>
        </label>
        {error && <p role="alert" className="text-danger">{error}</p>}
        <p className="text-xs text-muted">Removing recordings can&rsquo;t be undone. Deleting your account removes everything, as described below.</p>
      </div>
    </Card>
  );
}

const WILL_REMOVE = [
  "Your recordings, including the original audio and video files",
  "Transcripts, documents and action items",
  "Your booking pages, meeting types and bookings (upcoming guests are told their booking was cancelled)",
  "Connected calendars and any meeting assistants that haven't joined yet",
  "Your plan record, usage history and sign-in sessions",
];

export function DeleteAccountCard() {
  const router = useRouter();
  const profile = useProfile();
  const [deletion, setDeletion] = useState<DeletionView | null | undefined>(undefined); // undefined = still loading
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
        // Once the account is gone the session goes with it: that is the "done" signal.
        if (err instanceof ApiError && err.status === 401 && !cancelled) router.replace("/deleted");
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
      setError(err instanceof Error ? err.message : "Could not start deletion.");
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
      setError(err instanceof Error ? err.message : "Could not cancel.");
      setDeletion(await fetchDeletion().catch(() => deletion));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="border-danger/30">
      <CardHeader id="delete-account" title="Delete account" />
      <div className="space-y-4 p-5 text-sm">
        {deletion === undefined ? (
          <p className="text-muted">Loading…</p>
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
              <input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" spellCheck={false} className="mt-1.5 block w-full max-w-xs rounded-lg border border-border bg-background px-3 py-2" />
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
