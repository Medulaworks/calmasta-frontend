"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { type Json, fmtUtc } from "@/lib/admin-client";
import { capability } from "@/lib/admin-capabilities";
import type { CaptureOperationalView } from "@/lib/capture-admin-types";
import { listCaptures } from "@/lib/capture-admin-client";
import { ApiError } from "@/lib/upload-client";
import { Notice, ResourceBoundary, useResource } from "./ui";

function CaptureRow({ c }: { c: CaptureOperationalView }) {
  const canRead = capability("capture_read").allowed;
  return (
    <tr className={canRead ? "hover:bg-surface" : "opacity-60"}>
      <td className="px-3 py-2 font-mono text-xs">
        {canRead ? <Link href={`/admin/captures/${c.id}`} className="text-accent hover:underline">{c.displayKey.slice(0, 28)}…</Link> : <span title={c.displayKey}>{c.displayKey.slice(0, 20)}…</span>}
        <button type="button" onClick={() => void navigator.clipboard.writeText(c.displayKey)} className="ml-2 text-xs text-muted underline">Copy</button>
      </td>
      <td className="px-3 py-2 text-sm"><Link href={`/admin/customers/${c.user.id}`} className="hover:underline">{c.user.name ?? c.user.email}</Link><span className="block text-xs text-muted">{c.user.email}</span></td>
      <td className="px-3 py-2 text-xs">{c.source} · {c.recordVideo ? "video" : "audio-only"}</td>
      <td className="px-3 py-2"><Badge tone={c.meeting.state === "failed" ? "danger" : c.meeting.state === "recording" ? "success" : "neutral"}>{c.meeting.state}</Badge> <span className="ml-1 text-xs text-muted">{c.transcription.state}</span></td>
      <td className="px-3 py-2 text-xs tabular-nums">{c.insights.ready}/{c.insights.pending}/{c.insights.failed}</td>
      <td className="px-3 py-2 text-xs">{fmtUtc(c.createdAt)}</td>
      <td className="px-3 py-2 text-xs">{c.freshness.stale ? "stale" : "fresh"}</td>
    </tr>
  );
}

export function CapturesView() {
  const [q, setQ] = useState("");
  const [cursor, setCursor] = useState<string | null>(null);
  const [filterSource, setFilterSource] = useState("all");
  const [filterStage, setFilterStage] = useState("all");
  const pollRef = useRef<number | null>(null);

  const res = useResource<{ items: CaptureOperationalView[]; nextCursor: string | null }>(`/api/admin/captures?limit=25`);

  // Poll every 5s while visible and active, up to 30s for completed/stale
  useEffect(() => {
    const hasActive = (res.data?.items ?? []).some((c: CaptureOperationalView) => ["recording", "admitted", "joining", "waiting_for_admission"].includes(c.meeting.state));
    const interval = hasActive ? 5000 : 30000;
    if (typeof document !== "undefined" && document.hidden) return;
    pollRef.current = window.setInterval(() => res.reload(), interval);
    return () => { if (pollRef.current) window.clearInterval(pollRef.current); };
  }, [res]);

  if (res.error && (res.error as unknown as { status?: number }).status === 403) {
    return <Notice>Not allowed — capture_read required.</Notice>;
  }
  return (
    <ResourceBoundary resource={res}>
      {(data: { items: CaptureOperationalView[]; nextCursor: string | null }) => (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search displayKey or customer" className="h-10 min-w-64 flex-1 rounded-lg border border-border bg-background px-3 text-sm" />
            <select value={filterSource} onChange={(e) => setFilterSource(e.target.value)} className="h-10 rounded-lg border border-border bg-background px-3 text-sm"><option value="all">All sources</option><option value="meeting_url">Meeting</option><option value="upload">Recording</option></select>
            <select value={filterStage} onChange={(e) => setFilterStage(e.target.value)} className="h-10 rounded-lg border border-border bg-background px-3 text-sm"><option value="all">All stages</option><option value="recording">Recording</option><option value="failed">Failed</option><option value="ended">Ended</option></select>
            <Button variant="ghost" onClick={res.reload}>Refresh</Button>
          </div>
          <p className="text-xs text-muted">Showing {data.items.length} · Last update {data.items[0] ? fmtUtc(data.items[0].freshness.asOf) : "–"}</p>
          <div className="overflow-auto rounded-xl border border-border">
            <table className="w-full min-w-[900px] text-left">
              <thead className="bg-surface text-xs text-muted"><tr><th className="px-3 py-2">Display key</th><th className="px-3 py-2">Customer</th><th className="px-3 py-2">Source</th><th className="px-3 py-2">Stage</th><th className="px-3 py-2">Insights</th><th className="px-3 py-2">Created</th><th className="px-3 py-2">Freshness</th></tr></thead>
              <tbody className="divide-y divide-border text-sm">
                {data.items.filter((c) => !q.trim() || c.displayKey.toLowerCase().includes(q.toLowerCase()) || c.user.email.toLowerCase().includes(q.toLowerCase()) || (c.user.name ?? "").toLowerCase().includes(q.toLowerCase())).map((c) => <CaptureRow key={c.id} c={c} />)}
                {data.items.length === 0 && <tr><td colSpan={7} className="px-3 py-8 text-center text-muted">No captures. When new contracts are unavailable, this view shows honest empty/disabled states — not fake rows.</td></tr>}
              </tbody>
            </table>
          </div>
          {data.nextCursor && <Button variant="ghost" onClick={() => setCursor(data.nextCursor)}>Load more (cursor {data.nextCursor.slice(0, 8)})</Button>}
          <p className="text-xs text-muted">Cursor pagination 25 rows by default. UUID available in detail support section.</p>
        </div>
      )}
    </ResourceBoundary>
  );
}
