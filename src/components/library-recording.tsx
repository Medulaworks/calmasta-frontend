"use client";
import { useRouter } from "next/navigation";
import {
  readInsightTab,
  insightSearch,
  listenInsightNavigation,
  updateInsightUrl,
} from "@/lib/insight-navigation";
import { Clock, FileText, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, tabId, tabPanelId } from "@/components/ui/tabs";
import { PrivateAudio } from "@/components/private-audio";
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
import Image from "next/image";
export function LibraryRecording({ id }: { id: string }) {
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
  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={() => router.back()}
        className="text-sm text-muted underline">
        Go Back
      </button>
      {error && (
        <p role="alert" className="text-danger">
          {error}
        </p>
      )}
      {capture ? (
        <>
          <h1 className="text-2xl font-semibold">
            {capture.title || "Recording"}
          </h1>
          <p role="status" className="text-sm text-muted">
            {status?.label}
          </p>
          {(() => {
            const ext = capture as unknown as {
              botName?: string | null;
              meetingUrl?: string | null;
              meeting_url?: string | null;
              durationSeconds?: number | null;
              participants?: Array<{ name: string; role?: string }>;
              metadata?: Record<string, unknown>;
            };
            const meetingUrl = ext.meetingUrl ?? ext.meeting_url ?? null;
            const usage =
              ext.durationSeconds != null
                ? formatDuration(ext.durationSeconds)
                : null;
            const joinAt = new Date(
              (capture as unknown as { createdAt: string }).createdAt,
            ).toLocaleString();
            return (
              <Card>
                <div className="grid gap-6 p-5 text-sm lg:grid-cols-[minmax(0,1fr)_320px]">
                  <div className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div>
                        <p className="text-muted">Platform</p>
                        <p className="flex items-center gap-2 font-medium">
                          {capture.platform ? (
                            <>
                              <Image
                                src={
                                  capture.platform === "microsoft_teams"
                                    ? "/icons/icons8-teams-96.png"
                                    : capture.platform === "zoom"
                                      ? "/icons/icons8-zoom-96.png"
                                      : "/icons/icons8-google-meet-96.png"
                                }
                                alt={
                                  PLATFORM_LABELS[capture.platform] ??
                                  capture.platform
                                }
                                width={20}
                                height={20}
                                className="h-5 w-5 shrink-0"
                              />
                              {PLATFORM_LABELS[capture.platform] ??
                                capture.platform}
                            </>
                          ) : (
                            "—"
                          )}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted">Status</p>
                        <p className="font-medium">{status?.label ?? "—"}</p>
                      </div>
                      <div>
                        <p className="text-muted">Usage</p>
                        <p className="font-medium">{usage ?? "—"}</p>
                      </div>
                    </div>
                    <dl className="divide-y divide-border rounded-lg border border-border">
                      <div className="grid grid-cols-[8rem_1fr] gap-3 px-4 py-3">
                        <dt className="text-muted">Join At</dt>
                        <dd>{joinAt}</dd>
                      </div>
                      <div className="grid grid-cols-[8rem_1fr] gap-3 px-4 py-3">
                        <dt className="text-muted">Bot Name</dt>
                        <dd>{ext.botName ?? "—"}</dd>
                      </div>
                      <div className="grid grid-cols-[8rem_1fr] gap-3 px-4 py-3">
                        <dt className="text-muted">Metadata</dt>
                        <dd>
                          {ext.metadata
                            ? `${Object.keys(ext.metadata).length} field${Object.keys(ext.metadata).length === 1 ? "" : "s"}`
                            : "—"}
                        </dd>
                      </div>
                      <div className="grid grid-cols-[8rem_1fr] gap-3 px-4 py-3">
                        <dt className="text-muted">Meeting</dt>
                        <dd className="truncate">
                          {meetingUrl ? (
                            <a
                              href={meetingUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-accent hover:underline">
                              {meetingUrl}
                            </a>
                          ) : (
                            "—"
                          )}
                        </dd>
                      </div>
                      <div className="px-4 py-3">
                        <p className="text-muted">
                          Participants · {(ext.participants?.length ?? 0) || 0}
                        </p>
                        {ext.participants?.length ? (
                          <ul className="mt-2 flex flex-wrap gap-2">
                            {ext.participants.map((p, i) => (
                              <li
                                key={i}
                                className="rounded-full bg-surface px-3 py-1 text-xs">
                                {p.name}
                                {p.role ? ` · ${p.role}` : ""}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="mt-1 text-muted">
                            No participant list yet.
                          </p>
                        )}
                      </div>
                    </dl>
                  </div>
                  <div className="min-w-0">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                      Timeline
                    </p>
                    {(
                      capture as unknown as {
                        events?: Array<{
                          status: string;
                          detail: string | null;
                          at: string;
                        }>;
                      }
                    ).events?.length ? (
                      <ol className="relative space-y-0 rounded-lg border border-border bg-surface/30 p-3">
                        {(() => {
                          const labels: Record<
                            string,
                            { title: string; desc: string }
                          > = {
                            queued: {
                              title: "Queued",
                              desc: "Added to processing queue",
                            },
                            video_ready: {
                              title: "Video ready",
                              desc: "Recording secured and ready",
                            },
                            transcript_ready: {
                              title: "Transcript ready",
                              desc: "Transcript available for insights",
                            },
                          };
                          const icons: Record<string, typeof Clock> = {
                            queued: Clock,
                            video_ready: Video,
                            transcript_ready: FileText,
                          };
                          const items = (
                            capture as unknown as {
                              events: Array<{
                                status: string;
                                detail: string | null;
                                at: string;
                              }>;
                            }
                          ).events.slice(0, 3);
                          return items.map((ev, i) => {
                            const meta = labels[ev.status] ?? {
                              title: ev.status.replace(/_/g, " "),
                              desc: ev.detail ?? "",
                            };
                            const Icon = icons[ev.status] ?? Clock;
                            const isLast = i === items.length - 1;
                            return (
                              <li
                                key={i}
                                className="relative flex gap-3 pb-4 last:pb-0">
                                {!isLast && (
                                  <span
                                    aria-hidden
                                    className="absolute left-[11px] top-7 h-[calc(100%-8px)] w-px bg-border"
                                  />
                                )}
                                <span className="relative z-10 grid h-6 w-6 shrink-0 place-items-center rounded-full border border-border bg-background shadow-sm">
                                  <Icon
                                    aria-hidden
                                    className="h-3.5 w-3.5 text-muted"
                                  />
                                </span>
                                <span className="min-w-0 flex-1 pt-0.5">
                                  <span className="flex flex-wrap items-baseline gap-2">
                                    <span className="text-sm font-medium capitalize">
                                      {meta.title}
                                    </span>
                                    <span className="text-xs text-muted">
                                      {ev.at
                                        ? new Date(ev.at).toLocaleString()
                                        : ""}
                                    </span>
                                  </span>
                                  <span className="mt-0.5 block text-xs text-muted">
                                    {meta.desc}
                                    {ev.detail && !labels[ev.status]
                                      ? `: ${ev.detail}`
                                      : ""}
                                  </span>
                                </span>
                              </li>
                            );
                          });
                        })()}
                      </ol>
                    ) : (
                      <p className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted">
                        No events yet
                      </p>
                    )}
                  </div>
                </div>
              </Card>
            );
          })()}
          {capture.source === "meeting_url" && (
            <section className="space-y-3" aria-label="Meeting controls">
              {isMeetingActive(capture.status) && (
                <Button
                  disabled={busy || !!capture.cancelRequestedAt}
                  onClick={() => void act(false)}>
                  {capture.cancelRequestedAt
                    ? "Cancellation requested"
                    : "Cancel capture"}
                </Button>
              )}
              {[
                "host_denied",
                "admission_timeout",
                "cancelled",
                "failed",
              ].includes(capture.state) && (
                <>
                  <label className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={consent}
                      onChange={(e) => setConsent(e.target.checked)}
                    />
                    I have the right to record this meeting again and will tell
                    its participants.
                  </label>
                  <Button
                    disabled={busy || !consent}
                    onClick={() => void act(true)}>
                    {busy ? "Sending…" : "Send assistant again"}
                  </Button>
                </>
              )}
            </section>
          )}
          <div id="recording-audio">
            <PrivateAudio
              key={capture.id}
              id={capture.id}
              onAudioChange={onAudioChange}
            />
          </div>
          {capture.source === "meeting_url" ? (
            <Card className="overflow-visible">
              <div className="sticky top-0 z-10 border-b border-border bg-background px-5 pt-4">
                <Tabs
                  label="Recording details"
                  items={[
                    {
                      id: `recording-${capture.id}-insights`,
                      label: "Meeting insights",
                    },
                    {
                      id: `recording-${capture.id}-transcript`,
                      label: "Transcript",
                    },
                  ]}
                  active={`recording-${capture.id}-${selectedContent.captureId === capture.id ? selectedContent.tab : "insights"}`}
                  onChange={(value) => {
                    const tab =
                      value === `recording-${capture.id}-insights`
                        ? "insights"
                        : "transcript";
                    setSelectedContent({ captureId: capture.id, tab });
                    updateInsightUrl({ tab });
                  }}
                />
              </div>
              <div
                role="tabpanel"
                id={tabPanelId(`recording-${capture.id}-transcript`)}
                aria-labelledby={tabId(`recording-${capture.id}-transcript`)}
                hidden={
                  selectedContent.captureId === capture.id &&
                  selectedContent.tab !== "transcript"
                }
                tabIndex={0}
                className="p-5 sticky top-[57px] max-h-[calc(100vh-57px)] overflow-y-auto">
                {transcriptEditor}
              </div>
              <div
                role="tabpanel"
                id={tabPanelId(`recording-${capture.id}-insights`)}
                aria-labelledby={tabId(`recording-${capture.id}-insights`)}
                hidden={
                  selectedContent.captureId !== capture.id ||
                  selectedContent.tab !== "insights"
                }
                tabIndex={0}
                className="p-5 sticky top-[57px] max-h-[calc(100vh-57px)] overflow-y-auto [&>section]:border-0 [&>section]:bg-transparent">
                <MeetingInsights
                  key={capture.id}
                  id={capture.id}
                  transcriptVersion={capture.transcriptVersion}
                  audioAvailable={
                    insightAudio?.captureId === capture.id && capture.id === id
                  }
                  onSeek={(startMs) => {
                    if (
                      insightAudio?.captureId === capture.id &&
                      capture.id === id
                    ) {
                      seekInsightAudio(insightAudio.element, startMs);
                    }
                  }}
                />
              </div>
            </Card>
          ) : (
            transcriptEditor
          )}
        </>
      ) : (
        !error && <p role="status">Loading recording…</p>
      )}
    </div>
  );
}
