import { FileText, Mic, Video } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { DashboardItem } from "@/lib/dashboard-client";
import { captureStatus, documentStatus, timeAgo } from "@/lib/status";

const KIND_LABEL = { recording: "Recording", meeting: "Meeting", document: "Document" } as const;
const ICONS = { recording: Mic, meeting: Video, document: FileText } as const;

export function statusFor(item: DashboardItem) {
  return item.kind === "document"
    ? documentStatus({ status: item.status, failureReason: item.failureReason })
    : captureStatus({ source: item.source ?? "audio_upload", state: item.state ?? "", status: item.status });
}

/** One clickable row: icon, title, "Kind · time", and a status badge. Failures show their reason. */
export function ItemRow({ item, showReason = false }: { item: DashboardItem; showReason?: boolean }) {
  const Icon = ICONS[item.kind];
  const status = statusFor(item);
  return (
    <li>
      <Link href={item.href} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-surface">
        <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-surface text-muted">
          <Icon className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{item.title}</span>
          <span className="block truncate text-xs text-muted">
            {showReason && item.failureReason ? item.failureReason : `${KIND_LABEL[item.kind]} · ${timeAgo(item.at)}`}
          </span>
        </span>
        <Badge tone={status.tone} active={status.active}>
          {status.label}
        </Badge>
      </Link>
    </li>
  );
}

export function ItemRowSkeleton() {
  return (
    <li className="flex items-center gap-3 px-5 py-3" aria-hidden>
      <span className="h-9 w-9 animate-pulse rounded-lg bg-border" />
      <span className="flex-1 space-y-2">
        <span className="block h-3 w-1/2 animate-pulse rounded bg-border" />
        <span className="block h-2.5 w-1/3 animate-pulse rounded bg-border" />
      </span>
    </li>
  );
}
