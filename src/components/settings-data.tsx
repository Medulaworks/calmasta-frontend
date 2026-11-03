"use client";

import { CalendarCheck, CalendarDays, Check, CircleAlert, FileText, Gauge, Mic, Trash2, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useProfile, useSetProfile } from "@/components/shell/profile-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Loading, Skeleton } from "@/components/ui/skeleton";
import { type ConnectionView, getConnections } from "@/lib/calendar-client";
import { ACCOUNT_CHANGED, type DeletionView, cancelDeletion, fetchDeletion, formatDate, requestDeletion } from "@/lib/plan-client";
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
      error: { ok: false, text: "Could not connect your calendar. Please try again." },
    };
    setCalendarOutcome(map[cal] ?? { ok: false, text: "Could not connect your calendar. Please try again." });
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
      <div className="space-y-3 p-5 text-sm">
        {calendarOutcome && (
          <p role={calendarOutcome.ok ? "status" : "alert"} className={`rounded-lg border px-4 py-3 text-sm ${calendarOutcome.ok ? "border-success/30 bg-success/10" : "border-border bg-surface"}`}>
            {calendarOutcome.text}
          </p>
        )}
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
        <Link href="/dashboard/calendar" className="inline-block font-medium text-accent underline underline-offset-2">
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

/** What deleting an account removes, in the words the person sees. */
const WILL_REMOVE = [
  { Icon: Mic, text: "Your recordings, including the original audio and video files" },
  { Icon: FileText, text: "Transcripts, documents and action items" },
  { Icon: CalendarCheck, text: "Your booking pages, meeting types and bookings (upcoming guests are told their booking was cancelled)" },
  { Icon: CalendarDays, text: "Connected calendars and any meeting assistants that haven't joined yet" },
  { Icon: Gauge, text: "Your plan record, usage history and sign-in sessions" },
];

const HOW_IT_WORKS = [
  ["You confirm", "Type DELETE below."],
  ["A short wait", "Nothing is removed yet. You can cancel any time."],
  ["Everything goes", "Your data is removed and you're signed out."],
] as const;

const CONFIRM_WORD = "DELETE";

/** Settings > Delete account: a clear section and button, a careful confirmation dialog, and the progress once it is under way. */
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
  const tz = profile?.timezone ?? "UTC";

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

  function close() {
    if (busy) return;
    setOpen(false);
    setTyped("");
    setError(null);
  }

  async function submit() {
    if (typed !== CONFIRM_WORD || unavailable) return;
    setBusy(true);
    setError(null);
    try {
      setDeletion(await requestDeletion(typed));
      setOpen(false);
      setTyped("");
      window.dispatchEvent(new Event(ACCOUNT_CHANGED));
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
      window.dispatchEvent(new Event(ACCOUNT_CHANGED));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not cancel.");
      setDeletion(await fetchDeletion().catch(() => deletion));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Card className="border-danger/30">
        <CardHeader id="delete-account" title="Delete account" />
        <div className="p-5 text-sm">
          {deletion === undefined && !unavailable ? (
            <Loading label="Loading account deletion status" className="space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-9 w-40 rounded-lg" />
            </Loading>
          ) : deletion ? (
            <div role="status" className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={deletion.status === "requested" ? "warning" : deletion.status === "partial_failure" ? "danger" : "info"} active={deletion.status === "in_progress"}>
                  {deletion.status === "requested" ? "Waiting to start" : deletion.status === "in_progress" ? "Deleting" : "Still finishing"}
                </Badge>
                <span className="text-muted">Requested {formatDate(deletion.requestedAt, tz, true)}</span>
              </div>
              {deletion.status === "requested" && (
                <p className="rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-warning">
                  Nothing has been removed yet.{deletion.startsAt ? ` Removal starts after ${formatDate(deletion.startsAt, tz, true)}.` : ""} You can change your mind until then.
                </p>
              )}
              {deletion.status === "in_progress" && (
                <p className="text-muted">
                  Removal has started and can&rsquo;t be stopped. {deletion.filesRemoved > 0 && `${deletion.filesRemoved} audio ${deletion.filesRemoved === 1 ? "file" : "files"} removed so far. `}This page will close when it&rsquo;s done.
                </p>
              )}
              {deletion.status === "partial_failure" && (
                <p className="text-danger">
                  {deletion.filesFailed} audio {deletion.filesFailed === 1 ? "file" : "files"} could not be removed yet. Your account is not reported as deleted until every file is gone, and we keep retrying automatically. You don&rsquo;t need to do anything.
                </p>
              )}
              {deletion.canCancel && (
                <Button onClick={() => void cancel()} disabled={busy}>
                  {busy ? "Cancelling…" : "Cancel deletion"}
                </Button>
              )}
              {error && <p role="alert" className="text-danger">{error}</p>}
            </div>
          ) : (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="max-w-xl">
                <p className="font-medium">Delete your account and everything in it</p>
                <p className="mt-1 text-muted">Permanently removes your recordings, transcripts, documents and bookings. This can&rsquo;t be undone.</p>
              </div>
              <Button variant="danger" onClick={() => setOpen(true)} className="shrink-0">
                <Trash2 aria-hidden className="h-4 w-4" /> Delete account
              </Button>
            </div>
          )}
        </div>
      </Card>

      {open && (
        <Dialog title="Delete your account?" onClose={close} width="max-w-xl">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
            className="space-y-5"
            aria-label="Confirm account deletion">
            <div className="flex items-start gap-3 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-danger">
              <TriangleAlert aria-hidden className="mt-0.5 size-5 shrink-0" />
              <p>
                This permanently deletes {profile?.email ? <strong className="font-medium">{profile.email}</strong> : "your account"} and everything in it. It can&rsquo;t be undone.
              </p>
            </div>

            {unavailable && (
              <div role="status" className="flex items-start gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-muted">
                <CircleAlert aria-hidden className="mt-0.5 size-5 shrink-0" />
                <p>Account deletion isn&rsquo;t switched on for your account yet. You can look through the steps, but the final button is turned off and nothing will be deleted.</p>
              </div>
            )}

            <div>
              <p className="font-medium">This permanently removes</p>
              <ul className="mt-2 space-y-2">
                {WILL_REMOVE.map(({ Icon, text }) => (
                  <li key={text} className="flex items-start gap-3 text-muted">
                    <Icon aria-hidden className="mt-0.5 size-4 shrink-0 text-foreground" />
                    {text}
                  </li>
                ))}
              </ul>
            </div>

            <ol aria-label="How it works" className="grid gap-3 sm:grid-cols-3">
              {HOW_IT_WORKS.map(([title, body], i) => (
                <li key={title} className="rounded-xl border border-border p-3">
                  <span className="grid size-5 place-items-center rounded-full bg-surface text-[11px] font-medium text-muted">{i + 1}</span>
                  <p className="mt-2 font-medium">{title}</p>
                  <p className="mt-0.5 text-xs text-muted">{body}</p>
                </li>
              ))}
            </ol>

            <p className="text-xs text-muted">We keep only a one-way fingerprint of your email address, so we can find this request if you contact us. Copies you exported or downloaded are yours and aren&rsquo;t affected.</p>

            <label className="block">
              <span className="font-medium">Type {CONFIRM_WORD} to confirm</span>
              <span className="relative mt-1.5 block max-w-xs">
                <input
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  placeholder={CONFIRM_WORD}
                  autoComplete="off"
                  spellCheck={false}
                  aria-invalid={typed.length > 0 && typed !== CONFIRM_WORD}
                  className="block w-full rounded-lg border border-border bg-background px-3 py-2 pr-9 font-medium tracking-wide"
                />
                {typed === CONFIRM_WORD && <Check aria-hidden className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-emerald-600 dark:text-emerald-400" />}
              </span>
            </label>

            {error && <p role="alert" className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-2.5 text-danger">{error}</p>}

            <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
              <Button onClick={close} disabled={busy} data-autofocus>
                Keep my account
              </Button>
              <Button type="submit" variant="danger" disabled={typed !== CONFIRM_WORD || busy || unavailable}>
                <Trash2 aria-hidden className="h-4 w-4" /> {busy ? "Starting…" : "Delete my account"}
              </Button>
            </div>
          </form>
        </Dialog>
      )}
    </>
  );
}
