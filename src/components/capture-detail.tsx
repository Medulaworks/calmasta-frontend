"use client";

import { ArrowLeft, FileText, Mic, TriangleAlert, Trash2, Video } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useProfile } from "@/components/shell/profile-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, tabId, tabPanelId } from "@/components/ui/tabs";
import { ActionsPanel } from "@/components/actions-panel";
import { MeetingVideo } from "./meeting-video";
import { MeetingPanel } from "@/components/meeting-panel";
import { TranscriptEditor } from "@/components/transcript-editor";
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

const TABS = ["recording", "transcript", "documents", "actions"] as const;
type TabId = (typeof TABS)[number];

const formatBytes = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / (1024 * 1024)).toFixed(1)} MB`);

export function CaptureDetail({ id, devTools = false }: { id: string; devTools?: boolean }) {
  const router = useRouter();
  const search = useSearchParams();
  const profile = useProfile();
  const [cap, setCap] = useState<CaptureView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [tick, setTick] = useState(0);
  // The real length, as reported by the audio itself once the browser has read its header.
  const [audioSeconds, setAudioSeconds] = useState<number | null>(null);
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
  const extracting = cap?.actions.state === "extracting";
  // The video is saved a little after the meeting ends, so keep looking until it is there (or has failed).
  const videoComing = cap?.videoStatus === "processing";
  useEffect(() => {
    if (!status?.active && !extracting && !videoComing) return;
    const t = setInterval(refresh, 3000);
    return () => clearInterval(t);
  }, [status?.active, extracting, videoComing, refresh]);

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
  // Land on the transcript once there is one; until then the recording tab shows what is happening.
  const asked = search.get("tab");
  const tab: TabId = (TABS as readonly string[]).includes(asked ?? "") ? (asked as TabId) : ready ? "transcript" : "recording";

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

      <Tabs
        label="Conversation"
        items={[
          { id: "recording", label: "Recording" },
          { id: "transcript", label: "Transcript" },
          { id: "documents", label: "Documents", count: cap.documents.length },
          { id: "actions", label: "Actions", count: cap.actions.items.filter((a) => a.status === "suggested" || a.status === "confirmed").length },
        ]}
        active={tab}
        onChange={(t) => router.replace(`?tab=${t}`, { scroll: false })}
      />

      {tab === "recording" && cap.source === "meeting_url" && (
        <div role="tabpanel" id={tabPanelId("recording")} aria-labelledby={tabId("recording")}>
          <div className="space-y-4">
            {cap.recordVideo && (
              <Card>
                <CardHeader title="Video" />
                <div className="p-5"><MeetingVideo cap={cap} /></div>
              </Card>
            )}
            <MeetingPanel cap={cap} devTools={devTools} onChanged={refresh} />
          </div>
        </div>
      )}

      {tab === "recording" && cap.source !== "meeting_url" && (
        <div role="tabpanel" id={tabPanelId("recording")} aria-labelledby={tabId("recording")} className="space-y-4">
          <Card>
            <CardHeader title="Recording" />
            <div className="space-y-4 p-5 text-sm">
              {cap.audio ? (
                <>
                  {/* A short-lived, signed link: the audio is private to this user and the link stops working soon after. */}
                  <audio
                    controls
                    preload="metadata"
                    src={cap.audio.url}
                    onLoadedMetadata={(e) => setAudioSeconds(Number.isFinite(e.currentTarget.duration) ? e.currentTarget.duration : null)}
                    className="w-full"
                    aria-label="Recording playback"
                  />
                  <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
                    <div><dt className="text-muted">Source</dt><dd>{cap.source === "voice_recording" ? "Recorded in the browser" : "Uploaded file"}</dd></div>
                    <div><dt className="text-muted">Added</dt><dd>{timeAgo(cap.createdAt)}</dd></div>
                    {audioSeconds !== null && <div><dt className="text-muted">Length</dt><dd>{formatDuration(audioSeconds)}</dd></div>}
                    <div><dt className="text-muted">Size</dt><dd>{formatBytes(cap.audio.sizeBytes)}</dd></div>
                    {cap.filename && <div className="sm:col-span-2"><dt className="text-muted">File</dt><dd className="truncate">{cap.filename}</dd></div>}
                  </dl>
                  <p className="text-xs text-muted">Only you can play this. If the audio is ever removed, the transcript and your documents stay.</p>
                </>
              ) : cap.audioStatus === "unavailable" ? (
                <div role="status" className="flex items-start gap-3 rounded-lg border border-border bg-surface px-4 py-3">
                  <TriangleAlert aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                  <div>
                    <p className="font-medium">Audio no longer available</p>
                    <p className="mt-0.5 text-muted">The recording has been removed. Its transcript and any documents made from it are still here.</p>
                  </div>
                </div>
              ) : cap.source === "meeting_url" ? (
                <p className="text-muted">Meetings are captured by the Mojooba Assistant. There is no audio file to play here; the transcript appears in the Transcript tab once the meeting has ended and a capture provider is connected.</p>
              ) : (
                <p className="text-muted">The audio is still being uploaded.</p>
              )}
            </div>
          </Card>
          {status.active && (
            <p role="status" className="rounded-lg border border-border bg-surface px-4 py-3 text-sm">
              <span className="font-medium">{status.label}…</span> <span className="text-muted">This page updates by itself, so you can leave it and come back.</span>
            </p>
          )}
        </div>
      )}

      {tab === "transcript" && (
        <div role="tabpanel" id={tabPanelId("transcript")} aria-labelledby={tabId("transcript")}>
          <TranscriptEditor cap={cap} statusLabel={status.label} active={status.active} onChanged={refresh} />
        </div>
      )}

      {tab === "actions" && (
        <div role="tabpanel" id={tabPanelId("actions")} aria-labelledby={tabId("actions")}>
          <ActionsPanel cap={cap} onChanged={refresh} />
        </div>
      )}

      {tab === "documents" && (
        <div role="tabpanel" id={tabPanelId("documents")} aria-labelledby={tabId("documents")} className="grid gap-6 lg:grid-cols-2">
          <Card className="min-w-0">
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

          <Card className="min-w-0">
            <CardHeader title="Documents from this recording" />
            {cap.documents.length === 0 ? (
              <p className="px-5 py-6 text-sm text-muted">None yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {cap.documents.map((d) => {
                  const ds = documentStatus({ status: d.status, editedByUser: d.editedByUser });
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
      )}
    </div>
  );
}
