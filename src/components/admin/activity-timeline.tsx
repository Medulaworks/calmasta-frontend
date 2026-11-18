"use client";
import { fmtUtc } from "@/lib/admin-client";
import { actionLabel } from "@/lib/admin-words";
import type { ActivityEntry, CaptureEvent } from "@/lib/capture-admin-types";

const Empty = ({ children }: { children: string }) => <p className="p-5 text-sm text-muted">{children}</p>;

/** A vertical line of dots: the newest at the top, each with what happened and when. */
function Timeline({ children }: { children: React.ReactNode }) {
  return <ol className="relative space-y-5 p-5 before:absolute before:bottom-6 before:left-[1.65rem] before:top-6 before:w-px before:bg-border">{children}</ol>;
}
function Step({ title, meta, note }: { title: React.ReactNode; meta: string; note?: string | null }) {
  return (
    <li className="relative flex gap-4 text-sm">
      <span aria-hidden className="relative z-10 mt-1.5 size-3 shrink-0 rounded-full border-2 border-accent bg-background" />
      <div className="min-w-0">
        <p className="font-medium">{title}</p>
        <p className="mt-0.5 text-xs text-muted">{meta}</p>
        {note && <p className="mt-1 text-xs text-muted">{note}</p>}
      </div>
    </li>
  );
}

export function ActivityTimeline({ items }: { items: ActivityEntry[] }) {
  if (items.length === 0) return <Empty>Nothing has happened yet.</Empty>;
  return (
    <Timeline>
      {items.map((a) => <Step key={a.id} title={actionLabel(a.action)} meta={`${a.actor ?? "Joobah (automatic)"} · ${fmtUtc(a.at)}`} note={a.target} />)}
    </Timeline>
  );
}

export function CaptureEventsTimeline({ events }: { events: CaptureEvent[] }) {
  if (events.length === 0) return <Empty>Nothing has happened yet.</Empty>;
  return (
    <Timeline>
      {events.map((e) => <Step key={e.sequence} title={actionLabel(e.type)} meta={fmtUtc(e.occurredAt)} note={e.reason ? `${e.reason}${e.supportReference ? ` (reference ${e.supportReference})` : ""}` : null} />)}
    </Timeline>
  );
}
