"use client";

import { AlertTriangle, ArrowUp, Check, FileAudio } from "lucide-react";
import { formatBytes } from "@/lib/audio";

export type UploadStage = "uploading" | "processing" | "done" | "failed";

const STEPS = ["Upload", "Prepare audio", "Transcribe", "Ready"] as const;

/** How far along the pipeline a recording is. Upload is 0; "ready" is 4 (everything done). */
export function stepOf(stage: UploadStage, state?: string): number {
  if (stage === "uploading") return 0;
  if (stage === "done") return STEPS.length;
  return ["transcribing", "processing", "recorded"].includes(state ?? "") ? 2 : 1;
}

/** Five small sound bars that move while Jooba works on the audio. */
function Working() {
  return (
    <span aria-hidden className="flex h-6 items-center gap-1">
      {[0, 1, 2, 3, 4].map((i) => (
        <span key={i} className="jb-bar block h-6 w-1 rounded-full bg-current" style={{ ["--d" as string]: `${i * 0.14}s` }} />
      ))}
    </span>
  );
}

/**
 * The upload and processing tracker: one tile that changes with the work (a file rising for upload, sound bars while it is
 * transcribed, a check when it is ready), a plain sentence about what is happening, and a four-step bar that fills as it goes.
 * Upload fills its own step with the real percentage; the later steps pulse until the server moves on.
 */
export function UploadProgress({ stage, progress = 0, totalBytes, state, message }: { stage: UploadStage; progress?: number; totalBytes: number; state?: string; message?: string }) {
  const step = stepOf(stage, state);
  const pct = Math.round(progress * 100);

  if (stage === "failed") {
    return (
      <div role="alert" className="flex items-start gap-4 rounded-xl border border-danger/30 bg-danger/10 p-4">
        <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-xl bg-danger-solid text-white"><AlertTriangle className="size-5" /></span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-danger">That did not finish</span>
          <span className="mt-1 block text-sm text-danger">{message}</span>
        </span>
      </div>
    );
  }

  const title = stage === "uploading" ? "Uploading your recording" : stage === "done" ? "Transcript ready" : step === 2 ? "Transcribing" : "Preparing your audio";
  const body =
    stage === "uploading" ? `${pct}% · ${formatBytes(Math.round(totalBytes * progress))} of ${formatBytes(totalBytes)}`
    : stage === "done" ? "Your recording has been turned into text."
    : step === 2 ? "Turning speech into text. You can keep using Jooba while this runs."
    : "Getting it ready for transcription.";
  const tile = stage === "done" ? "bg-success text-white" : "bg-accent-solid/15 text-accent";

  return (
    <div className="rounded-2xl border border-border bg-surface/50 p-5">
      <div className="flex items-center gap-4">
        <span aria-hidden className={`relative grid size-12 shrink-0 place-items-center rounded-xl ${tile}`}>
          {stage === "uploading" && (
            <>
              <FileAudio className="size-6" />
              <span className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-accent-solid text-on-accent ring-2 ring-surface"><ArrowUp className="jb-bob size-3" strokeWidth={3} /></span>
            </>
          )}
          {stage === "processing" && <Working />}
          {stage === "done" && <Check className="jb-popin size-6" strokeWidth={3} />}
        </span>
        <div role="status" aria-live="polite" className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{title}</p>
          <p className="mt-0.5 text-sm text-muted tabular-nums">{body}</p>
        </div>
        {stage === "uploading" && <span aria-hidden className="text-lg font-semibold tabular-nums">{pct}%</span>}
      </div>

      {stage === "uploading" && <progress className="sr-only" value={progress} max={1} aria-label="Upload progress" />}
      <ol aria-label="Progress" className="mt-5 grid grid-cols-4 gap-2">
        {STEPS.map((label, i) => {
          const done = i < step;
          const current = i === step && stage !== "done";
          const fill = stage === "done" ? "bg-success" : "bg-accent-solid";
          return (
            <li key={label} aria-current={current ? "step" : undefined}>
              <span className="relative block h-1.5 overflow-hidden rounded-full bg-border">
                {done && <span className={`block h-full w-full rounded-full ${fill}`} />}
                {current && stage === "uploading" && <span className={`block h-full rounded-full ${fill} transition-[width] duration-300 ease-out`} style={{ width: `${pct}%` }} />}
                {current && stage === "processing" && <span className="jb-indeterminate absolute inset-y-0 left-0 w-2/5 rounded-full bg-accent-solid" />}
              </span>
              <span className={`mt-2 flex items-center gap-1 text-xs ${current ? "font-medium text-foreground" : "text-muted"}`}>
                {done && <Check aria-hidden className={`size-3 ${stage === "done" ? "text-success" : "text-accent"}`} strokeWidth={3} />}
                {label}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
