"use client";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { SkeletonDetail } from "@/components/ui/skeleton";
import { markResultSeen } from "@/lib/first-result";
import { useRouter } from "next/navigation";
import {
  readInsightTab,
  insightSearch,
  listenInsightNavigation,
  updateInsightUrl,
} from "@/lib/insight-navigation";
import { Bot, CalendarDays, Check, Clock, ExternalLink, FileText, Mic, Timer, Users, Video } from "lucide-react";
import { Button, buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, tabId, tabPanelId } from "@/components/ui/tabs";
import { PrivateAudio } from "@/components/private-audio";
import { ShareNotesDialog } from "@/components/sharing/share-notes-dialog";
import { MeetingVideo } from "@/components/meeting-video";
import { MeetingInsights } from "@/components/meeting-insights";
import { seekInsightAudio } from "@/lib/meeting-insights";
import { useCallback, useEffect, useState } from "react";
import { TranscriptEditor } from "@/components/transcript-editor";
import { getLibraryCapture, saveLibraryTranscript } from "@/lib/library-client";
import {
  type CaptureView,
  ApiError,
  cancelMeetingCapture,
  retryMeeting,
  isMeetingActive,
  PLATFORM_LABELS,
} from "@/lib/upload-client";
import { captureStatus } from "@/lib/status";
import { formatDuration } from "@/lib/audio";
import { RowStatus } from "@/components/dashboard/item-row";
import { useProfile } from "@/components/shell/profile-context";
import { useDisplayTitle } from "@/components/shell/use-display-title";
import { CaptureTile } from "@/components/ui/platform-logo";
import { browserTimeZone, formatDateTime } from "@/lib/tz";
type Ext = {
  botName?: string | null;
  meetingUrl?: string | null;
  meeting_url?: string | null;
  durationSeconds?: number | null;
  participants?: Array<{ name: string; role?: string }>;
  metadata?: Record<string, unknown>;
  createdAt: string;
  events?: Array<{ status: string; detail: string | null; at: string }>;
};

/** The breadcrumb, with the title the rest of the app shows (a real one, or "Meeting on 29 Oct, 10:15"). */
function RecordingCrumb({ capture, createdAt }: { capture: CaptureView | null; createdAt?: string }) {
  const titleOf = useDisplayTitle();
  const label = capture ? titleOf({ title: capture.title, source: capture.source, at: createdAt }) : "Recording";
  return <Breadcrumb items={[{ label: "My Folder", href: "/dashboard/library" }, { label: "Recordings", href: "/dashboard/library?tab=recordings" }, { label }]} />;
}

const chip = "inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1 text-xs font-medium text-muted ring-1 ring-inset ring-border";

type Common = { capture: CaptureView; ext: Ext; isMeeting: boolean; meetingUrl: string | null; duration: string | null };

/** Who and what: the title, where it is up to, the few facts that matter, and the actions that apply. */
function RecordingHeader({ capture, ext, status, isMeeting, meetingUrl, duration, retryable, busy, consent, setConsent, act }: Common & { status: ReturnType<typeof captureStatus> | null; retryable: boolean; busy: boolean; consent: boolean; setConsent: (v: boolean) => void; act: (retry: boolean) => Promise<void> }) {
  const titleOf = useDisplayTitle();
  const timeZone = useProfile()?.timezone || browserTimeZone();
  const shownTitle = titleOf({ title: capture.title, source: capture.source, at: ext.createdAt });
  return (
    <>
      {/* Who and what: the title, where it is up to, and the few facts that matter, with the actions that apply. */}
      <header className="rounded-2xl border border-border bg-background p-5 shadow-sm">
        <div className="flex flex-wrap items-start gap-4">
          <CaptureTile kind={isMeeting ? "meeting" : "recording"} platform={capture.platform} hint={capture.title} size={56} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <h1 className="truncate text-2xl font-semibold tracking-tight">{shownTitle}</h1>
              {status && <span role="status"><RowStatus status={status} /></span>}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {isMeeting && capture.platform && <span className={chip}>{PLATFORM_LABELS[capture.platform] ?? capture.platform}</span>}
              {duration && <span className={chip} title="Length of the recording"><Timer aria-hidden className="size-3.5" /> {duration}</span>}
              <span className={chip}><CalendarDays aria-hidden className="size-3.5" /> {isMeeting ? "Joined" : "Recorded"} {formatDateTime(ext.createdAt, timeZone)}</span>
            </div>
          </div>
          <div role={isMeeting ? "group" : undefined} aria-label={isMeeting ? "Meeting controls" : undefined} className="flex flex-wrap items-center gap-2">
            {meetingUrl && (
              <a href={meetingUrl} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary", "", "sm")}>
                <ExternalLink aria-hidden className="size-4" /> Open meeting
              </a>
            )}
            {isMeeting && isMeetingActive(capture.status) && (
              <Button size="sm" disabled={busy || !!capture.cancelRequestedAt} onClick={() => void act(false)}>
                {capture.cancelRequestedAt ? "Cancellation requested" : "Cancel capture"}
              </Button>
            )}
          </div>
        </div>
        {retryable && (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-xl bg-surface p-4">
            <label className="flex max-w-xl items-start gap-3 text-sm">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 size-4 shrink-0 accent-[var(--accent-solid)]" />
              I have the right to record this meeting again and will tell its participants.
            </label>
            <Button variant="primary" disabled={busy || !consent} onClick={() => void act(true)}>{busy ? "Sending…" : "Send assistant again"}</Button>
          </div>
        )}
      </header>
    </>
  );
}

const EVENT_LABELS: Record<string, { title: string; desc: string; Icon: typeof Clock }> = {
  queued: { title: "Queued", desc: "Added to the processing queue", Icon: Clock },
  video_ready: { title: "Video ready", desc: "Recording secured and ready", Icon: Video },
  transcript_ready: { title: "Transcript ready", desc: "Transcript available for insights", Icon: FileText },
};

/** The facts and the timeline. */
function RecordingAside({ capture, ext, isMeeting, meetingUrl, duration }: Common) {
  const timeZone = useProfile()?.timezone || browserTimeZone();
  const metaFields = ext.metadata ? Object.keys(ext.metadata).length : 0;
  return (
    <aside className="space-y-5 lg:sticky lg:top-24">
      <Card>
        <div className="border-b border-border px-5 py-3"><h2 className="text-base font-semibold">Details</h2></div>
        <dl className="divide-y divide-border text-sm">
          <div className="flex items-start gap-3 px-5 py-3"><CalendarDays aria-hidden className="mt-0.5 size-4 shrink-0 text-muted" /><dt className="w-20 shrink-0 text-muted">{isMeeting ? "Joined" : "Recorded"}</dt><dd className="min-w-0 flex-1 font-medium">{formatDateTime(ext.createdAt, timeZone)}</dd></div>
          {isMeeting && <div className="flex items-start gap-3 px-5 py-3"><Bot aria-hidden className="mt-0.5 size-4 shrink-0 text-muted" /><dt className="w-20 shrink-0 text-muted">Assistant</dt><dd className="min-w-0 flex-1 font-medium">{ext.botName ?? "—"}</dd></div>}
          {!isMeeting && <div className="flex items-start gap-3 px-5 py-3"><Mic aria-hidden className="mt-0.5 size-4 shrink-0 text-muted" /><dt className="w-20 shrink-0 text-muted">Source</dt><dd className="min-w-0 flex-1 font-medium">{capture.source === "voice_recording" ? "Recorded in browser" : "Upload"}</dd></div>}
          {duration && <div className="flex items-start gap-3 px-5 py-3"><Timer aria-hidden className="mt-0.5 size-4 shrink-0 text-muted" /><dt className="w-20 shrink-0 text-muted">Length</dt><dd className="min-w-0 flex-1 font-medium tabular-nums">{duration}</dd></div>}
          {meetingUrl && <div className="flex items-start gap-3 px-5 py-3"><ExternalLink aria-hidden className="mt-0.5 size-4 shrink-0 text-muted" /><dt className="w-20 shrink-0 text-muted">Meeting</dt><dd className="min-w-0 flex-1 truncate font-medium"><a href={meetingUrl} target="_blank" rel="noopener noreferrer" title={meetingUrl} className="text-accent hover:underline">{meetingUrl.replace(/^https?:\/\//, "")}</a></dd></div>}
          {isMeeting && (
            <div className="px-5 py-3">
              <p className="flex items-center gap-3 text-muted"><Users aria-hidden className="size-4 shrink-0" /> Participants{ext.participants?.length ? ` · ${ext.participants.length}` : ""}</p>
              {ext.participants?.length ? (
                <ul className="mt-2 flex flex-wrap gap-2">
                  {ext.participants.map((p, i) => <li key={i} className="rounded-full bg-surface px-3 py-1 text-xs ring-1 ring-inset ring-border">{String(p.name).slice(0, 80)}{p.role ? ` · ${String(p.role).slice(0, 40)}` : ""}</li>)}
                </ul>
              ) : (() => {
                const rosterState = (capture as unknown as { rosterState?: string }).rosterState;
                if (rosterState === "pending") return <p className="mt-1 pl-7 text-xs text-muted">Participant list pending…</p>;
                if (rosterState === "unavailable") return <p className="mt-1 pl-7 text-xs text-muted">Participant list unavailable.</p>;
                if (rosterState === "expired") return <p className="mt-1 pl-7 text-xs text-muted">Participant list expired.</p>;
                return <p className="mt-1 pl-7 text-xs text-muted">No participant list yet.</p>;
              })()}
            </div>
          )}
          {metaFields > 0 && <div className="flex items-start gap-3 px-5 py-3"><FileText aria-hidden className="mt-0.5 size-4 shrink-0 text-muted" /><dt className="w-20 shrink-0 text-muted">Metadata</dt><dd className="min-w-0 flex-1 font-medium">{metaFields} field{metaFields === 1 ? "" : "s"}</dd></div>}
        </dl>
      </Card>

      {ext.events?.length ? (
        <Card>
          <div className="border-b border-border px-5 py-3"><h2 className="text-base font-semibold">Timeline</h2></div>
          <ol aria-label="Timeline" className="p-5">
            {ext.events.slice(0, 8).map((ev, i, all) => {
              const meta = EVENT_LABELS[ev.status] ?? { title: ev.status.replace(/_/g, " "), desc: ev.detail ?? "", Icon: Clock };
              const last = i === all.length - 1;
              return (
                <li key={i} className="relative flex gap-4 pb-5 last:pb-0">
                  {!last && <span aria-hidden className="absolute left-4 top-9 h-[calc(100%-2rem)] w-px bg-border" />}
                  <span aria-hidden className={`relative z-10 grid size-8 shrink-0 place-items-center rounded-full ${last ? "bg-success text-white" : "border border-border bg-background text-muted"}`}>
                    {last ? <Check className="size-4" strokeWidth={3} /> : <meta.Icon className="size-4" />}
                  </span>
                  <span className="min-w-0 flex-1 pt-0.5">
                    <span className="block text-sm font-medium capitalize">{meta.title}</span>
                    <span className="block text-xs text-muted tabular-nums">{ev.at ? formatDateTime(ev.at, timeZone) : ""}</span>
                    {(meta.desc || (ev.detail && !EVENT_LABELS[ev.status])) && <span className="mt-1 block text-xs text-muted">{meta.desc}{ev.detail && !EVENT_LABELS[ev.status] ? `: ${ev.detail}` : ""}</span>}
                  </span>
                </li>
              );
            })}
          </ol>
        </Card>
      ) : null}
    </aside>
  );
}

export function LibraryRecording({ id }: { id: string }) {
  useEffect(() => {
    markResultSeen();
  }, []);
  const router = useRouter();
  const [selectedContent, setSelectedContent] = useState<{
    captureId: string;
    tab: "transcript" | "insights";
  }>({ captureId: id, tab: "insights" });
  useEffect(() => {
    const sync = () =>
      setSelectedContent({
        captureId: id,
        tab: readInsightTab(insightSearch()),
      });
    sync();
    return listenInsightNavigation(sync);
  }, [id]);
  const [insightAudio, setInsightAudio] = useState<{
    captureId: string;
    element: HTMLAudioElement;
  } | null>(null);
  const onAudioChange = useCallback(
    (audio: HTMLAudioElement | null) => {
      setInsightAudio(
        audio && audio.readyState >= 1
          ? { captureId: id, element: audio }
          : null,
      );
    },
    [id],
  );
  const [consent, setConsent] = useState(false),
    [busy, setBusy] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [capture, setCapture] = useState<CaptureView | null>(null),
    [error, setError] = useState<string | null>(null),
    [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((v) => v + 1), []);
  useEffect(() => {
    const ctrl = new AbortController();
    getLibraryCapture(id, ctrl.signal).then(
      (c) => {
        if (!ctrl.signal.aborted) {
          setCapture(c);
          setError(null);
        }
      },
      (e) => {
        if (!ctrl.signal.aborted)
          setError(
            e instanceof ApiError && e.status === 404
              ? "This recording is unavailable."
              : e instanceof Error
                ? e.message
                : "Could not load recording.",
          );
      },
    );
    return () => ctrl.abort();
  }, [id, revision]);
  const status = capture ? captureStatus(capture) : null;
  const active =
    !!capture &&
    [
      "requested",
      "queued",
      "joining",
      "waiting_for_admission",
      "recording",
      "processing",
      "media_pending",
      "recorded",
    ].includes(capture.state);
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(refresh, 3000);
    return () => clearInterval(timer);
  }, [active, refresh]);
  async function act(retry: boolean) {
    setBusy(true);
    setError(null);
    try {
      if (retry) {
        const next = await retryMeeting(id, consent);
        router.push(`/dashboard/library/recordings/${next.captureId}`);
      } else {
        await cancelMeetingCapture(id);
        refresh();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update capture.");
    } finally {
      setBusy(false);
    }
  }
  const transcriptEditor = capture ? (
    <TranscriptEditor
      key={capture.id}
      cap={capture}
      statusLabel={status?.label ?? "Processing"}
      active={active}
      onChanged={refresh}
      loadCapture={getLibraryCapture}
      saveChanges={saveLibraryTranscript}
    />
  ) : null;
  const isMeeting = capture?.source === "meeting_url";
  const ext = capture as unknown as Ext | null;
  const meetingUrl = ext?.meetingUrl ?? ext?.meeting_url ?? null;
  const duration = ext?.durationSeconds != null ? formatDuration(ext.durationSeconds) : null;
  const retryable = !!capture && isMeeting && ["host_denied", "admission_timeout", "cancelled", "failed"].includes(capture.state);

  return (
    <div className="space-y-5">
      <RecordingCrumb capture={capture} createdAt={(capture as unknown as Ext | null)?.createdAt} />
      {error && <p role="alert" className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>}
      {capture && ext ? (
        <>
          <div className="flex justify-end"><Button variant="ghost" size="sm" onClick={() => setShareOpen(true)}>Share notes</Button></div>
          <RecordingHeader capture={capture} ext={ext} status={status} isMeeting={isMeeting} meetingUrl={meetingUrl} duration={duration} retryable={retryable} busy={busy} consent={consent} setConsent={setConsent} act={act} />
          {shareOpen && <ShareNotesDialog captureId={id} open={shareOpen} onClose={() => setShareOpen(false)} />}

          <div className="grid items-start gap-5 lg:grid-cols-3">
            {/* The content: the audio, then what was said. */}
            <div className="min-w-0 space-y-5 lg:col-span-2">
              {isMeeting && capture.recordVideo && <MeetingVideo cap={capture} />}
              <div id="recording-audio">
                <PrivateAudio key={capture.id} id={capture.id} onAudioChange={onAudioChange} />
              </div>
              {isMeeting ? (
                <Card className="overflow-visible">
                  <div className="sticky top-16 z-10 rounded-t-2xl border-b border-border bg-background px-5 pt-4">
                    <Tabs
                      label="Recording details"
                      items={[
                        { id: `recording-${capture.id}-insights`, label: "Meeting insights" },
                        { id: `recording-${capture.id}-transcript`, label: "Transcript" },
                      ]}
                      active={`recording-${capture.id}-${selectedContent.captureId === capture.id ? selectedContent.tab : "insights"}`}
                      onChange={(value) => {
                        const tab = value === `recording-${capture.id}-insights` ? "insights" : "transcript";
                        setSelectedContent({ captureId: capture.id, tab });
                        updateInsightUrl({ tab });
                      }}
                    />
                  </div>
                  <div
                    role="tabpanel"
                    id={tabPanelId(`recording-${capture.id}-transcript`)}
                    aria-labelledby={tabId(`recording-${capture.id}-transcript`)}
                    hidden={selectedContent.captureId === capture.id && selectedContent.tab !== "transcript"}
                    tabIndex={0}
                    className="p-5">
                    {transcriptEditor}
                  </div>
                  <div
                    role="tabpanel"
                    id={tabPanelId(`recording-${capture.id}-insights`)}
                    aria-labelledby={tabId(`recording-${capture.id}-insights`)}
                    hidden={selectedContent.captureId !== capture.id || selectedContent.tab !== "insights"}
                    tabIndex={0}
                    className="p-5">
                    <MeetingInsights
                      key={capture.id}
                      id={capture.id}
                      transcriptVersion={capture.transcriptVersion}
                      audioAvailable={insightAudio?.captureId === capture.id && capture.id === id}
                      onSeek={(startMs) => {
                        if (insightAudio?.captureId === capture.id && capture.id === id) seekInsightAudio(insightAudio.element, startMs);
                      }}
                    />
                  </div>
                </Card>
              ) : (
                transcriptEditor
              )}
            </div>

            <RecordingAside capture={capture} ext={ext} isMeeting={isMeeting} meetingUrl={meetingUrl} duration={duration} />
          </div>
        </>
      ) : (
        !error && <SkeletonDetail label="Loading this recording" />
      )}
    </div>
  );
}
