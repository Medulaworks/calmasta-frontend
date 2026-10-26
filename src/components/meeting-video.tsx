"use client";

import { Loader2, TriangleAlert, Video } from "lucide-react";
import { formatBytes } from "@/lib/audio";
import type { CaptureView } from "@/lib/upload-client";

/**
 * The meeting's video, in whatever state it is in: playing, on its way, failed, or removed. Renders nothing for a
 * meeting that didn't ask for video, so no screen ever suggests a recording that was never made.
 */
export function MeetingVideo({ cap, compact = false }: { cap: Pick<CaptureView, "recordVideo" | "video" | "videoStatus" | "videoFailure" | "status">; compact?: boolean }) {
  if (!cap.recordVideo) return null;

  if (cap.video) {
    return (
      <div className="space-y-2">
        {/* A short-lived, signed link: the video is private to this person and the link stops working later. */}
        <video controls preload="metadata" src={cap.video.url} aria-label="Meeting video" className="aspect-video w-full rounded-lg bg-black" />
        <p className="text-xs text-muted">Video · {formatBytes(cap.video.sizeBytes)}{compact ? "" : ". Only you can watch this. If it's ever removed, the transcript and your documents stay."}</p>
      </div>
    );
  }

  if (cap.videoStatus === "failed") {
    return (
      <div role="status" className="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm">
        <TriangleAlert aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
        <div>
          <p className="font-medium">The video couldn&rsquo;t be saved</p>
          <p className="mt-0.5 text-muted">{cap.videoFailure ?? "Something went wrong while saving it."} The transcript is not affected.</p>
        </div>
      </div>
    );
  }

  if (cap.videoStatus === "unavailable") {
    return (
      <div role="status" className="flex items-start gap-3 rounded-lg border border-border bg-surface px-4 py-3 text-sm">
        <Video aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
        <div>
          <p className="font-medium">Video no longer available</p>
          <p className="mt-0.5 text-muted">It was removed, as your privacy settings say. The transcript and any documents made from it are still here.</p>
        </div>
      </div>
    );
  }

  const ended = ["completed", "processing"].includes(cap.status);
  return (
    <div role="status" className="flex items-start gap-3 rounded-lg border border-border bg-surface px-4 py-3 text-sm">
      {cap.videoStatus === "processing" ? <Loader2 aria-hidden className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-muted" /> : <Video aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-muted" />}
      <div>
        <p className="font-medium">{cap.videoStatus === "processing" ? "Saving the video…" : "Video will appear here"}</p>
        <p className="mt-0.5 text-muted">
          {cap.videoStatus === "processing" ? "The recording is being saved. This page updates by itself." : ended ? "The meeting has ended. The video appears once the recording has been processed, usually a few minutes." : "It appears after the meeting has ended and the recording has been processed."}
        </p>
      </div>
    </div>
  );
}
