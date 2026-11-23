import { AlertTriangle, Check, Clock, Loader2 } from "lucide-react";
import { useState } from "react";
import { dashboardPath } from "@/lib/app-routes";
import Link from "next/link";
import type { DashboardItem } from "@/lib/dashboard-client";
import { captureStatus, documentStatus, timeAgo, type StatusView } from "@/lib/status";
import { useDisplayTitle } from "@/components/shell/use-display-title";
import { CaptureTile, PLATFORM_NAME, meetingPlatform } from "@/components/ui/platform-logo";

const KIND_LABEL = { recording: "Recording", meeting: "Meeting", document: "Document" } as const;

export function statusFor(item: DashboardItem) {
  if (item.kind === "document") return documentStatus({ status: item.status, failureReason: item.failureReason });
  // The server names a meeting capture's source "meeting" (the library maps it to "meeting_url"), and a meeting's progress
  // lives in its state ("recording", "waiting_for_admission", "completed"). Read it the same way the library does.
  const meeting = item.kind === "meeting" || item.source === "meeting" || item.source === "meeting_url";
  return captureStatus({
    source: meeting ? "meeting_url" : "audio_upload",
    state: item.state ?? "",
    status: meeting ? item.state || item.status : item.status,
  });
}

const PILL = {
  success: "bg-success/10 text-success",
  danger: "bg-danger/10 text-danger",
  warning: "bg-warning/10 text-warning",
  info: "bg-accent-solid/10 text-accent",
  neutral: "bg-surface text-muted",
} as const;

/**
 * A light status for a list row: a small icon and a label on a faint tint, 24px tall. Finished is a check, failed a warning.
 * While something runs the icon is alive: a pulsing red dot for a recording, a spinner for processing, bouncing dots while
 * waiting. The motion stops when the person has reduced motion switched on.
 */
export function RowStatus({ status }: { status: StatusView }) {
  const recording = status.indicator === "recording";
  const icon =
    status.indicator === "spinner" ? <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" />
    : recording ? <span className="relative grid size-2 place-items-center"><span className="absolute -inset-0.5 animate-ping rounded-full bg-current opacity-50 motion-reduce:hidden" /><span className="relative size-2 rounded-full bg-current" /></span>
    : status.indicator === "dots" ? <span className="flex gap-0.5">{[0, 1, 2].map((i) => <span key={i} className="size-1 animate-bounce rounded-full bg-current motion-reduce:animate-none" style={{ animationDelay: `${i * 0.15}s` }} />)}</span>
    : status.tone === "success" ? <Check className="size-3.5" strokeWidth={2.5} />
    : status.tone === "danger" ? <AlertTriangle className="size-3.5" />
    : <Clock className="size-3.5" />;
  return (
    <span className={`inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-xs font-medium ${PILL[recording ? "danger" : status.tone]}`}>
      <span aria-hidden className="grid place-items-center">{icon}</span>
      {status.label}
    </span>
  );
}

/**
 * One row: the platform or kind mark, the title, "Platform · when", and its status on the right, always. While a meeting or
 * recording is in progress the status is animated (a recording dot, spinner or waiting dots) and the mark carries a live dot.
 * The list refreshes itself while anything is running, so when it finishes the badge changes to a check with a small pop.
 */
export function ItemRow({ item, showReason = false }: { item: DashboardItem; showReason?: boolean }) {
  const status = statusFor(item);
  const shownTitle = useDisplayTitle()(item);
  // A meeting shows its app. When the server does not say which, it is Google Meet, as on the recording page and in My Folder.
  const platform = item.kind === "meeting" ? meetingPlatform(item.platform, item.title) : null;
  const kind = platform ? PLATFORM_NAME[platform] : item.title.trim().toLowerCase() === KIND_LABEL[item.kind].toLowerCase() ? null : KIND_LABEL[item.kind];
  // Remember that this row was running, so the moment it finishes can be celebrated (and only that moment).
  const [wasActive, setWasActive] = useState(status.active);
  if (status.active && !wasActive) setWasActive(true);
  const justFinished = wasActive && !status.active && status.tone === "success";
  return (
    <li>
      <Link href={dashboardPath(item.href)} className={`flex items-center gap-4 px-5 py-3 transition-colors hover:bg-surface ${status.active ? "bg-accent-solid/5" : ""}`}>
        <span className="relative shrink-0">
          <CaptureTile kind={item.kind} platform={platform} hint={item.title} />
          {status.active && (
            <span aria-hidden className="absolute -right-1 -top-1 grid size-3">
              <span className={`absolute inset-0 animate-ping rounded-full motion-reduce:hidden ${status.indicator === "recording" ? "bg-danger-solid" : "bg-accent-solid"}`} />
              <span className={`relative rounded-full ring-2 ring-background ${status.indicator === "recording" ? "bg-danger-solid" : "bg-accent-solid"}`} />
            </span>
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{shownTitle}</span>
          <span className="block truncate text-xs text-muted">
            {showReason && item.failureReason ? item.failureReason : [kind, timeAgo(item.at)].filter(Boolean).join(" · ")}
          </span>
        </span>
        <span aria-live="polite" key={status.label} className={justFinished ? "jb-popin" : undefined}>
          <RowStatus status={status} />
        </span>
      </Link>
    </li>
  );
}

export function ItemRowSkeleton() {
  return (
    <li className="flex items-center gap-4 px-5 py-3" aria-hidden>
      <span className="size-10 jb-skel rounded-lg bg-border" />
      <span className="flex-1 space-y-2">
        <span className="block h-3 w-1/2 jb-skel rounded bg-border" />
        <span className="block h-3 w-1/3 jb-skel rounded bg-border" />
      </span>
    </li>
  );
}
