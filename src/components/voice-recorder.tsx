"use client";

import { TranscriptUpload } from "@/components/transcript-upload";
import { SkeletonRows } from "@/components/ui/skeleton";
import { VoiceIllustration } from "@/components/ui/illustrations";
import { useDisplayTitle } from "@/components/shell/use-display-title";
import { LiveWaveform } from "@/components/live-waveform";
import { takePendingFile } from "@/lib/pending-upload";
import { playSound } from "@/lib/sounds";
import {
  ArrowRight,
  FileAudio,
  Mic,
  Square,
  Upload,
  Video,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { UploadProgress } from "@/components/upload-progress";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  MAX_RECORDING_SECONDS,
  checkAudioFile,
  formatBytes,
  formatDuration,
} from "@/lib/audio";
import { capturePolicyQuery, capturesQuery, captureQuery } from "@/lib/queries";
import { useUploadAudio } from "@/lib/mutations";
import { captureStatus, timeAgo } from "@/lib/status";
import {
  type CaptureListItem,
  type CaptureView,
  isTerminal,
} from "@/lib/upload-client";

type Phase = "idle" | "requesting" | "recording";

type Job =
  | { kind: "uploading"; progress: number }
  | { kind: "processing"; captureId: string; capture: CaptureView | null }
  | { kind: "done"; captureId: string; capture: CaptureView }
  | { kind: "failed"; captureId: string | null; message: string };

type Selected = {
  blob: Blob;
  name: string;
  source: "recording" | "upload";
  durationSeconds: number | null;
  previewUrl: string;
};

const MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
];

function pickMimeType(): string | undefined {
  return MIME_CANDIDATES.find((t) => MediaRecorder.isTypeSupported(t));
}

function recordingSupported(): boolean {
  return (
    typeof MediaRecorder !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia
  );
}

const subscribeNone = () => () => {};

function describeMicError(err: unknown): string {
  const name = err instanceof DOMException ? err.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "Microphone access was blocked. Allow it in your browser's site settings and try again.";
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") {
    return "No microphone was found on this device.";
  }
  if (name === "NotReadableError") {
    return "The microphone is in use by another app. Close it and try again.";
  }
  return "Could not start recording. Please try again.";
}

export function VoiceRecorder() {
  const { data: policy, error: policyErrorRaw } = useQuery(capturePolicyQuery);
  const policyError =
    policyErrorRaw instanceof Error
      ? policyErrorRaw.message
      : policyErrorRaw
        ? String(policyErrorRaw)
        : null;
  const [consent, setConsent] = useState(false);
  const [titleMode, setTitleMode] = useState<"auto" | "mine">("auto");
  const maxSeconds = policy
    ? policy.maxUploadDurationSeconds
    : MAX_RECORDING_SECONDS;
  const supported = useSyncExternalStore(
    subscribeNone,
    recordingSupported,
    () => true,
  );

  const [phase, setPhase] = useState<Phase>("idle");
  const [dragging, setDragging] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [selected, setSelected] = useState<Selected | null>(null);
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [job, setJob] = useState<Job | null>(null);

  const uploadMutation = useUploadAudio();

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [liveStream, setLiveStream] = useState<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const cancelledRef = useRef(false);

  // Release the microphone and any preview URL when leaving the page.
  useEffect(() => {
    // Strict Mode mounts, unmounts and remounts in development; reset the flag on each mount.
    cancelledRef.current = false;
    return () => {
      cancelledRef.current = true;
      if (recorderRef.current?.state === "recording")
        recorderRef.current.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const previewUrl = selected?.previewUrl;
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function stopRecording() {
    if (recorderRef.current?.state === "recording") {
      playSound("recordStop");
      recorderRef.current.stop();
    }
  }

  // Elapsed-time ticker; also enforces the maximum recording length.
  useEffect(() => {
    if (phase !== "recording") return;
    const id = setInterval(() => {
      const seconds = (Date.now() - startedAtRef.current) / 1000;
      setElapsed(seconds);
      if (maxSeconds !== null && seconds >= Math.max(1, maxSeconds - 1)) {
        if (recorderRef.current?.state === "recording") {
          playSound("recordStop");
          recorderRef.current.stop();
        }
      }
    }, 250);
    return () => clearInterval(id);
  }, [phase, maxSeconds]);

  // Poll processing status via TanStack Query until the item reaches a resting state.
  const processingId = job?.kind === "processing" ? job.captureId : null;
  const processingQuery = useQuery({
    ...captureQuery(processingId ?? ""),
    enabled: !!processingId,
    refetchInterval: (q) => {
      const data = q.state.data as CaptureView | undefined;
      if (!data) return 2000;
      if (isTerminal(data.state)) return false;
      return 2000;
    },
  });

  // A short sound when it finishes or fails, once per change of outcome.
  const outcome =
    job?.kind === "done" || job?.kind === "failed" ? job.kind : null;
  useEffect(() => {
    if (outcome === "done") playSound("success");
    else if (outcome === "failed") playSound("error");
  }, [outcome]);

  useEffect(() => {
    if (!processingId) return;
    const capture = processingQuery.data as CaptureView | undefined;
    const err = processingQuery.error;
    if (err) {
      setJob({
        kind: "failed",
        captureId: processingId,
        message:
          err instanceof Error ? err.message : "Lost contact with the server.",
      });
      return;
    }
    if (!capture) return;
    if (
      [
        "failed",
        "reconciliation_required",
        "transcription_failed",
        "cancelled",
        "host_denied",
        "admission_timeout",
      ].includes(capture.state)
    ) {
      setJob({
        kind: "failed",
        captureId: processingId,
        message: capture.failureReason ?? "Processing failed.",
      });
    } else if (isTerminal(capture.state)) {
      setJob({ kind: "done", captureId: processingId!, capture });
    } else {
      setJob((prev) => {
        // avoid redundant updates
        if (
          prev?.kind === "processing" &&
          prev.capture?.state === capture.state
        )
          return prev;
        return { kind: "processing", captureId: processingId!, capture };
      });
    }
  }, [processingId, processingQuery.data, processingQuery.error]);

  async function submit() {
    if (!selected || !consent) return;
    setError(null);
    setJob({ kind: "uploading", progress: 0 });
    try {
      const captureId = await uploadMutation.mutateAsync({
        input: {
          blob: selected.blob,
          filename: selected.name,
          title: titleMode === "mine" ? title : "",
          source:
            selected.source === "recording"
              ? "voice_recording"
              : "audio_upload",
          consent,
        },
        onProgress: (progress) => setJob({ kind: "uploading", progress }),
      });
      setJob({ kind: "processing", captureId, capture: null });
    } catch (err) {
      setJob(null);
      setError(
        err instanceof Error
          ? err.message
          : "The upload failed. Please try again.",
      );
    }
  }

  function discardEverything() {
    setJob(null);
    setSelected(null);
    setTitle("");
    setTitleMode("auto");
    setConsent(false);
  }

  async function startRecording() {
    setError(null);
    setPhase("requesting");
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      setError(describeMicError(err));
      setPhase("idle");
      return;
    }
    if (cancelledRef.current) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }

    const mimeType = pickMimeType();
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    } catch {
      stream.getTracks().forEach((t) => t.stop());
      setError(
        "This browser can't record audio in a supported format. Try uploading a file instead.",
      );
      setPhase("idle");
      return;
    }

    chunksRef.current = [];
    streamRef.current = stream;
    recorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onerror = () => {
      stream.getTracks().forEach((t) => t.stop());
      setError(
        "Recording stopped unexpectedly. Anything captured so far was discarded.",
      );
      setPhase("idle");
    };
    recorder.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      if (cancelledRef.current) return;
      const type = recorder.mimeType || mimeType || "audio/webm";
      const blob = new Blob(chunksRef.current, { type });
      const seconds = (Date.now() - startedAtRef.current) / 1000;
      setPhase("idle");
      if (blob.size === 0) {
        setError("Nothing was recorded. Check your microphone and try again.");
        return;
      }
      const ext = type.includes("mp4")
        ? "m4a"
        : type.includes("ogg")
          ? "ogg"
          : "webm";
      setConsent(false);
      setSelected({
        blob,
        name: `recording.${ext}`,
        source: "recording",
        durationSeconds: seconds,
        previewUrl: URL.createObjectURL(blob),
      });
    };

    startedAtRef.current = Date.now();
    setElapsed(0);
    setSelected(null);
    try {
      recorder.start(1000);
    } catch {
      stream.getTracks().forEach((t) => t.stop());
      setError("Could not start recording. Please try again.");
      setPhase("idle");
      return;
    }
    playSound("recordStart");
    setLiveStream(stream);
    setPhase("recording");
  }

  function onFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-choosing the same file
    if (file) acceptFile(file);
  }

  function acceptFile(file: File) {
    const result = checkAudioFile(file, policy?.maxUploadBytes);
    if (!result.ok) {
      setError(result.reason);
      return;
    }
    setError(null);
    if (!title && titleMode === "auto") {
      // Suggest file name as title but keep auto mode unless user switches to custom
    }
    setConsent(false);
    setSelected({
      blob: file,
      name: file.name,
      source: "upload",
      durationSeconds: null,
      previewUrl: URL.createObjectURL(file),
    });
  }

  // A file dropped on the dashboard arrives here once the upload settings are known.
  useEffect(() => {
    if (!policy) return;
    const f = takePendingFile();
    if (f) acceptFile(f);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [policy]);

  const recording = phase === "recording";

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <section
          aria-labelledby="record-heading"
          className="flex flex-col rounded-2xl border border-border p-5">
          <span
            aria-hidden
            className="grid h-10 w-10 place-items-center rounded-lg bg-accent/10 text-accent">
            <Mic className="h-5 w-5" />
          </span>
          <h2 id="record-heading" className="mt-4 text-base font-medium">
            Record your voice
          </h2>
          <p className="mt-1 text-sm text-muted">
            {maxSeconds === null
              ? "No recording time limit."
              : `Record up to ${formatDuration(maxSeconds)}.`}{" "}
            Keep this tab open and in the foreground: browsers can pause
            recording when the screen locks.
          </p>

          <div className="mt-auto pt-5">
            {supported ? (
              recording ? (
                <div className="space-y-4">
                  <LiveWaveform stream={liveStream} />
                  <div className="flex flex-wrap items-center gap-4">
                    <Button variant="danger" size="lg" onClick={stopRecording}>
                      <Square aria-hidden className="h-4 w-4 fill-current" />{" "}
                      Stop
                    </Button>
                    <p
                      role="timer"
                      aria-live="off"
                      className="flex items-center gap-2 text-sm tabular-nums">
                      <span
                        aria-hidden
                        className="inline-block h-2 w-2 animate-pulse rounded-full bg-danger-solid"
                      />
                      Recording {formatDuration(elapsed)}
                    </p>
                  </div>
                </div>
              ) : (
                <Button
                  variant="primary"
                  size="lg"
                  onClick={startRecording}
                  disabled={phase === "requesting" || !policy?.uploadEnabled}>
                  <Mic aria-hidden className="h-4 w-4" />{" "}
                  {phase === "requesting"
                    ? "Waiting for microphone…"
                    : "Start recording"}
                </Button>
              )
            ) : (
              <p className="text-sm text-muted">
                This browser can&rsquo;t record audio. Upload a file instead.
              </p>
            )}
          </div>
        </section>

        <section
          aria-labelledby="upload-heading"
          className="flex flex-col rounded-2xl border border-border p-5">
          <span
            aria-hidden
            className="grid h-10 w-10 place-items-center rounded-lg bg-accent/10 text-accent">
            <Upload className="h-5 w-5" />
          </span>
          <h2 id="upload-heading" className="mt-4 text-base font-medium">
            Upload audio
          </h2>
          <p className="mt-1 text-sm text-muted">
            MP3, M4A, PCM WAV, WebM or Ogg
            {policy?.maxUploadBytes === null
              ? ", with no upload size limit."
              : `, up to ${formatBytes(policy?.maxUploadBytes ?? 25000000)}.`}
          </p>
          <label
            onDragOver={(e) => {
              if (recording) return;
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const file = e.dataTransfer.files?.[0];
              if (file && !recording) acceptFile(file);
            }}
            className={`mt-6 flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed px-4 py-5 text-center transition-colors focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20 ${dragging ? "border-accent bg-accent/5" : "border-border hover:bg-surface"} ${recording ? "pointer-events-none opacity-50" : ""}`}>
            <span className="text-sm font-medium">Choose a file</span>
            <span className="text-xs text-muted">or drop it here</span>
            <input
              type="file"
              accept="audio/wav,audio/mpeg,audio/mp4,audio/webm,audio/ogg,.m4a,.mp3,.wav,.webm,.ogg"
              onChange={onFileChosen}
              disabled={recording}
              className="sr-only"
            />
          </label>
        </section>
        <TranscriptUpload />
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}

      {selected && (
        <section
          aria-labelledby="review-heading"
          className="jb-rise overflow-hidden rounded-2xl border border-border bg-background shadow-sm">
          <div className="flex min-h-14 items-center justify-between gap-4 border-b border-border px-5 py-3">
            <h2 id="review-heading" className="text-base font-semibold">
              Review
            </h2>
          </div>
          <div className="space-y-5 p-5">
            <div className="flex items-center gap-4">
              <span
                aria-hidden
                className="grid size-12 shrink-0 place-items-center rounded-xl bg-accent-solid/15 text-accent">
                {selected.source === "recording" ? (
                  <Mic className="size-6" />
                ) : (
                  <FileAudio className="size-6" />
                )}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {selected.source === "recording"
                    ? "Recording"
                    : selected.name}
                </p>
                <p className="text-xs text-muted tabular-nums">
                  {formatBytes(selected.blob.size)}
                  {selected.durationSeconds !== null &&
                    ` · ${formatDuration(selected.durationSeconds)}`}
                </p>
              </div>
            </div>
            <audio controls src={selected.previewUrl} className="w-full" />

            {job && (
              <UploadProgress
                stage={job.kind}
                progress={job.kind === "uploading" ? job.progress : 1}
                totalBytes={selected.blob.size}
                state={
                  job.kind === "processing"
                    ? (processingQuery.data as CaptureView | undefined)?.state
                    : undefined
                }
                message={job.kind === "failed" ? job.message : undefined}
              />
            )}

            {(!job || job.kind === "failed") && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-start gap-3">
                  <label className="text-sm">
                    <span className="sr-only">Title</span>
                    <select
                      value={titleMode}
                      onChange={(e) =>
                        setTitleMode(e.target.value as "auto" | "mine")
                      }
                      className="min-h-10 rounded-xl border border-border bg-background px-4 text-sm shadow-sm">
                      <option value="auto">Auto-generated title</option>
                      <option value="mine">Choose a title</option>
                    </select>
                  </label>
                  {titleMode === "mine" ? (
                    <label className="min-w-[12rem] flex-1 text-sm">
                      <span className="sr-only">Meeting title</span>
                      <input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        maxLength={200}
                        placeholder="Quarterly planning"
                        className="min-h-10 w-full rounded-xl border border-border bg-background px-4 text-sm shadow-sm"
                      />
                    </label>
                  ) : (
                    <p className="flex-1 py-3 text-sm text-muted">
                      We’ll generate a title from the transcript.
                    </p>
                  )}
                </div>
                <label className="flex items-start gap-3 rounded-xl bg-surface p-4 text-sm">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                    className="mt-1 size-4 shrink-0 accent-[var(--accent-solid)]"
                  />
                  i have the permission toupload and transcribe this recording.
                </label>
              </div>
            )}

            {job?.kind === "done" && job.capture.transcript.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold">Transcript</h3>
                <ol className="mt-3 max-h-64 space-y-3 overflow-y-auto rounded-xl border border-border p-4 text-sm">
                  {job.capture.transcript.map((seg) => (
                    <li key={seg.id} className="flex gap-3">
                      <span className="w-12 shrink-0 text-xs tabular-nums text-muted">
                        {formatDuration(seg.startMs / 1000)}
                      </span>
                      <span>
                        {seg.speakerId && (
                          <span className="mr-2 text-xs text-muted">
                            {seg.speakerId}
                          </span>
                        )}
                        {seg.text}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {(!policy || !policy.uploadEnabled) && (
              <p role="status" className="text-sm text-muted">
                {policyError ??
                  (policy
                    ? "Uploading is not enabled for this account yet."
                    : "Loading capture limits…")}
              </p>
            )}
            {job?.kind === "processing" &&
              policy &&
              !policy.liveProcessingEnabled && (
                <p className="text-sm text-muted">
                  Your recording is saved. Processing is currently paused.
                </p>
              )}

            <div className="flex flex-wrap items-center gap-3">
              {job?.kind === "done" ? (
                <ButtonLink
                  href={`/dashboard/library/recordings/${job.captureId}`}
                  variant="primary"
                  size="lg">
                  Open transcript <ArrowRight aria-hidden className="size-4" />
                </ButtonLink>
              ) : job?.kind === "uploading" || job?.kind === "processing" ? (
                job.kind === "processing" && (
                  <ButtonLink
                    href={`/dashboard/library/recordings/${job.captureId}`}
                    variant="secondary"
                    size="lg">
                    Open recording
                  </ButtonLink>
                )
              ) : (
                <Button
                  variant="primary"
                  size="lg"
                  onClick={submit}
                  disabled={
                    !consent ||
                    !policy?.uploadEnabled ||
                    uploadMutation.isPending
                  }>
                  <Upload aria-hidden className="size-4" />{" "}
                  {job?.kind === "failed"
                    ? "Try again"
                    : "Upload and transcribe"}
                </Button>
              )}
              <Button
                variant="ghost"
                size="lg"
                onClick={discardEverything}
                disabled={
                  job?.kind === "uploading" || uploadMutation.isPending
                }>
                {job?.kind === "done" ? "Start another" : "Clear selection"}
              </Button>
            </div>
          </div>
        </section>
      )}

      <RecentRecordings />
    </div>
  );
}

/** The last few recordings and meetings, so Capture is also where you see what you captured. */
function RecentRecordings() {
  const titleOf = useDisplayTitle();
  const {
    data: items,
    isLoading,
    isError,
  } = useQuery(capturesQuery(6, "recordings"));

  return (
    <Card>
      <CardHeader
        title="Recent recordings"
        id="recent-recordings"
        action={
          <Link
            href="/dashboard/library?tab=recordings"
            className="text-xs text-muted hover:text-foreground">
            View all
          </Link>
        }
      />
      {isError && !items ? (
        <p role="alert" className="px-5 py-5 text-sm text-danger">
          Couldn&rsquo;t load your recordings just now.
        </p>
      ) : isLoading ? (
        <SkeletonRows count={3} label="Loading your recordings" />
      ) : !items || items.length === 0 ? (
        <EmptyState
          illustration={<VoiceIllustration />}
          title="Nothing recorded yet"
          body="Your recordings and captured meetings will be listed here."
        />
      ) : (
        <ul
          aria-labelledby="recent-recordings"
          className="divide-y divide-border">
          {items.map((c: CaptureListItem) => {
            const st = captureStatus({
              source: c.source,
              state: c.state,
              status: c.status,
            });
            const Icon = c.source === "meeting_url" ? Video : Mic;
            return (
              <li key={c.id}>
                <Link
                  href={`/dashboard/captures/${c.id}`}
                  className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-surface">
                  <span
                    aria-hidden
                    className="grid size-10 shrink-0 place-items-center rounded-lg bg-surface text-muted">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {titleOf({
                        title: c.title,
                        source: c.source,
                        at: c.createdAt,
                      })}
                    </span>
                    <span className="block truncate text-xs text-muted">
                      {c.source === "meeting_url"
                        ? "Meeting"
                        : c.source === "voice_recording"
                          ? "Recorded in browser"
                          : "Upload"}{" "}
                      · {timeAgo(c.createdAt)}
                    </span>
                  </span>
                  <Badge
                    tone={st.tone}
                    active={st.active}
                    indicator={st.indicator}>
                    {st.label}
                  </Badge>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
