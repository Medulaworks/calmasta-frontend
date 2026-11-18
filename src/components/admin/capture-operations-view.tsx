"use client";
import { useState } from "react";
import { Copy, Square } from "lucide-react";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { fmtUtc } from "@/lib/admin-client";
import { capability } from "@/lib/admin-capabilities";
import type { CaptureOperationalView } from "@/lib/capture-admin-types";
import { stopCapture } from "@/lib/capture-admin-client";
import { CaptureStageStatus, stateLabel, stateTone } from "./capture-stage-status";
import { CaptureCostBreakdown } from "./capture-cost-breakdown";
import { CaptureEventsTimeline } from "./activity-timeline";
import { ResourceBoundary, SimpleDialog, useResource } from "./ui";
import type { CaptureEvent, CostSummary } from "@/lib/capture-admin-types";

const KIND: Record<string, string> = { meeting_url: "Meeting", upload: "Upload", voice_recording: "Voice recording", audio_upload: "Upload" };
const ACTIVE = ["recording", "admitted", "joining", "waiting_for_admission"];

export function CaptureOperationsView({ id }: { id: string }) {
  const op = useResource<CaptureOperationalView>(`/api/admin/captures/${id}`);
  const ev = useResource<{ items: CaptureEvent[]; nextCursor: string | null }>(`/api/admin/captures/${id}/events`);
  const costRes = useResource<CostSummary>(`/api/admin/captures/${id}/costs`);
  const [confirming, setConfirming] = useState(false);
  const [stopPending, setStopPending] = useState(false);
  const [copied, setCopied] = useState(false);
  const canStop = capability("capture_stop").allowed;
  const canCost = capability("cost_read").allowed;

  return (
    <div className="space-y-5">
      <ResourceBoundary resource={op}>
        {(cap: CaptureOperationalView) => {
          const name = cap.user.name ?? cap.user.email;
          const active = ACTIVE.includes(cap.meeting.state);
          return (
            <>
              <header className="flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-background p-5 shadow-sm sm:p-6">
                <Avatar name={name} size={56} className="ring-4 ring-accent/10" />
                <div className="min-w-0 flex-1">
                  <h1 className="break-words text-2xl font-semibold tracking-tight">{KIND[cap.source] ?? cap.source} by {name}</h1>
                  <p className="mt-0.5 text-sm text-muted">
                    <Link href={`/admin/customers/${cap.user.id}`} className="text-accent hover:underline">Open {cap.user.name ? "their" : "this"} account</Link>
                    {" · "}{cap.recordVideo ? "With video" : "Audio only"}
                    {cap.requestedMaxDurationSeconds ? ` · up to ${Math.round(cap.requestedMaxDurationSeconds / 60)} minutes` : ""}
                  </p>
                  <p className="mt-3 flex flex-wrap items-center gap-2">
                    <Badge tone={stateTone(cap.meeting.state)} active={cap.meeting.state === "recording"}>{stateLabel(cap.meeting.state)}</Badge>
                    <Badge tone={cap.freshness.stale ? "warning" : "success"}>{cap.freshness.stale ? "Information may be out of date" : "Up to date"}</Badge>
                  </p>
                </div>
                {active && canStop && (
                  <Button variant="danger" disabled={stopPending} onClick={() => setConfirming(true)}><Square aria-hidden className="size-4" /> {stopPending ? "Stop requested" : "Stop the assistant"}</Button>
                )}
              </header>

              <Card>
                <CardHeader title="Details" />
                <dl className="grid gap-x-8 gap-y-5 p-5 sm:grid-cols-2 lg:grid-cols-3">
                  <div><dt className="text-xs font-medium text-muted">Recording ID</dt><dd className="mt-1 flex items-center gap-2 text-sm"><code className="break-all text-xs">{cap.displayKey}</code><button type="button" aria-label="Copy recording ID" onClick={() => { void navigator.clipboard.writeText(cap.displayKey); setCopied(true); }} className="grid size-7 shrink-0 place-items-center rounded-md text-muted hover:bg-surface hover:text-foreground"><Copy aria-hidden className="size-3.5" /></button>{copied && <span className="text-xs text-muted">Copied</span>}</dd></div>
                  <div><dt className="text-xs font-medium text-muted">Customer</dt><dd className="mt-1 text-sm">{name}{cap.user.name && <span className="block text-xs text-muted">{cap.user.email}</span>}</dd></div>
                  <div><dt className="text-xs font-medium text-muted">Last updated</dt><dd className="mt-1 text-sm">{fmtUtc(cap.freshness.asOf)}</dd></div>
                </dl>
                {active && !canStop && <p className="border-t border-border px-5 py-3 text-xs text-muted">You don’t have permission to stop recordings.</p>}
                {!active && <p className="border-t border-border px-5 py-3 text-xs text-muted">You can only stop a recording while the assistant is in the meeting.</p>}
                {stopPending && <p role="status" className="border-t border-border px-5 py-3 text-xs text-muted">Stop request sent. The meeting is marked as ended once it is confirmed.</p>}
              </Card>

              <section aria-labelledby="stages" className="space-y-3">
                <h2 id="stages" className="text-sm font-semibold">Progress</h2>
                <CaptureStageStatus cap={cap} />
              </section>

              <Card><CardHeader title="Timeline" description="What happened, in order." />
                <ResourceBoundary resource={ev}>{(e: { items: CaptureEvent[] }) => <CaptureEventsTimeline events={e.items} />}</ResourceBoundary>
              </Card>

              <Card><CardHeader title="Cost" description="What processing this recording has cost." />
                <div className="p-5">
                  <ResourceBoundary resource={costRes}>{(c: CostSummary) => <CaptureCostBreakdown costs={c} canRead={canCost} />}</ResourceBoundary>
                </div>
              </Card>

              <Card><CardHeader title="People and media" />
                <div className="space-y-1 p-5 text-sm">
                  <p>{cap.participants.count} {cap.participants.count === 1 ? "participant" : "participants"}. Their names and emails aren’t shown to admins.</p>
                  <p className="text-xs text-muted">Admins can’t play or download recordings, and never see transcripts or meeting content.</p>
                </div>
              </Card>

              {confirming && (
                <SimpleDialog
                  danger
                  title="Stop the assistant?"
                  description={<>The assistant will leave the meeting for <strong className="font-medium text-foreground">{cap.user.email}</strong>. This can’t be undone.</>}
                  confirmLabel="Stop the assistant"
                  busyLabel="Stopping…"
                  onClose={() => setConfirming(false)}
                  onSubmit={async () => {
                    await stopCapture(cap.id, { expectedVersion: cap.version, reason: "Stopped by an admin" }, crypto.randomUUID());
                    setStopPending(true);
                  }}
                />
              )}
            </>
          );
        }}
      </ResourceBoundary>
    </div>
  );
}
