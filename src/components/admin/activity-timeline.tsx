"use client";
import { fmtUtc } from "@/lib/admin-client";
import type { ActivityEntry, CaptureEvent } from "@/lib/capture-admin-types";

export function ActivityTimeline({ items }: { items: ActivityEntry[] }) {
  if (items.length === 0) return <p className="p-5 text-sm text-muted">No activity yet.</p>;
  return (
    <ol className="divide-y divide-border">
      {items.map((a) => (
        <li key={a.id} className="px-5 py-3 text-sm">
          <p className="font-medium">{a.action} <span className="font-normal text-muted">· {a.scope}</span></p>
          <p className="mt-1 text-xs text-muted">{a.actor ?? "System"} · {fmtUtc(a.at)} · {a.result}{a.target ? ` · ${a.target}` : ""}</p>
        </li>
      ))}
    </ol>
  );
}

export function CaptureEventsTimeline({ events }: { events: CaptureEvent[] }) {
  if (events.length === 0) return <p className="p-5 text-sm text-muted">No lifecycle events yet.</p>;
  return (
    <ol className="divide-y divide-border">
      {events.map((e) => (
        <li key={e.sequence} className="px-5 py-3 text-sm">
          <p className="font-medium">{e.type} <span className="font-normal text-muted">· {e.source}</span></p>
          <p className="mt-1 text-xs text-muted">Occurred {fmtUtc(e.occurredAt)} · Observed {fmtUtc(e.observedAt)}</p>
          {e.reason && <p className="mt-1 text-xs text-muted">{e.reason}{e.supportReference ? ` · ${e.supportReference}` : ""}</p>}
        </li>
      ))}
    </ol>
  );
}
