"use client";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { capability } from "@/lib/admin-capabilities";
import type { CaptureOperationalView } from "@/lib/capture-admin-types";
import { ClickRow } from "./row-menu";
import { DataTable, FilterSelect, Notice, ResourceBoundary, SearchField, Td, Th, useResource } from "./ui";

const nice = (t: string) => t.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
const KIND: Record<string, string> = { meeting_url: "Meeting", upload: "Upload", voice_recording: "Voice recording", audio_upload: "Upload" };
const when = (iso: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

const statusTone = (state: string) => (state === "failed" ? "danger" : state === "recording" ? "success" : "neutral");
const isMeeting = (c: CaptureOperationalView) => c.source === "meeting_url";
const ENDED = ["ended", "completed"];

function CaptureRow({ c }: { c: CaptureOperationalView }) {
  const canRead = capability("capture_read").allowed;
  const name = c.user.name ?? c.user.email;
  const href = `/admin/captures/${c.id}`;
  const cells = (
    <>
      <Td>
        <span className="flex items-center gap-3">
          <Avatar name={name} size={32} />
          <span className="min-w-0"><span className="block truncate font-medium">{name}</span>{c.user.name && <span className="block truncate text-xs text-muted">{c.user.email}</span>}</span>
        </span>
      </Td>
      <Td className="whitespace-nowrap">{KIND[c.source] ?? nice(c.source)}</Td>
      <Td><Badge tone={statusTone(c.meeting.state)} active={c.meeting.state === "recording"}>{nice(c.meeting.state)}</Badge></Td>
      <Td className="whitespace-nowrap text-muted">{when(c.createdAt as unknown as string)}</Td>
      <td className="w-10 border-b border-border px-2 py-2 text-right align-middle">
        {canRead && <Link href={href} aria-label={`Open ${name}’s recording`} className="grid size-8 place-items-center rounded-lg text-muted transition-colors hover:bg-surface hover:text-foreground group-hover:text-foreground"><ChevronRight aria-hidden className="size-4" /></Link>}
      </td>
    </>
  );
  return canRead ? <ClickRow href={href}>{cells}</ClickRow> : <tr className="opacity-60">{cells}</tr>;
}

export function CapturesView() {
  const [q, setQ] = useState("");
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
    return <Notice>You don’t have permission to view recordings. Ask an admin for access.</Notice>;
  }
  return (
    <ResourceBoundary resource={res}>
      {(data: { items: CaptureOperationalView[]; nextCursor: string | null }) => {
        const needle = q.trim().toLowerCase();
        const rows = data.items.filter((c) =>
          (!needle || c.displayKey.toLowerCase().includes(needle) || c.user.email.toLowerCase().includes(needle) || (c.user.name ?? "").toLowerCase().includes(needle)) &&
          (filterSource === "all" || (filterSource === "meeting" ? isMeeting(c) : !isMeeting(c))) &&
          (filterStage === "all" || (filterStage === "ended" ? ENDED.includes(c.meeting.state) : c.meeting.state === filterStage)));
        return (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <SearchField label="Search by customer or recording ID" placeholder="Search by customer or recording ID" value={q} onChange={setQ} />
              <FilterSelect label="Type" value={filterSource} onChange={setFilterSource} options={[{ value: "all", label: "All" }, { value: "meeting", label: "Meetings" }, { value: "upload", label: "Uploads and voice" }]} />
              <FilterSelect label="Status" value={filterStage} onChange={setFilterStage} options={[{ value: "all", label: "Any" }, { value: "recording", label: "Recording now" }, { value: "failed", label: "Failed" }, { value: "ended", label: "Finished" }]} />
              <Button variant="secondary" className="h-10" onClick={res.reload}>Refresh</Button>
            </div>
            <DataTable label="Recordings">
              <thead><tr><Th>Customer</Th><Th>Type</Th><Th>Status</Th><Th>Started</Th><Th><span className="sr-only">Details</span></Th></tr></thead>
              <tbody>
                {rows.map((c) => <CaptureRow key={c.id} c={c} />)}
                {rows.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-muted">{data.items.length === 0 ? "No recordings yet. They will show up here as soon as customers make them." : "No recordings match. Try a different search or filter."}</td></tr>}
              </tbody>
            </DataTable>
            <p className="text-xs text-muted">Showing the {data.items.length} most recent {data.items.length === 1 ? "recording" : "recordings"}{data.items[0] ? ` · Updated ${when(data.items[0].freshness.asOf as unknown as string)}` : ""}. Select a row to see the full details.</p>
          </div>
        );
      }}
    </ResourceBoundary>
  );
}
