"use client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
  const [insightAudio, setInsightAudio] = useState<{
    captureId: string;
    element: HTMLAudioElement;
  } | null>(null);
  const onAudioChange = useCallback((audio: HTMLAudioElement | null) => {
    setInsightAudio(audio && audio.readyState >= 1 ? { captureId: id, element: audio } : null);
  }, [id]);
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
            const ext = capture as unknown as { botName?: string | null; meetingUrl?: string | null; meeting_url?: string | null; durationSeconds?: number | null; participants?: Array<{ name: string; role?: string }>; metadata?: Record<string, unknown> };
            const meetingUrl = ext.meetingUrl ?? ext.meeting_url ?? null;
            const usage = ext.durationSeconds != null ? formatDuration(ext.durationSeconds) : null;
            const joinAt = new Date((capture as unknown as { createdAt: string }).createdAt).toLocaleString();
            return (
              <Card>
                <div className="space-y-4 p-5 text-sm">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div><p className="text-muted">Platform</p><p className="flex items-center gap-2 font-medium">{capture.platform ? <><Image src={capture.platform === "microsoft_teams" ? "/icons/icons8-teams-96.png" : capture.platform === "zoom" ? "/icons/icons8-zoom-96.png" : "/icons/icons8-google-meet-96.png"} alt={PLATFORM_LABELS[capture.platform] ?? capture.platform} width={20} height={20} className="h-5 w-5 shrink-0" />{PLATFORM_LABELS[capture.platform] ?? capture.platform}</> : "—"}</p></div>
                    <div><p className="text-muted">Status</p><p className="font-medium">{status?.label ?? "—"}</p></div>
                    <div><p className="text-muted">Usage</p><p className="font-medium">{usage ?? "—"}</p></div>
                  </div>
                  <dl className="divide-y divide-border rounded-lg border border-border">
                    <div className="grid grid-cols-[8rem_1fr] gap-3 px-4 py-3"><dt className="text-muted">Join At</dt><dd>{joinAt}</dd></div>
                    <div className="grid grid-cols-[8rem_1fr] gap-3 px-4 py-3"><dt className="text-muted">Bot Name</dt><dd>{ext.botName ?? "—"}</dd></div>
                    <div className="grid grid-cols-[8rem_1fr] gap-3 px-4 py-3"><dt className="text-muted">Metadata</dt><dd>{ext.metadata ? `${Object.keys(ext.metadata).length} field${Object.keys(ext.metadata).length === 1 ? "" : "s"}` : "—"}</dd></div>
                    <div className="grid grid-cols-[8rem_1fr] gap-3 px-4 py-3"><dt className="text-muted">Meeting</dt><dd className="truncate">{meetingUrl ? <a href={meetingUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">{meetingUrl}</a> : "—"}</dd></div>
                    <div className="px-4 py-3"><p className="text-muted">Participants · {(ext.participants?.length ?? 0) || 0}</p>{ext.participants?.length ? <ul className="mt-2 flex flex-wrap gap-2">{ext.participants.map((p, i) => <li key={i} className="rounded-full bg-surface px-3 py-1 text-xs">{p.name}{p.role ? ` · ${p.role}` : ""}</li>)}</ul> : <p className="mt-1 text-muted">No participant list yet.</p>}</div>
                  </dl>
                  {(capture as unknown as { events?: Array<{ status: string; detail: string | null; at: string }> }).events?.length ? <ul className="space-y-1 text-xs text-muted">{(capture as unknown as { events: Array<{ status: string; detail: string | null; at: string }> }).events.slice(0, 4).map((e, i) => <li key={i}>{e.at ? new Date(e.at).toLocaleString() : ""} — {e.status}{e.detail ? `: ${e.detail}` : ""}</li>)}</ul> : null}
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
          <PrivateAudio key={capture.id} id={capture.id} onAudioChange={onAudioChange} />
          {capture.source === "meeting_url" && (
            <MeetingInsights
              key={capture.id}
              id={capture.id}
              transcriptVersion={capture.transcriptVersion}
              audioAvailable={insightAudio?.captureId === capture.id && capture.id === id}
              onSeek={(startMs) => {
                if (insightAudio?.captureId === capture.id && capture.id === id) {
                  seekInsightAudio(insightAudio.element, startMs);
                }
              }}
            />
          )}
          <TranscriptEditor
            key={capture.id}
            cap={capture}
            statusLabel={status?.label ?? "Processing"}
            active={active}
            onChanged={refresh}
            loadCapture={getLibraryCapture}
            saveChanges={saveLibraryTranscript}
          />
        </>
      ) : (
        !error && <p role="status">Loading recording…</p>
      )}
    </div>
  );
}
