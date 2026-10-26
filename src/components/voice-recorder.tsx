"use client";

import { Mic, Square, Upload, Video } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  MAX_RECORDING_SECONDS,
  checkAudioFile,
  formatBytes,
  formatDuration,
} from "@/lib/audio";
import { TEMPLATE_CHOICES, createDocument } from "@/lib/documents-client";
import { getProfile } from "@/lib/profile-client";
import { captureStatus, timeAgo } from "@/lib/status";
import {
  type CaptureListItem,
  type CaptureView,
  deleteCapture,
  getCapture,
  isTerminal,
  listCaptures,
  stateLabel,
  uploadAudio,
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

const MIME_CANDIDATES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];

function pickMimeType(): string | undefined {
  return MIME_CANDIDATES.find((t) => MediaRecorder.isTypeSupported(t));
}

function recordingSupported(): boolean {
  return typeof MediaRecorder !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
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
  const router = useRouter();
  const [template, setTemplate] = useState<string>(TEMPLATE_CHOICES[1].id);
  const [creating, setCreating] = useState(false);
  const templateTouched = useRef(false);
  const supported = useSyncExternalStore(subscribeNone, recordingSupported, () => true);

  const [phase, setPhase] = useState<Phase>("idle");
  const [dragging, setDragging] = useState(false);  const [elapsed, setElapsed] = useState(0);
  const [selected, setSelected] = useState<Selected | null>(null);
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [job, setJob] = useState<Job | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const cancelledRef = useRef(false);

  // Release the microphone and any preview URL when leaving the page.
  useEffect(() => {
    // Strict Mode mounts, unmounts and remounts in development; reset the flag on each mount.
    cancelledRef.current = false;
    return () => {
      cancelledRef.current = true;
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
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
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }

  // Elapsed-time ticker; also enforces the maximum recording length.
  useEffect(() => {
    if (phase !== "recording") return;
    const id = setInterval(() => {
      const seconds = (Date.now() - startedAtRef.current) / 1000;
      setElapsed(seconds);
      if (seconds >= MAX_RECORDING_SECONDS) {
        if (recorderRef.current?.state === "recording") recorderRef.current.stop();
      }
    }, 250);
    return () => clearInterval(id);
  }, [phase]);

  // Pre-select the template that suits the user's role, unless they've already picked one themselves.
  useEffect(() => {
    let cancelled = false;
    getProfile().then(
      (p) => {
        if (!cancelled && !templateTouched.current) setTemplate(p.defaultTemplate);
      },
      () => {},
    );
    return () => {
      cancelled = true;
    };
  }, []);

  // Poll processing status until the item reaches a resting state.
  const processingId = job?.kind === "processing" ? job.captureId : null;
  useEffect(() => {
    if (!processingId) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    async function tick() {
      try {
        const capture = await getCapture(processingId!);
        if (stopped) return;
        if (capture.state === "failed") {
          setJob({ kind: "failed", captureId: processingId, message: capture.failureReason ?? "Processing failed." });
        } else if (isTerminal(capture.state)) {
          setJob({ kind: "done", captureId: processingId!, capture });
        } else {
          setJob({ kind: "processing", captureId: processingId!, capture });
          timer = setTimeout(tick, 2000);
        }
      } catch (err) {
        if (stopped) return;
        setJob({ kind: "failed", captureId: processingId, message: err instanceof Error ? err.message : "Lost contact with the server." });
      }
    }
    void tick();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [processingId]);

  async function submit() {
    if (!selected) return;
    setError(null);
    setJob({ kind: "uploading", progress: 0 });
    try {
      const captureId = await uploadAudio(
        { blob: selected.blob, filename: selected.name, title, source: selected.source === "recording" ? "voice_recording" : "audio_upload" },
        (progress) => setJob({ kind: "uploading", progress }),
      );
      setJob({ kind: "processing", captureId, capture: null });
    } catch (err) {
      setJob(null);
      setError(err instanceof Error ? err.message : "The upload failed. Please try again.");
    }
  }

  async function makeDocument() {
    if (job?.kind !== "done") return;
    setError(null);
    setCreating(true);
    try {
      const { documentId } = await createDocument(job.captureId, template);
      router.push(`/library/${documentId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start the document.");
      setCreating(false);
    }
  }

  async function discardEverything() {
    const id = job && "captureId" in job ? job.captureId : null;
    setJob(null);
    setSelected(null);
    setTitle("");
    if (id) await deleteCapture(id).catch(() => {});
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
      setError("This browser can't record audio in a supported format. Try uploading a file instead.");
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
      setError("Recording stopped unexpectedly. Anything captured so far was discarded.");
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
      const ext = type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : "webm";
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
    setPhase("recording");
  }

  function onFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-choosing the same file
    if (file) acceptFile(file);
  }

  function acceptFile(file: File) {
    const result = checkAudioFile(file);
    if (!result.ok) {
      setError(result.reason);
      return;
    }
    setError(null);
    if (!title) setTitle(file.name.replace(/\.[^.]+$/, ""));
    setSelected({
      blob: file,
      name: file.name,
      source: "upload",
      durationSeconds: null,
      previewUrl: URL.createObjectURL(file),
    });
  }

  const recording = phase === "recording";

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <section aria-labelledby="record-heading" className="flex flex-col rounded-xl border border-border p-6">
          <span aria-hidden className="grid h-10 w-10 place-items-center rounded-lg bg-accent/10 text-accent">
            <Mic className="h-5 w-5" />
          </span>
          <h2 id="record-heading" className="mt-4 text-base font-medium">
            Record a thought
          </h2>
          <p className="mt-1 text-sm text-muted">
            Speak for a minute or an hour. Keep this tab open and in the foreground: browsers can pause recording when the screen locks.
          </p>

          <div className="mt-auto pt-6">
            {supported ? (
              recording ? (
                <div className="flex flex-wrap items-center gap-4">
                  <Button variant="danger" size="lg" onClick={stopRecording}>
                    <Square aria-hidden className="h-3.5 w-3.5 fill-current" /> Stop
                  </Button>
                  <p role="timer" aria-live="off" className="flex items-center gap-2 text-sm tabular-nums">
                    <span aria-hidden className="inline-block h-2 w-2 animate-pulse rounded-full bg-danger-solid" />
                    Recording {formatDuration(elapsed)}
                  </p>
                </div>
              ) : (
                <Button variant="primary" size="lg" onClick={startRecording} disabled={phase === "requesting"}>
                  <Mic aria-hidden className="h-4 w-4" /> {phase === "requesting" ? "Waiting for microphone…" : "Start recording"}
                </Button>
              )
            ) : (
              <p className="text-sm text-muted">This browser can&rsquo;t record audio. Upload a file instead.</p>
            )}
          </div>
        </section>

        <section aria-labelledby="upload-heading" className="flex flex-col rounded-xl border border-border p-6">
          <span aria-hidden className="grid h-10 w-10 place-items-center rounded-lg bg-accent/10 text-accent">
            <Upload className="h-5 w-5" />
          </span>
          <h2 id="upload-heading" className="mt-4 text-base font-medium">
            Upload audio
          </h2>
          <p className="mt-1 text-sm text-muted">MP3, M4A, WAV, WebM, OGG, AAC or FLAC, up to 500 MB.</p>
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
            className={`mt-6 flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed px-4 py-6 text-center transition-colors focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20 ${dragging ? "border-accent bg-accent/5" : "border-border hover:bg-surface"} ${recording ? "pointer-events-none opacity-50" : ""}`}
          >
            <span className="text-sm font-medium">Choose a file</span>
            <span className="text-xs text-muted">or drop it here</span>
            <input type="file" accept="audio/*,.m4a,.mp3,.wav,.webm,.ogg,.aac,.flac" onChange={onFileChosen} disabled={recording} className="sr-only" />
          </label>
        </section>
      </div>

      {error && (
        <p role="alert" className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}

      {selected && (
        <section aria-labelledby="review-heading" className="space-y-4 rounded-xl border border-border p-6">
          <h2 id="review-heading" className="text-base font-medium">
            Review
          </h2>
          <audio controls src={selected.previewUrl} className="w-full" />
          <p className="text-sm text-muted">
            {selected.source === "recording" ? "Recording" : selected.name} · {formatBytes(selected.blob.size)}
            {selected.durationSeconds !== null && ` · ${formatDuration(selected.durationSeconds)}`}
          </p>
          <label className="block text-sm">
            <span className="font-medium">What is this recording about?</span>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder="Optional title" className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2" />
          </label>
          {job?.kind === "uploading" && (
            <div role="status">
              <progress value={job.progress} max={1} className="h-1.5 w-full overflow-hidden rounded-full accent-[var(--accent-solid)]" aria-label="Upload progress" />
              <p className="mt-1 text-xs text-muted">Uploading… {Math.round(job.progress * 100)}%</p>
            </div>
          )}
          {job?.kind === "processing" && (
            <p role="status" className="text-sm">
              {stateLabel(job.capture?.state ?? "uploaded")}…
            </p>
          )}
          {job?.kind === "failed" && (
            <p role="alert" className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
              {job.message}
            </p>
          )}
          {job?.kind === "done" && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Transcript</h3>
              <ol className="space-y-1.5 text-sm">
                {job.capture.transcript.map((seg) => (
                  <li key={seg.id} className="flex gap-3">
                    <span className="w-12 shrink-0 text-xs tabular-nums text-muted">{formatDuration(seg.startMs / 1000)}</span>
                    <span>
                      {seg.speakerId && <span className="mr-2 text-xs text-muted">{seg.speakerId}</span>}
                      {seg.text}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}
          {job?.kind === "done" && (
            <div className="space-y-3 rounded-lg border border-border bg-surface p-4">
              <label className="block text-sm">
                <span className="font-medium">Turn this into a document</span>
                <select
                  value={template}
                  onChange={(e) => {
                    templateTouched.current = true;
                    setTemplate(e.target.value);
                  }}
                  className="mt-1.5 block w-full rounded-lg border border-border bg-background px-3 py-2"
                >
                  {TEMPLATE_CHOICES.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>
              <Button variant="primary" onClick={makeDocument} disabled={creating}>
                {creating ? "Starting…" : "Create document"}
              </Button>
              <p className="text-xs text-muted">You can edit it freely afterwards. Nothing is sent anywhere.</p>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Button variant="primary" onClick={submit} disabled={job?.kind === "uploading" || job?.kind === "processing" || job?.kind === "done"}>
              {job?.kind === "failed" ? "Try again" : "Upload and transcribe"}
            </Button>
            <Button variant="ghost" onClick={discardEverything} disabled={job?.kind === "uploading"}>
              {job?.kind === "done" ? "Delete" : "Discard"}
            </Button>
          </div>
        </section>
      )}

      <RecentRecordings refreshKey={job?.kind === "done" ? job.captureId : ""} />
    </div>
  );
}

/** The last few recordings and meetings, so Capture is also where you see what you captured. */
function RecentRecordings({ refreshKey }: { refreshKey: string }) {
  const [items, setItems] = useState<CaptureListItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    listCaptures(6, "recordings").then(
      (c) => {
        if (cancelled) return;
        setItems(c);
        setFailed(false);
      },
      () => !cancelled && setFailed(true),
    );
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  return (
    <Card>
      <CardHeader
        title="Recent recordings"
        id="recent-recordings"
        action={
          <Link href="/library?tab=recordings" className="text-xs text-muted hover:text-foreground">
            View all
          </Link>
        }
      />
      {failed && items === null ? (
        <p role="alert" className="px-5 py-6 text-sm text-danger">Couldn&rsquo;t load your recordings just now.</p>
      ) : items === null ? (
        <ul aria-hidden className="divide-y divide-border">
          {[0, 1, 2].map((i) => (
            <li key={i} className="flex items-center gap-3 px-5 py-3">
              <span className="h-9 w-9 animate-pulse rounded-lg bg-border" />
              <span className="h-3 w-1/3 animate-pulse rounded bg-border" />
            </li>
          ))}
        </ul>
      ) : items.length === 0 ? (
        <EmptyState icon={<Mic />} title="Nothing recorded yet" body="Your recordings and captured meetings will be listed here." />
      ) : (
        <ul aria-labelledby="recent-recordings" className="divide-y divide-border">
          {items.map((c) => {
            const st = captureStatus({ source: c.source, state: c.state, status: c.status });
            const Icon = c.source === "meeting_url" ? Video : Mic;
            return (
              <li key={c.id}>
                <Link href={`/captures/${c.id}`} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-surface">
                  <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-surface text-muted">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{c.title}</span>
                    <span className="block truncate text-xs text-muted">
                      {c.source === "meeting_url" ? "Meeting" : c.source === "voice_recording" ? "Recorded in browser" : "Upload"} · {timeAgo(c.createdAt)}
                    </span>
                  </span>
                  <Badge tone={st.tone} active={st.active}>
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
