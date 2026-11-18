"use client";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { markResultSeen } from "@/lib/first-result";
import { ToastStack, useToasts } from "@/components/ui/toast";
import { useMeetingToasts } from "@/hooks/use-meeting-toasts";
import { SkeletonDetail } from "@/components/ui/skeleton";

import {
  FileText,
  Mic,
  TriangleAlert,
  Trash2,
  Video,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useProfile } from "@/components/shell/profile-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, tabId, tabPanelId } from "@/components/ui/tabs";
import { ActionsPanel } from "@/components/actions-panel";
import { ShareNotesDialog } from "@/components/sharing/share-notes-dialog";
import { MeetingVideo } from "./meeting-video";
import { MeetingPanel } from "@/components/meeting-panel";
import { TranscriptEditor } from "@/components/transcript-editor";
import { MeetingInsights } from "@/components/meeting-insights";
import { seekInsightAudio } from "@/lib/meeting-insights";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { TEMPLATE_CHOICES } from "@/lib/documents-client";
import { formatDuration } from "@/lib/audio";
import { captureStatus, documentStatus, timeAgo } from "@/lib/status";
import {
  type CaptureView,
  ApiError,
  PLATFORM_LABELS,
  isMeetingActive,
} from "@/lib/upload-client";
import { captureQuery, qk } from "@/lib/queries";
import { useCancelMeeting, useDeleteCapture, useCreateDocument } from "@/lib/mutations";

const titleOf = (c: CaptureView) => {
  const t = c.title?.trim();
  if (c.source === "meeting_url") {
    // The stored title is the (redacted) link; show a name instead.
    if (t && !/^https?:\/\//i.test(t)) return t;
    return c.platform
      ? `${PLATFORM_LABELS[c.platform] ?? "Meeting"} meeting`
      : "Meeting";
  }
  return (
    t ||
    (c.source === "voice_recording"
      ? "Voice note"
      : c.filename?.replace(/\.[^.]+$/, "") || "Untitled recording")
  );
};

const TABS = ["recording", "transcript", "documents", "actions"] as const;
type TabId = (typeof TABS)[number];

const formatBytes = (n: number) =>
  n < 1024 * 1024
    ? `${Math.max(1, Math.round(n / 1024))} KB`
    : `${(n / (1024 * 1024)).toFixed(1)} MB`;

export function CaptureDetail({
  id,
  devTools = false,
}: {
  id: string;
  devTools?: boolean;
}) {
  useEffect(() => {
    markResultSeen();
  }, []);
  const router = useRouter();
  const search = useSearchParams();
  const profile = useProfile();
  const qc = useQueryClient();
  // The real length, as reported by the audio itself once the browser has read its header.
  const [audioSeconds, setAudioSeconds] = useState<number | null>(null);
  // The template the user picked, else the one that suits their role, else a sensible general one.
  const [picked, setTemplate] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const template = picked ?? profile?.defaultTemplate ?? TEMPLATE_CHOICES[1].id;
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [mountedNow] = useState(() => Date.now());
  const meetingAudio = useRef<HTMLAudioElement>(null);
  const [seekTarget, setSeekTarget] = useState<{ captureId: string; startMs: number } | null>(null);
  const appliedSeek = useRef<typeof seekTarget>(null);
  useEffect(() => {
    if (seekTarget?.captureId === id && appliedSeek.current !== seekTarget && seekInsightAudio(meetingAudio.current, seekTarget.startMs)) appliedSeek.current = seekTarget;
  }, [id, search, seekTarget]);

  const cancelMutation = useCancelMeeting();
  const deleteMutation = useDeleteCapture();
  const createDocMutation = useCreateDocument();

  const { data: cap, error: queryError, isLoading } = useQuery({
    ...captureQuery(id),
    refetchInterval: (q) => {
      const data = q.state.data as CaptureView | undefined;
      if (!data) return false;
      const st = captureStatus({ source: data.source, state: data.state, status: data.status });
      const extracting = data.actions.state === "extracting";
      const videoPending = data.videoStatus === "requested" || data.videoStatus === "processing";
      // signed URLs expire ~5m; refresh while active or video still coming, even if capture says completed
      const needsVideo = videoPending;
      if (st.active || extracting || needsVideo) return 3000;
      return false;
    },
  });

  const toasts = useToasts(id);
  const watched = useMemo(() => cap ? [{ id: cap.id, title: titleOf(cap), source: cap.source, state: cap.state, status: cap.status }] : null, [cap]);
  useMeetingToasts(watched, toasts.push, id);

  const errorMessage = queryError
    ? queryError instanceof Error
      ? queryError.message
      : "Could not load this recording."
    : null;
  const notFound = queryError instanceof ApiError && queryError.status === 404;

  const busy = createDocMutation.isPending || deleteMutation.isPending;

  const refresh = () => qc.invalidateQueries({ queryKey: qk.capture(id) });

  const status = cap
    ? captureStatus({
        source: cap.source,
        state: cap.state,
        status: cap.status,
      })
    : null;
  const extracting = cap?.actions.state === "extracting";
  const videoComing = cap?.videoStatus === "processing";

  async function makeDocument() {
    try {
      const { documentId } = await createDocMutation.mutateAsync({ captureId: id, template });
      router.push(`/dashboard/library/${documentId}`);
    } catch (err) {
      // error is surfaced via mutation error; keep local error for display
      // use queryError handling pattern: set via local state if needed
    }
  }

  // surface mutation errors
  const docError = createDocMutation.error instanceof Error ? createDocMutation.error.message : null;
  const cancelError = cancelMutation.error instanceof Error ? cancelMutation.error.message : null;
  const deleteError = deleteMutation.error instanceof Error ? deleteMutation.error.message : null;
  const displayError = errorMessage ?? docError ?? cancelError ?? deleteError;

  async function cancelMeeting() {
    try {
      await cancelMutation.mutateAsync(id);
      // optimistic: mutation already invalidates; also force refresh
      refresh();
    } catch {
      // error handled via cancelError
    }
  }

  async function remove() {
    try {
      await deleteMutation.mutateAsync(id);
      router.push("/dashboard/library?tab=recordings");
    } catch {
      setConfirmDelete(false);
    }
  }

  if (notFound) {
    const goBack = () => {
      if (typeof window !== "undefined" && window.history.length > 1) router.back();
      else router.push("/dashboard/library");
    };
    return (
      <Card>
        <EmptyState
          title="Recording not found"
          body="It may have been deleted."
          action={
            <Link href="/dashboard/library?tab=recordings" onClick={goBack} className="text-sm font-medium text-accent hover:underline">
              Back to My Folder
            </Link>
          }
        />
      </Card>
    );
  }
  if (!cap || !status) {
    return displayError ? (
      <p
        role="alert"
        className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
        {displayError}
      </p>
    ) : isLoading ? (
      <SkeletonDetail label="Loading this recording" />
    ) : (
      <SkeletonDetail label="Loading this recording" />
    );
  }

  const ready = cap.state === "ready_to_review" || cap.state === "completed";
  const importedText = cap.source === "transcript_upload";
  const Icon = cap.source === "meeting_url" ? Video : importedText ? FileText : Mic;
  const meetingActive =
    cap.source === "meeting_url" && isMeetingActive(cap.status);
  // Land on the transcript once there is one; until then the recording tab shows what is happening.
  const asked = search.get("tab");
  const tab: TabId = importedText && asked === "recording" ? "transcript" : (TABS as readonly string[]).includes(asked ?? "")
    ? (asked as TabId)
    : ready
      ? "transcript"
      : "recording";

  return (
    <div className="space-y-5">
      <ToastStack items={toasts.items} onDismiss={toasts.dismiss} />
      <Breadcrumb items={[{ label: "My Folder", href: "/dashboard/library" }, { label: "Recordings", href: "/dashboard/library?tab=recordings" }, { label: cap.title || "Recording" }]} />

      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span
            aria-hidden
            className="grid h-10 w-11 shrink-0 place-items-center rounded-xl bg-surface text-muted">
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold tracking-tight">
              {titleOf(cap)}
            </h1>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
              <Badge tone={status.tone} active={status.active} indicator={status.indicator}>
                {status.label}
              </Badge>
              <span>
                {importedText ? "Imported transcript" : cap.source === "meeting_url"
                  ? "Meeting"
                  : cap.source === "voice_recording"
                    ? "Recorded in browser"
                    : "Uploaded"}
              </span>
              <span aria-hidden>·</span>
              <span>{timeAgo(cap.createdAt)}</span>
              {(cap as unknown as {durationSeconds?:number|null}).durationSeconds ? <><span aria-hidden>·</span><span>{formatDuration((cap as unknown as {durationSeconds:number}).durationSeconds)}</span></> : null}
              {cap.platform ? <><span aria-hidden>·</span><span>{PLATFORM_LABELS[cap.platform] ?? cap.platform}</span></> : null}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => setShareOpen(true)}>Share notes</Button>
          {meetingActive && (
            <Button onClick={() => void cancelMeeting()} disabled={cancelMutation.isPending}>Cancel capture</Button>
          )}
          {!meetingActive && (
            <Button
              variant="ghost"
              onClick={() => setConfirmDelete(true)}
              disabled={busy}>
              <Trash2 aria-hidden className="h-4 w-4" /> Delete
            </Button>
          )}
        </div>
        {shareOpen && <ShareNotesDialog captureId={id} open={shareOpen} onClose={() => setShareOpen(false)} />}
      </header>

      {!importedText && (() => {
        const ext = cap as unknown as {botName?:string|null;meetingUrl?:string|null;meeting_url?:string|null;durationSeconds?:number|null;participants?:Array<{name:string;role?:string}>;metadata?:Record<string,unknown>};
        const meetingUrl = ext.meetingUrl ?? ext.meeting_url ?? null;
        const usage = ext.durationSeconds != null ? formatDuration(ext.durationSeconds) : null;
        const joinAt = new Date(cap.createdAt).toLocaleString();
        return (
          <Card>
            <div className="space-y-4 p-5 text-sm">
              <div className="grid gap-3 sm:grid-cols-3">
                <div><p className="text-muted">Platform</p><p className="flex items-center gap-2 font-medium">{cap.platform ? <><Image src={cap.platform === "microsoft_teams" ? "/icons/icons8-teams-96.png" : cap.platform === "zoom" ? "/icons/icons8-zoom-96.png" : "/icons/icons8-google-meet-96.png"} alt={PLATFORM_LABELS[cap.platform] ?? cap.platform} width={20} height={20} className="h-5 w-5 shrink-0" />{PLATFORM_LABELS[cap.platform] ?? cap.platform}</> : "—"}</p></div>
                <div><p className="text-muted">Status</p><p className="font-medium">{status.label}</p></div>
                <div><p className="text-muted">Usage</p><p className="font-medium">{usage ?? "—"}</p></div>
              </div>
              <dl className="divide-y divide-border rounded-lg border border-border">
                <div className="grid grid-cols-[8rem_1fr] gap-3 px-4 py-3"><dt className="text-muted">Join At</dt><dd>{joinAt}</dd></div>
                <div className="grid grid-cols-[8rem_1fr] gap-3 px-4 py-3"><dt className="text-muted">Bot Name</dt><dd>{ext.botName ?? "—"}</dd></div>
                <div className="grid grid-cols-[8rem_1fr] gap-3 px-4 py-3"><dt className="text-muted">Metadata</dt><dd>{ext.metadata ? `${Object.keys(ext.metadata).length} field${Object.keys(ext.metadata).length===1?"":"s"}` : "—"}</dd></div>
                <div className="grid grid-cols-[8rem_1fr] gap-3 px-4 py-3"><dt className="text-muted">Meeting</dt><dd className="truncate">{meetingUrl ? <a href={meetingUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">{meetingUrl}</a> : "—"}</dd></div>
                <div className="px-4 py-3"><p className="text-muted">Participants · {(ext.participants?.length ?? 0) || 0}</p>{ext.participants?.length ? <ul className="mt-2 flex flex-wrap gap-2">{ext.participants.map((p,i)=><li key={i} className="rounded-full bg-surface px-3 py-1 text-xs">{p.name}{p.role ? ` · ${p.role}` : ""}</li>)}</ul> : <p className="mt-1 text-muted">No participant list yet.</p>}</div>
              </dl>
              {cap.events?.length ? <ul className="space-y-1 text-xs text-muted">{cap.events.slice(0,4).map((e,i)=><li key={i}>{e.at ? new Date(e.at).toLocaleString() : ""} — {e.status}{e.detail ? `: ${e.detail}` : ""}</li>)}</ul> : null}
            </div>
          </Card>
        );
      })()}

      {displayError && (
        <p
          role="alert"
          className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {displayError}
        </p>
      )}
      {status.active && mountedNow - new Date(cap.createdAt).getTime() > 15 * 60 * 1000 && (
        <div
          role="status"
          className="flex flex-col gap-2 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning sm:flex-row sm:items-center sm:justify-between">
          <span>Processing is taking longer than usual. You can wait for it to complete or delete it and try again.</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setConfirmDelete(true)}
            className="shrink-0 text-warning hover:bg-warning/20">
            Delete recording
          </Button>
        </div>
      )}
      {cap.state === "failed" && cap.failureReason && (
        <p
          role="alert"
          className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {cap.failureReason}
        </p>
      )}

      {confirmDelete && (
        <div
          role="alertdialog"
          aria-label="Confirm delete"
          className="rounded-2xl border border-border bg-surface p-5 text-sm">
          <p className="font-medium">Delete this recording?</p>
          <p className="mt-1 text-muted">
            The audio and transcript are deleted. Documents you made from it are
            kept.
          </p>
          <div className="mt-4 flex gap-2">
            <Button
              variant="danger"
              onClick={() => void remove()}
              disabled={busy}>
              Delete recording
            </Button>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      <MeetingInsights
        key={cap.id}
        id={cap.id}
        isMeeting={cap.source === "meeting_url"}
        hasTimestamps={!importedText}
        transcriptVersion={cap.transcriptVersion}
        audioAvailable={!importedText && !!cap.audio?.url}
        onSeek={startMs => {
          setSeekTarget({ captureId: cap.id, startMs });
          router.replace("?tab=recording", { scroll: false });
        }}
      />

      <Tabs
        label="Conversation"
        items={[
          ...(!importedText ? [{ id: "recording", label: "Recording" }] : []),
          { id: "transcript", label: "Transcript" },
          { id: "documents", label: "Documents", count: cap.documents.length },
          {
            id: "actions",
            label: "Actions",
            count: cap.actions.items.filter(
              (a: { status: string }) => a.status === "suggested" || a.status === "confirmed",
            ).length,
          },
        ]}
        active={tab}
        onChange={(t) => router.replace(`?tab=${t}`, { scroll: false })}
      />

      {tab === "recording" && cap.source === "meeting_url" && (
        <div
          role="tabpanel"
          id={tabPanelId("recording")}
          aria-labelledby={tabId("recording")}>
          <div className="space-y-4">
            {cap.recordVideo ? (
              <Card>
                <CardHeader title="Video" />
                <div className="p-5">
                  <MeetingVideo cap={cap} />
                </div>
              </Card>
            ) : null}
            {cap.audio?.url ? (
              <Card>
                <CardHeader title="Audio" />
                <div className="space-y-4 p-5 text-sm">
                  <audio ref={meetingAudio} controls preload="metadata" src={cap.audio.url} onLoadedMetadata={(e) => {
                    setAudioSeconds(Number.isFinite(e.currentTarget.duration) ? e.currentTarget.duration : null);
                    if (seekTarget?.captureId === id && appliedSeek.current !== seekTarget && seekInsightAudio(e.currentTarget, seekTarget.startMs)) appliedSeek.current = seekTarget;
                  }} className="w-full" aria-label="Meeting audio" />
                  <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
                    <div><dt className="text-muted">Source</dt><dd>Meeting</dd></div>
                    <div><dt className="text-muted">Added</dt><dd>{timeAgo(cap.createdAt)}</dd></div>
                    {audioSeconds !== null && <div><dt className="text-muted">Length</dt><dd>{formatDuration(audioSeconds)}</dd></div>}
                    <div><dt className="text-muted">Size</dt><dd>{formatBytes(cap.audio.sizeBytes)}</dd></div>
                  </dl>
                  <p className="text-xs text-muted">Signed link expires in a few minutes — page refresh renews it. Audio stays usable when video fails.</p>
                </div>
              </Card>
            ) : cap.audioStatus === "unavailable" ? (
              <Card>
                <CardHeader title="Audio" />
                <div className="p-5 text-sm">
                  <div role="status" className="flex items-start gap-3 rounded-lg border border-border bg-surface px-4 py-3">
                    <TriangleAlert aria-hidden className="mt-1 h-4 w-4 shrink-0 text-warning" />
                    <div><p className="font-medium">Audio no longer available</p><p className="mt-1 text-muted">It was removed as the privacy settings say. The transcript and documents are still here.</p></div>
                  </div>
                </div>
              </Card>
            ) : null}
            <MeetingPanel cap={cap} devTools={devTools} onChanged={refresh} />
          </div>
        </div>
      )}

      {tab === "recording" && cap.source !== "meeting_url" && !importedText && (
        <div
          role="tabpanel"
          id={tabPanelId("recording")}
          aria-labelledby={tabId("recording")}
          className="space-y-4">
          <Card>
            <CardHeader title="Recording" />
            <div className="space-y-4 p-5 text-sm">
              {cap.audio?.url ? (
                <>
                  {/* Signed URL valid ~5m — detail polling renews it. */}
                  <audio
                    ref={meetingAudio}
                    controls
                    preload="metadata"
                    src={cap.audio.url}
                    onLoadedMetadata={(e) =>
                      setAudioSeconds(
                        Number.isFinite(e.currentTarget.duration)
                          ? e.currentTarget.duration
                          : null,
                      )
                    }
                    className="w-full"
                    aria-label="Recording playback"
                  />
                  <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
                    <div>
                      <dt className="text-muted">Source</dt>
                      <dd>
                        {cap.source === "voice_recording"
                          ? "Recorded in the browser"
                          : "Uploaded file"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted">Added</dt>
                      <dd>{timeAgo(cap.createdAt)}</dd>
                    </div>
                    {audioSeconds !== null && (
                      <div>
                        <dt className="text-muted">Length</dt>
                        <dd>{formatDuration(audioSeconds)}</dd>
                      </div>
                    )}
                    <div>
                      <dt className="text-muted">Size</dt>
                      <dd>{formatBytes(cap.audio.sizeBytes)}</dd>
                    </div>
                    {cap.filename && (
                      <div className="sm:col-span-2">
                        <dt className="text-muted">File</dt>
                        <dd className="truncate">{cap.filename}</dd>
                      </div>
                    )}
                  </dl>
                  <p className="text-xs text-muted">
                    Only you can play this. If the audio is ever removed, the
                    transcript and your documents stay.
                  </p>
                </>
              ) : cap.audioStatus === "unavailable" ? (
                <div
                  role="status"
                  className="flex items-start gap-3 rounded-lg border border-border bg-surface px-4 py-3">
                  <TriangleAlert
                    aria-hidden
                    className="mt-1 h-4 w-4 shrink-0 text-warning"
                  />
                  <div>
                    <p className="font-medium">Audio no longer available</p>
                    <p className="mt-1 text-muted">
                      The recording has been removed. Its transcript and any
                      documents made from it are still here.
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-muted">The audio is still being uploaded.</p>
              )}
            </div>
          </Card>
          {status.active && (
            <p
              role="status"
              className="rounded-lg border border-border bg-surface px-4 py-3 text-sm">
              <span className="font-medium">{status.label}…</span>{" "}
              <span className="text-muted">
                This page updates by itself, so you can leave it and come back.
              </span>
            </p>
          )}
        </div>
      )}

      {tab === "transcript" && (
        <div
          role="tabpanel"
          id={tabPanelId("transcript")}
          aria-labelledby={tabId("transcript")}>
          <TranscriptEditor
            cap={cap}
            statusLabel={status.label}
            active={status.active}
            onChanged={refresh}
          />
        </div>
      )}

      {tab === "actions" && (
        <div
          role="tabpanel"
          id={tabPanelId("actions")}
          aria-labelledby={tabId("actions")}>
          <ActionsPanel cap={cap} onChanged={refresh} />
        </div>
      )}

      {tab === "documents" && (
        <div
          role="tabpanel"
          id={tabPanelId("documents")}
          aria-labelledby={tabId("documents")}
          className="grid gap-5 lg:grid-cols-2">
          <Card className="min-w-0">
            <CardHeader title="Make a document" />
            <div className="space-y-3 p-5">
              <label className="block text-sm">
                <span className="text-muted">Template</span>
                <select
                  value={template}
                  disabled={!ready}
                  onChange={(e) => setTemplate(e.target.value)}
                  className="mt-1 block w-full min-h-10 rounded-xl border border-border bg-background px-4 py-2 disabled:opacity-50">
                  {TEMPLATE_CHOICES.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>
              <Button
                variant="primary"
                className="w-full"
                disabled={!ready || busy}
                onClick={() => void makeDocument()}>
                <FileText aria-hidden className="h-4 w-4" />{" "}
                {busy ? "Starting…" : "Create document"}
              </Button>
              <p className="text-xs text-muted">
                {ready
                  ? "You can edit it freely afterwards."
                  : "Available once the transcript is ready."}
              </p>
            </div>
          </Card>

          <Card className="min-w-0">
            <CardHeader title="Documents from this recording" />
            {cap.documents.length === 0 ? (
              <p className="px-5 py-5 text-sm text-muted">None yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {cap.documents.map((d: { id: string; title: string; template: string; status: string; editedByUser: boolean }) => {
                  const ds = documentStatus({
                    status: d.status,
                    editedByUser: d.editedByUser,
                  });
                  return (
                    <li key={d.id}>
                      <Link
                        href={`/dashboard/library/${d.id}`}
                        className="flex items-center justify-between gap-3 px-5 py-3 text-sm hover:bg-surface">
                        <span className="truncate font-medium">
                          {d.title ||
                            TEMPLATE_CHOICES.find((t) => t.id === d.template)
                              ?.label ||
                            "Document"}
                        </span>
                        <Badge tone={ds.tone} active={ds.active} indicator={ds.indicator}>
                          {ds.label}
                        </Badge>
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
