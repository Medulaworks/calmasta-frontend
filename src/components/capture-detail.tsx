"use client";

import { ArrowLeft, FileText, Mic, Trash2, Video } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useProfile } from "@/components/shell/profile-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { TEMPLATE_CHOICES, createDocument } from "@/lib/documents-client";
import { formatDuration } from "@/lib/audio";
import { captureStatus, documentStatus, timeAgo } from "@/lib/status";
import { type CaptureView, ApiError, PLATFORM_LABELS, cancelMeetingCapture, deleteCapture, getCapture, isMeetingActive } from "@/lib/upload-client";

const titleOf = (c: CaptureView) => {
  const t = c.title?.trim();
  if (c.source === "meeting_url") {
    // The stored title is the (redacted) link; show a name instead.
    if (t && !/^https?:\/\//i.test(t)) return t;
    return c.platform ? `${PLATFORM_LABELS[c.platform] ?? "Meeting"} meeting` : "Meeting";
  }
  return t || (c.source === "voice_recording" ? "Voice note" : c.filename?.replace(/\.[^.]+$/, "") || "Untitled recording");
};

export function CaptureDetail({ id }: { id: string }) {
  const router = useRouter();
  const profile = useProfile();
  const [cap, setCap] = useState<CaptureView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [tick, setTick] = useState(0);
  // The template the user picked, else the one that suits their role, else a sensible general one.
  const [picked, setTemplate] = useState<string | null>(null);
  const template = picked ?? profile?.defaultTemplate ?? TEMPLATE_CHOICES[1].id;
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    getCapture(id).then(
      (c) => {
        if (cancelled) return;
        setCap(c);
        setError(null);
      },
      (err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) setNotFound(true);
        else setError(err instanceof Error ? err.message : "Could not load this recording.");
      },
    );
    return () => {
      cancelled = true;
    };
  }, [id, tick]);

  const status = cap ? captureStatus({ source: cap.source, state: cap.state, status: cap.status }) : null;
  useEffect(() => {
    if (!status?.active) return;
    const t = setInterval(refresh, 3000);
    return () => clearInterval(t);
  }, [status?.active, refresh]);

  async function makeDocument() {
    setBusy(true);
    setError(null);
    try {
      const { documentId } = await createDocument(id, template);
      router.push(`/library/${documentId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start the document.");
      setBusy(false);
    }
  }

  async function cancelMeeting() {
    setError(null);
    try {
      await cancelMeetingCapture(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not cancel.");
    }
    refresh();
  }

  async function remove() {
    setBusy(true);
    try {
      await deleteCapture(id);
      router.push("/library?tab=recordings");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete.");
      setBusy(false);
      setConfirmDelete(false);
    }
  }

  if (notFound) {
    return (
      <Card>
        <EmptyState title="Recording not found" body="It may have been deleted." action={<Link href="/library?tab=recordings" className="text-sm text-accent">Back to Library</Link>} />
      </Card>
    );
  }
  if (!cap || !status) {
    return error ? (
      <p role="alert" className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>
    ) : (
      <div className="space-y-4" aria-hidden>
        <div className="h-8 w-64 animate-pulse rounded bg-border" />
        <div className="h-48 animate-pulse rounded-xl bg-border/50" />
      </div>
    );
  }

  const ready = cap.state === "ready_to_review" || cap.state === "completed";
  const Icon = cap.source === "meeting_url" ? Video : Mic;
  const meetingActive = cap.source === "meeting_url" && isMeetingActive(cap.status);

  return (
    <div className="space-y-6">
      <Link href="/library?tab=recordings" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
        <ArrowLeft aria-hidden className="h-4 w-4" /> Library
      </Link>

      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span aria-hidden className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-surface text-muted">
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold tracking-tight">{titleOf(cap)}</h1>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
              <Badge tone={status.tone} active={status.active}>{status.label}</Badge>
              <span>{cap.source === "meeting_url" ? "Meeting" : cap.source === "voice_recording" ? "Recorded in browser" : "Uploaded"}</span>
              <span aria-hidden>·</span>
              <span>{timeAgo(cap.createdAt)}</span>
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {meetingActive && <Button onClick={() => void cancelMeeting()}>Cancel capture</Button>}
          {!meetingActive && (
            <Button variant="ghost" onClick={() => setConfirmDelete(true)} disabled={busy}>
              <Trash2 aria-hidden className="h-4 w-4" /> Delete
            </Button>
          )}
        </div>
      </header>

      {error && <p role="alert" className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>}
      {cap.state === "failed" && cap.failureReason && (
        <p role="alert" className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">{cap.failureReason}</p>
      )}

      {confirmDelete && (
        <div role="alertdialog" aria-label="Confirm delete" className="rounded-xl border border-border bg-surface p-5 text-sm">
          <p className="font-medium">Delete this recording?</p>
          <p className="mt-1 text-muted">The audio and transcript are deleted. Documents you made from it are kept.</p>
          <div className="mt-4 flex gap-2">
            <Button variant="danger" onClick={() => void remove()} disabled={busy}>Delete recording</Button>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>Cancel</Button>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="min-w-0 lg:col-span-2">
          <CardHeader title="Transcript" />
          {ready && cap.transcript.length > 0 ? (
            <ol className="divide-y divide-border">
              {cap.transcript.map((seg) => (
                <li key={seg.id} className="flex gap-4 px-5 py-3 text-sm">
                  <span className="w-12 shrink-0 pt-0.5 font-mono text-xs text-muted">{formatDuration(seg.startMs / 1000)}</span>
                  <p className="min-w-0">
                    {seg.speakerId && <span className="mr-2 text-xs font-medium text-muted">{seg.speakerId}</span>}
                    {seg.text}
                  </p>
                </li>
              ))}
            </ol>
          ) : status.active ? (
            <EmptyState icon={<Mic className="h-5 w-5" />} title={`${status.label}…`} body="This page updates by itself." />
          ) : cap.source === "meeting_url" && cap.state !== "failed" ? (
            <EmptyState icon={<Video className="h-5 w-5" />} title="No transcript yet" body="Meeting transcripts appear here once the meeting has ended and a capture provider is connected." />
          ) : (
            <EmptyState title="No transcript" body="There is nothing to show for this recording." />
          )}
        </Card>

        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader title="Make a document" />
            <div className="space-y-3 p-5">
              <label className="block text-sm">
                <span className="text-muted">Template</span>
                <select
                  value={template}
                  disabled={!ready}
                  onChange={(e) => setTemplate(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2 disabled:opacity-50"
                >
                  {TEMPLATE_CHOICES.map((t) => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                  ))}
                </select>
              </label>
              <Button variant="primary" className="w-full" disabled={!ready || busy} onClick={() => void makeDocument()}>
                <FileText aria-hidden className="h-4 w-4" /> {busy ? "Starting…" : "Create document"}
              </Button>
              <p className="text-xs text-muted">{ready ? "You can edit it freely afterwards." : "Available once the transcript is ready."}</p>
            </div>
          </Card>

          <Card>
            <CardHeader title="Documents from this recording" />
            {cap.documents.length === 0 ? (
              <p className="px-5 py-6 text-sm text-muted">None yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {cap.documents.map((d) => {
                  const ds = documentStatus({ status: d.status });
                  return (
                    <li key={d.id}>
                      <Link href={`/library/${d.id}`} className="flex items-center justify-between gap-3 px-5 py-3 text-sm hover:bg-surface">
                        <span className="truncate font-medium">{d.title || TEMPLATE_CHOICES.find((t) => t.id === d.template)?.label || "Document"}</span>
                        <Badge tone={ds.tone} active={ds.active}>{ds.label}</Badge>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
