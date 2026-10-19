"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  MAX_RECORDING_SECONDS,
  checkAudioFile,
  formatBytes,
  formatDuration,
} from "@/lib/audio";
import { TEMPLATE_CHOICES, createDocument } from "@/lib/documents-client";
import { getProfile } from "@/lib/profile-client";
import {
  type CaptureView,
  deleteCapture,
  getCapture,
  isTerminal,
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
  const [elapsed, setElapsed] = useState(0);
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
    if (!file) return;
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
    <div className="max-w-2xl space-y-6">
      <section aria-labelledby="record-heading" className="rounded-lg border border-border p-5">
        <h2 id="record-heading" className="font-medium">
          Record a thought
        </h2>
        <p className="mt-1 text-sm text-muted">
          Keep this tab open and in the foreground while recording. Browsers can pause recording
          when the screen locks or the tab is in the background.
        </p>

        {supported ? (
          <div className="mt-4 flex items-center gap-4">
            {recording ? (
              <button
                type="button"
                onClick={stopRecording}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                Stop
              </button>
            ) : (
              <button
                type="button"
                onClick={startRecording}
                disabled={phase === "requesting"}
                className="rounded-md bg-accent-solid px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                {phase === "requesting" ? "Waiting for microphone…" : "Start recording"}
              </button>
            )}
            {recording && (
              <p role="timer" aria-live="off" className="flex items-center gap-2 font-mono text-sm">
                <span aria-hidden className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-red-600" />
                Recording {formatDuration(elapsed)}
              </p>
            )}
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted">
            This browser can&rsquo;t record audio. Upload a file below instead.
          </p>
        )}
      </section>

      <section aria-labelledby="upload-heading" className="rounded-lg border border-border p-5">
        <h2 id="upload-heading" className="font-medium">
          Upload audio
        </h2>
        <p className="mt-1 text-sm text-muted">MP3, M4A, WAV, WebM, OGG, AAC or FLAC, up to 500 MB.</p>
        <label className="mt-4 inline-block cursor-pointer rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-surface focus-within:ring-2 focus-within:ring-accent">
          Choose a file
          <input
            type="file"
            accept="audio/*,.m4a,.mp3,.wav,.webm,.ogg,.aac,.flac"
            onChange={onFileChosen}
            disabled={recording}
            className="sr-only"
          />
        </label>
      </section>

      {error && (
        <p role="alert" className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {error}
        </p>
      )}

      {selected && (
        <section aria-labelledby="review-heading" className="space-y-4 rounded-lg border border-border p-5">
          <h2 id="review-heading" className="font-medium">
            Review
          </h2>
          <audio controls src={selected.previewUrl} className="w-full" />
          <p className="text-sm text-muted">
            {selected.source === "recording" ? "Recording" : selected.name} ·{" "}
            {formatBytes(selected.blob.size)}
            {selected.durationSeconds !== null && ` · ${formatDuration(selected.durationSeconds)}`}
          </p>
          <label className="block text-sm">
            <span className="font-medium">What is this recording about?</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              placeholder="Optional title"
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2"
            />
          </label>
          {job?.kind === "uploading" && (
            <div role="status">
              <progress value={job.progress} max={1} className="w-full" aria-label="Upload progress" />
              <p className="mt-1 text-xs text-muted">Uploading… {Math.round(job.progress * 100)}%</p>
            </div>
          )}
          {job?.kind === "processing" && (
            <p role="status" className="text-sm">
              {stateLabel(job.capture?.state ?? "uploaded")}…
            </p>
          )}
          {job?.kind === "failed" && (
            <p role="alert" className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
              {job.message}
            </p>
          )}
          {job?.kind === "done" && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Transcript</h3>
              <ol className="space-y-1 text-sm">
                {job.capture.transcript.map((seg) => (
                  <li key={seg.id} className="flex gap-3">
                    <span className="w-12 shrink-0 font-mono text-xs text-muted">{formatDuration(seg.startMs / 1000)}</span>
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
            <div className="space-y-2 rounded-md border border-border bg-surface p-3">
              <label className="block text-sm">
                <span className="font-medium">Turn this into a document</span>
                <select
                  value={template}
                  onChange={(e) => {
                    templateTouched.current = true;
                    setTemplate(e.target.value);
                  }}
                  className="mt-1 block w-full rounded-md border border-border bg-background px-3 py-2"
                >
                  {TEMPLATE_CHOICES.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={makeDocument}
                disabled={creating}
                className="rounded-md bg-accent-solid px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                {creating ? "Starting…" : "Create document"}
              </button>
              <p className="text-xs text-muted">You can edit it freely afterwards. Nothing is sent anywhere.</p>
            </div>
          )}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={submit}
              disabled={job?.kind === "uploading" || job?.kind === "processing" || job?.kind === "done"}
              className="rounded-md bg-accent-solid px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {job?.kind === "failed" ? "Try again" : "Upload and transcribe"}
            </button>
            <button
              type="button"
              onClick={discardEverything}
              disabled={job?.kind === "uploading"}
              className="rounded-md px-3 py-2 text-sm text-muted hover:text-foreground disabled:opacity-50"
            >
              {job?.kind === "done" ? "Delete" : "Discard"}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
