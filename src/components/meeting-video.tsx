"use client";

import { useRef } from "react";
import { Loader2, TriangleAlert, Video } from "lucide-react";
import { formatBytes } from "@/lib/audio";
import type { CaptureView } from "@/lib/upload-client";

/**
 * The meeting's video, in whatever state it is in: playing, on its way, failed, or removed. Renders nothing for a
 * meeting that didn't ask for video, so no screen ever suggests a recording that was never made.
 */
export function MeetingVideo({ cap, compact = false }: { cap: Pick<CaptureView, "recordVideo" | "video" | "videoStatus" | "videoFailure" | "videoPlaybackFailure" | "status">; compact?: boolean }) {
  const position = useRef(0);
  const playing = useRef(false);
  if (!cap.recordVideo) return null;

  if (cap.video?.url) {
    return (
      <div className="space-y-2">
        {/* Inline signed URL — valid ~5m; detail polling renews it. */}
        <video controls preload="metadata" src={cap.video.url} aria-label="Meeting video" className="aspect-video w-full rounded-lg bg-black" onTimeUpdate={(e) => { if (e.currentTarget.readyState > 0) position.current = e.currentTarget.currentTime; }} onPlay={() => { playing.current = true; }}
          onPause={(e) => { if (e.currentTarget.readyState > 0) playing.current = false; }}
          onEnded={() => { playing.current = false; }}
          onLoadedMetadata={(e) => {
            if (position.current > 0) e.currentTarget.currentTime = Math.min(position.current, e.currentTarget.duration || position.current);
            if (playing.current) void e.currentTarget.play().catch(() => {});
          }} />
        <p className="text-xs text-muted">Video · {formatBytes(cap.video.sizeBytes)}{compact ? "" : ". Only you can watch this. If it's ever removed, the transcript and your documents stay."}</p>
      </div>
    );
  }

  if (cap.videoStatus === "failed") {
    return (
      <div role="status" className="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm">
        <TriangleAlert aria-hidden className="mt-1 h-4 w-4 shrink-0 text-warning" />
        <div>
          <p className="font-medium">The video couldn&rsquo;t be saved</p>
          <p className="mt-1 text-muted">{cap.videoFailure ?? "Something went wrong while saving it."} The transcript is not affected.</p>
        </div>
      </div>
    );
  }

  if (cap.videoStatus === "unavailable") {
    return (
      <div role="status" className="flex items-start gap-3 rounded-lg border border-border bg-surface px-4 py-3 text-sm">
        <Video aria-hidden className="mt-1 h-4 w-4 shrink-0 text-muted" />
        <div>
          <p className="font-medium">{cap.videoPlaybackFailure === "storage_unavailable" ? "Video temporarily unavailable" : "Video unavailable"}</p>
          <p className="mt-1 text-muted">{cap.videoPlaybackFailure === "storage_unavailable" ? "We couldn’t access video storage. Try refreshing this page." : cap.videoPlaybackFailure === "video_expired" ? "The video’s retention period has ended." : "The video could not be accessed. Try refreshing this page."} The transcript is not affected.</p>
        </div>
      </div>
    );
  }

  if (cap.videoStatus === "requested") {
    return (
      <div role="status" className="flex items-start gap-3 rounded-lg border border-border bg-surface px-4 py-3 text-sm">
        <Loader2 aria-hidden className="mt-1 h-4 w-4 shrink-0 animate-spin text-muted" />
        <div><p className="font-medium">Video requested</p><p className="mt-1 text-muted">The meeting is being recorded with video. It appears after processing, usually a few minutes. This page refreshes automatically.</p></div>
      </div>
    );
  }
  const ended = ["completed", "processing"].includes(cap.status);
  return (
    <div role="status" className="flex items-start gap-3 rounded-lg border border-border bg-surface px-4 py-3 text-sm">
      {cap.videoStatus === "processing" ? <Loader2 aria-hidden className="mt-1 h-4 w-4 shrink-0 animate-spin text-muted" /> : <Video aria-hidden className="mt-1 h-4 w-4 shrink-0 text-muted" />}
      <div>
        <p className="font-medium">{cap.videoStatus === "processing" ? "Saving the video…" : "Video will appear here"}</p>
        <p className="mt-1 text-muted">
          {cap.videoStatus === "processing" ? "The recording is being saved. This page updates by itself." : ended ? "The meeting has ended. The video appears once the recording has been processed, usually a few minutes." : "It appears after the meeting has ended and the recording has been processed."}
        </p>
      </div>
    </div>
  );
}
