"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { fmtUtc } from "@/lib/admin-client";
import { capability } from "@/lib/admin-capabilities";
import type { CaptureOperationalView } from "@/lib/capture-admin-types";
import { getCaptureOperational, getCaptureEvents, getCaptureCosts, stopCapture } from "@/lib/capture-admin-client";
import { CaptureStageStatus } from "./capture-stage-status";
import { CaptureCostBreakdown } from "./capture-cost-breakdown";
import { CaptureEventsTimeline } from "./activity-timeline";
import { Notice, ResourceBoundary, useResource } from "./ui";
import { ApiError } from "@/lib/upload-client";
import type { CaptureEvent, CostSummary } from "@/lib/capture-admin-types";

export function CaptureOperationsView({ id }: { id: string }) {
  const op = useResource<CaptureOperationalView>(`/api/admin/captures/${id}`);
  const ev = useResource<{ items: CaptureEvent[]; nextCursor: string | null }>(`/api/admin/captures/${id}/events`);
  const costRes = useResource<CostSummary>(`/api/admin/captures/${id}/costs`);
  const [stopping, setStopping] = useState(false);
  const [stopError, setStopError] = useState<string | null>(null);
  const [stopPending, setStopPending] = useState(false);
  const canStop = capability("capture_stop").allowed;
  const canCost = capability("cost_read").allowed;

  return (
    <div className="space-y-5">
      <ResourceBoundary resource={op}>
        {(cap: CaptureOperationalView) => (
          <>
            <Card><CardHeader title={cap.displayKey} />
              <div className="space-y-3 p-5 text-sm">
                <p><span className="text-muted">Customer</span> <a href={`/admin/customers/${cap.user.id}`} className="font-medium text-accent hover:underline">{cap.user.name ?? cap.user.email}</a> <span className="text-muted">{cap.user.email}</span> · workspace {cap.workspaceId.slice(0, 8)}</p>
                <p><span className="text-muted">Source</span> {cap.source} · {cap.recordVideo ? "video requested" : "audio-only"} · requested {cap.requestedMaxDurationSeconds ?? "–"}s · policy v{cap.policyVersion ?? "–"}</p>
                <p><span className="text-muted">UUID</span> <span className="font-mono text-xs">{cap.id}</span></p>
                <p className="text-xs text-muted">Last update {fmtUtc(cap.freshness.asOf)} · {cap.freshness.stale ? "stale" : "fresh"} · support reference {cap.id.slice(0, 8)}</p>
                <CaptureStageStatus cap={cap} />
                {cap.meeting.state === "recording" || cap.meeting.state === "admitted" || cap.meeting.state === "joining" || cap.meeting.state === "waiting_for_admission" ? (
                  <div className="rounded-lg border border-border bg-surface p-3">
                    <p className="text-sm font-medium">Stop bot</p>
                    {!canStop ? <p className="mt-1 text-xs text-muted">Not allowed — capture_stop capability required.</p> : (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Button disabled={stopping || stopPending} onClick={async () => {
                          if (!confirm(`Stop ${cap.displayKey} for ${cap.user.email}? This requests the bot to leave.`)) return;
                          setStopping(true); setStopError(null);
                          try {
                            await stopCapture(cap.id, { expectedVersion: cap.version, reason: "operator stop" }, crypto.randomUUID());
                            setStopPending(true);
                          } catch (e) { setStopError(e instanceof Error ? e.message : "Stop failed."); }
                          finally { setStopping(false); }
                        }}>{stopping ? "Requesting…" : stopPending ? "Stop requested (202 pending)" : "Stop bot"}</Button>
                        {stopPending && <span className="text-xs text-muted">Accepted 202 — polling continues, meeting not marked ended until confirmed.</span>}
                      </div>
                    )}
                    {stopError && <p role="alert" className="mt-2 text-xs text-danger">{stopError}</p>}
                  </div>
                ) : <p className="text-xs text-muted">Stop available only while bot is active (capability and allowedActions honored; not a generic force complete).</p>}
              </div>
            </Card>
            <Card><CardHeader title="Timeline — lifecycle events" />
              <ResourceBoundary resource={ev}>{(e: { items: CaptureEvent[] }) => <CaptureEventsTimeline events={e.items} />}</ResourceBoundary>
            </Card>
            <Card><CardHeader title="Cost breakdown" />
              <div className="p-5">
                <ResourceBoundary resource={costRes}>{(c: CostSummary) => <CaptureCostBreakdown costs={c} canRead={canCost} />}</ResourceBoundary>
                {!canCost && <p className="mt-3 text-xs text-muted">Cost endpoint not called without cost_read; no fabricated zero costs.</p>}
              </div>
            </Card>
            <Card><CardHeader title="Participants & media" />
              <div className="p-5 text-sm">
                <p>Participants: {cap.participants.state} · count {cap.participants.count} — names/emails not shown in admin (content-free).</p>
                <p className="mt-1 text-xs text-muted">Video {cap.video.state} · Audio {cap.audio.state} — admin has no Play/Download; selection shown only. No meeting contents, transcripts, participant identities, private URLs or media in admin.</p>
              </div>
            </Card>
          </>
        )}
      </ResourceBoundary>
    </div>
  );
}
