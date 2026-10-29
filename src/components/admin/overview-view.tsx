"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type Json, adminPost, ageText, fmtUtc, shortId } from "@/lib/admin-client";
import type { Overview } from "@/lib/admin-types";
import { ActionDialog, DataTable, Metric, Notice, ResourceBoundary, Td, Th, useResource } from "./ui";

type Data = Json<Overview>;

export function OverviewView() {
  const res = useResource<Data>("/api/admin/overview");
  const [retrying, setRetrying] = useState<string | null>(null);

  return (
    <ResourceBoundary resource={res}>
      {(o) => (
        <div className="space-y-6">
          {o.banner && <Notice tone={o.banner.level}>{o.banner.text} {o.paused && <Link href="/dashboard/admin/usage" className="font-medium underline">Open usage and cost to resume</Link>}</Notice>}

          <section aria-labelledby="q" className="space-y-3">
            <h2 id="q" className="text-sm font-semibold">Queue</h2>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              <Metric label="Waiting" value={o.queue.queued} />
              <Metric label="Running" value={o.queue.running} />
              <Metric label="Retrying" value={o.queue.retrying} tone={o.queue.retrying > 0 ? "warning" : undefined} />
              <Metric label="Oldest waiting" value={ageText(o.queue.oldestDueSeconds)} tone={(o.queue.oldestDueSeconds ?? 0) > 600 ? "warning" : undefined} />
              <Metric label="Looks stuck" value={o.queue.stuckRunning} tone={o.queue.stuckRunning > 0 ? "danger" : undefined} hint="Running past its lease" />
            </div>
          </section>

          <section aria-labelledby="r" className="space-y-3">
            <h2 id="r" className="text-sm font-semibold">Success rates</h2>
            <div className="grid gap-3 md:grid-cols-2">
              <DataTable label="Jobs in the last 24 hours" narrow>
                <thead><tr><Th>Job, last 24 h</Th><Th>Succeeded</Th><Th>Failed</Th><Th>Success</Th></tr></thead>
                <tbody>
                  {o.last24h.length === 0 && <tr><Td className="text-muted" >No finished jobs in the last 24 hours.</Td><Td /><Td /><Td /></tr>}
                  {o.last24h.map((k) => (
                    <tr key={k.kind}><Td className="capitalize">{k.kind.replace("_", " ")}</Td><Td>{k.succeeded}</Td><Td>{k.failed}</Td><Td>{k.successRate === null ? "–" : `${k.successRate}%`}</Td></tr>
                  ))}
                </tbody>
              </DataTable>
              <div className="grid grid-cols-2 gap-3">
                <Metric label="Meetings, 7 days" value={o.meetings7d.finished} hint="Finished or failed" />
                <Metric label="Host declined" value={o.meetings7d.deniedRate === null ? "–" : `${o.meetings7d.deniedRate}%`} hint={`${o.meetings7d.denied} ${o.meetings7d.denied === 1 ? "meeting" : "meetings"}`} />
                <Metric label="Timed out waiting" value={o.meetings7d.timedOutRate === null ? "–" : `${o.meetings7d.timedOutRate}%`} hint={`${o.meetings7d.timedOut} ${o.meetings7d.timedOut === 1 ? "meeting" : "meetings"}`} />
                <Metric label="Failed" value={o.meetings7d.failed} tone={o.meetings7d.failed > 0 ? "warning" : undefined} />
              </div>
            </div>
          </section>

          <section aria-labelledby="p" className="space-y-3">
            <h2 id="p" className="text-sm font-semibold">Failed and stuck jobs</h2>
            <DataTable label="Failed and stuck jobs">
              <thead><tr><Th>Job</Th><Th>Kind</Th><Th>Status</Th><Th>Tries</Th><Th>Last error</Th><Th>Updated</Th><Th><span className="sr-only">Action</span></Th></tr></thead>
              <tbody>
                {o.problems.length === 0 && <tr><Td className="text-muted">Nothing has failed. Good.</Td><Td /><Td /><Td /><Td /><Td /><Td /></tr>}
                {o.problems.map((j) => (
                  <tr key={j.id}>
                    <Td><code title={j.id}>{shortId(j.id)}</code></Td>
                    <Td className="capitalize">{j.kind.replace("_", " ")}</Td>
                    <Td><Badge tone={j.status === "failed_permanent" ? "danger" : "warning"}>{j.status.replace("_", " ")}</Badge></Td>
                    <Td className="tabular-nums">{j.attempts}/{j.maxAttempts}</Td>
                    <Td className="max-w-xs break-words text-muted">{j.lastError ?? "–"}</Td>
                    <Td className="whitespace-nowrap">{fmtUtc(j.updatedAt)}</Td>
                    <Td>
                      {j.retry.allowed ? (
                        <Button onClick={() => setRetrying(j.id)}>Retry</Button>
                      ) : (
                        <span className="block max-w-[14rem] text-xs text-muted">{j.retry.reason}</span>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
            <p className="text-xs text-muted">Jobs that call a provider are only retried when repeating them is safe. There is no &ldquo;retry everything&rdquo; button on purpose.</p>
          </section>

          {retrying && (
            <ActionDialog
              title="Retry this job?"
              description={<>It goes back in the queue and starts again from the beginning. Job <code>{shortId(retrying)}</code>.</>}
              confirmLabel="Retry job"
              onClose={() => setRetrying(null)}
              onSubmit={async (v) => {
                await adminPost(`/api/admin/jobs/${retrying}/retry`, { reason: v.reason });
                res.reload();
              }}
            />
          )}
          <p className="text-xs text-muted">Updated {fmtUtc(o.generatedAt)}. <button type="button" onClick={res.reload} className="underline">Refresh</button></p>
        </div>
      )}
    </ResourceBoundary>
  );
}
