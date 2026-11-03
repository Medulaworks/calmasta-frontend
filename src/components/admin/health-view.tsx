"use client";

import { RefreshCw } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { type Json, fmtUtc } from "@/lib/admin-client";
import type { ServiceHealth, ServiceStatus, SystemHealth } from "@/lib/admin-types";
import type { Tone } from "@/lib/status";
import { Notice, ResourceBoundary, useResource } from "./ui";

type Data = Json<SystemHealth>;

export const STATUS_LABEL: Record<ServiceStatus, string> = { operational: "Working", degraded: "Having problems", down: "Down", unknown: "No data yet" };
export const STATUS_TONE: Record<ServiceStatus, Tone> = { operational: "success", degraded: "warning", down: "danger", unknown: "neutral" };
const BAR: Record<ServiceStatus, string> = { operational: "bg-success", degraded: "bg-warning", down: "bg-danger", unknown: "bg-border" };

export function StatusBadge({ status }: { status: ServiceStatus }) {
  return <Badge tone={STATUS_TONE[status]} active={status === "degraded" || status === "down"}>{STATUS_LABEL[status]}</Badge>;
}

/** 30 thin bars, one per day. Unknown days are grey, never green, so a gap in the data isn't read as a good day. */
function DayBars({ days, name }: { days: ServiceStatus[]; name: string }) {
  return (
    <div role="img" aria-label={`${name}, last ${days.length} days: ${days.filter((d) => d === "operational").length} operational, ${days.filter((d) => d === "degraded").length} degraded, ${days.filter((d) => d === "down").length} down, ${days.filter((d) => d === "unknown").length} without data`} className="flex h-6 items-end gap-px">
      {days.map((d, i) => <span key={i} title={`${days.length - i - 1} days ago: ${STATUS_LABEL[d]}`} className={`h-full min-w-px flex-1 rounded-[1px] ${BAR[d]} ${d === "operational" ? "opacity-70" : ""}`} />)}
    </div>
  );
}

function Sparkline({ values }: { values: number[] }) {
  const max = Math.max(1, ...values);
  const w = 240, h = 48;
  const pts = values.map((v, i) => `${(i / Math.max(1, values.length - 1)) * w},${h - 4 - (v / max) * (h - 8)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`Waiting to be processed over the last six hours: now ${values.at(-1) ?? 0}, highest ${max}`} className="h-12 w-full">
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" className="text-accent" />
    </svg>
  );
}

function ServiceCard({ s }: { s: Json<ServiceHealth> }) {
  return (
    <li className="space-y-3 rounded-xl border border-border bg-background p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{s.name}</p>
          <p className="mt-0.5 text-xs text-muted">{s.latencyMs === null ? "No speed reading" : `${s.latencyMs} ms`}{s.lastCheckedAt ? ` · checked ${fmtUtc(s.lastCheckedAt)}` : " · never checked"}</p>
        </div>
        <StatusBadge status={s.status} />
      </div>
      <DayBars days={s.days} name={s.name} />
      <div className="flex items-center justify-between text-xs text-muted">
        <span>30 days ago</span>
        <span className="tabular-nums">{s.uptime30d === null ? "No history yet" : `${s.uptime30d.toFixed(2)}% of the time working`}</span>
        <span>Today</span>
      </div>
      {s.detail && <p className="text-xs text-muted">{s.detail}</p>}
    </li>
  );
}

export function HealthView() {
  const res = useResource<Data>("/api/admin/health");
  return (
    <ResourceBoundary resource={res}>
      {(h) => {
        const groups = ["Core", "Providers", "Integrations"] as const;
        const GROUP_NAME = { Core: "Jooba itself", Providers: "Outside services we pay for", Integrations: "Connected apps" } as const;
        return (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="flex items-center gap-2 text-sm">
                <StatusBadge status={h.overall} />
                <span className="text-muted">{h.overall === "operational" ? "Everything we can check is working." : h.overall === "unknown" ? "We can't tell yet." : "Something needs a look."} Updated {fmtUtc(h.generatedAt)}.</span>
              </p>
              <Button onClick={res.reload}><RefreshCw aria-hidden className="size-4" /> Refresh</Button>
            </div>

            {h.incidents.some((i) => !i.resolvedAt) && (
              <Notice tone="warning">{h.incidents.filter((i) => !i.resolvedAt).map((i) => i.title).join(" · ")}</Notice>
            )}

            {groups.map((g) => (
              <section key={g} aria-labelledby={`g-${g}`} className="space-y-3">
                <h2 id={`g-${g}`} className="text-sm font-semibold">{GROUP_NAME[g]}</h2>
                <ul className="grid gap-3 md:grid-cols-2">{h.services.filter((s) => s.group === g).map((s) => <ServiceCard key={s.id} s={s} />)}</ul>
              </section>
            ))}

            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader title="Processing" />
                <ul className="divide-y divide-border text-sm">
                  {h.workers.map((w) => (
                    <li key={w.name} className="flex items-center justify-between gap-3 px-5 py-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{w.name}</p>
                        <p className="text-xs text-muted">{w.lastHeartbeatAt ? `Last seen ${fmtUtc(w.lastHeartbeatAt)}` : "Not seen yet"}{w.jobsInFlight === null ? "" : ` · ${w.jobsInFlight} busy`}</p>
                      </div>
                      <StatusBadge status={w.status} />
                    </li>
                  ))}
                </ul>
              </Card>
              <Card>
                <CardHeader title="Waiting to be processed, last 6 hours" />
                <div className="space-y-2 p-5">
                  <Sparkline values={h.queueDepth} />
                  <p className="text-xs text-muted">Every 15 minutes. <Link href="/dashboard/admin" className="underline underline-offset-2">See what’s waiting</Link></p>
                </div>
              </Card>
            </div>

            <Card>
              <CardHeader title="Past problems" />
              {h.incidents.length === 0 ? (
                <p className="p-5 text-sm text-muted">No problems recorded.</p>
              ) : (
                <ul className="divide-y divide-border text-sm">
                  {h.incidents.map((i) => (
                    <li key={i.id} className="space-y-1 px-5 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{i.title}</span>
                        <Badge tone={i.resolvedAt ? "neutral" : i.severity === "major" ? "danger" : "warning"}>{i.resolvedAt ? "Fixed" : "Still happening"}</Badge>
                        <span className="text-xs text-muted">{i.service}</span>
                      </div>
                      <p className="text-xs text-muted">{fmtUtc(i.startedAt)}{i.resolvedAt ? ` to ${fmtUtc(i.resolvedAt)}` : ""}</p>
                      <p className="text-muted">{i.note}</p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        );
      }}
    </ResourceBoundary>
  );
}

/** A one-line summary for the Overview. Quietly absent when health isn't available, so it never shows a made-up "all good". */
export function HealthStrip() {
  const res = useResource<Data>("/api/admin/health");
  if (!res.data) return null;
  const bad = res.data.services.filter((s) => s.status === "degraded" || s.status === "down");
  return (
    <Link href="/dashboard/admin/health" className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-background px-4 py-3 text-sm transition-colors hover:bg-surface">
      <StatusBadge status={res.data.overall} />
      <span className="text-muted">{bad.length === 0 ? `${res.data.services.length} services checked.` : bad.map((s) => s.name).join(", ")}</span>
      <span className="ml-auto text-xs text-accent">System status</span>
    </Link>
  );
}
