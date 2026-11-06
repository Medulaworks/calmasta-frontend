"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ToastStack, useToasts } from "@/components/ui/toast";
import { type Json, adminPost, ageText, fmtUtc } from "@/lib/admin-client";
import { type Period, parsePeriod, periodQuery, spanText } from "@/lib/admin-period";
import { fmtMoney } from "@/lib/admin-money";
import { formatMinutes } from "@/lib/status";
import type { Overview } from "@/lib/admin-types";
import { taskName } from "@/lib/admin-words";
import { HealthStrip } from "./health-view";
import { PeriodPicker } from "./period-picker";
import { ClickRow, DetailsDialog, MenuTd, RowMenu, RowOpen } from "./row-menu";
import { ActionDialog, DataTable, Metric, Notice, ResourceBoundary, Td, Th, useResource } from "./ui";

type Data = Json<Overview>;
type Job = Data["problems"][number];
type NewOverview = { users: number; workspaces: number; activeCaptures: number; jobs: Array<{ kind: string; state: string; count: number }>; activeUsers: number | null; activeUsersReason: string | null };

const n = (v: number | null | undefined) => (v === null || v === undefined ? "–" : v.toLocaleString("en"));
const NA = "Not available yet";
/** Whole dollars: a summary reads better as $1,879 than $1,878.57. */
const dollars = (cents: number) => fmtMoney(Math.round(cents / 100) * 100);

/** "+10% vs the 7 days before" under a number, green when it grew. Nothing when there is nothing to compare with. */
function compare(now: number, before: number | null | undefined, key: Period["key"]) {
  if (before === null || before === undefined || before <= 0) return undefined;
  const pct = Math.round(((now - before) / before) * 100);
  const vs = { day: "yesterday", week: "the 7 days before", month: "the 30 days before", range: "the period before", all: "" }[key];
  return { text: `${pct > 0 ? "+" : ""}${pct}% vs ${vs}`, good: pct === 0 ? null : pct > 0 };
}

/**
 * What the business watches: people, meetings and money for the chosen period. A number the server didn't send shows a
 * dash and says "Not available yet", never a zero.
 */
function BusinessMetrics({ o, period, fetching }: { o: Data; period: Period; fetching: boolean }) {
  const b = o.business;
  const all = period.key === "all";
  const cost = b?.costCents ?? null;
  const over = cost !== null && b?.costTargetCents != null && cost > b.costTargetCents;
  const rev = b?.revenue ?? null;
  return (
    <div aria-busy={fetching} className={`space-y-3 transition-opacity ${fetching ? "opacity-60" : ""}`}>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Metric label={all ? "Users" : "New users"} value={n(b?.newUsers)} hint={b?.newUsers == null ? NA : all ? undefined : `${n(b.totalUsers)} in total`} />
        <Metric label="Active users" value={n(b?.activeUsers)} hint={b?.activeUsers == null ? NA : b.totalUsers != null ? `of ${n(b.totalUsers)} users` : undefined} />
        <Metric label="Paid subscribers" value={n(b?.paidSubscribers?.total)} hint={b?.paidSubscribers ? `Pro ${n(b.paidSubscribers.pro)} · Business ${n(b.paidSubscribers.business)}` : NA} trend={b?.paidSubscribers?.newInPeriod ? { text: `+${n(b.paidSubscribers.newInPeriod)} ${all ? "so far" : "new"}`, good: true } : undefined} />
        <Metric label="Money made" value={rev ? dollars(rev.cents) : "–"} trend={rev ? compare(rev.cents, rev.previousCents, period.key) : undefined} hint={rev ? undefined : NA} />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Metric label="Meetings" value={n(b?.meetings?.total)} hint={b?.meetings ? (b.meetings.failed > 0 ? `${n(b.meetings.failed)} didn’t finish` : "All finished") : NA} tone={b?.meetings && b.meetings.failed > 0 ? "warning" : undefined} />
        <Metric label="Recordings" value={n(b?.recordings)} hint={b?.recordings == null ? NA : undefined} />
        <Metric label="Hours processed" value={b?.minutes != null ? formatMinutes(b.minutes) : "–"} hint={b?.minutes == null ? NA : undefined} />
        <Metric label="Processing cost" value={cost !== null ? dollars(cost) : "–"} tone={over ? "warning" : undefined} hint={cost === null ? NA : b?.costTargetCents != null ? `Target ${dollars(b.costTargetCents)}` : undefined} />
      </div>
    </div>
  );
}

const STATUS: Record<string, string> = { failed: "Failed", failed_permanent: "Failed", failed_retryable: "Trying again", retrying: "Trying again", running: "Looks stuck", queued: "Waiting" };

export function OverviewView() {
  const router = useRouter();
  const params = useSearchParams();
  const period = parsePeriod((k) => params.get(k));
  const res = useResource<Data>(`/api/admin/overview${periodQuery(period)}`);
  const toasts = useToasts("home");
  const [open, setOpen] = useState<Job | null>(null);
  const [retrying, setRetrying] = useState<Job | null>(null);

  return (
    <ResourceBoundary resource={res}>
      {(o: Data & Partial<NewOverview>) => {
        const isNew = typeof (o as NewOverview).users === "number";
        if (isNew) {
          const no = o as unknown as NewOverview;
          return (
            <div className="space-y-6">
              <HealthStrip />
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Metric label="Users" value={n(no.users)} />
                <Metric label="Workspaces" value={n(no.workspaces)} />
                <Metric label="Active captures" value={n(no.activeCaptures)} />
                <Metric label="Active users" value={no.activeUsers === null ? "–" : n(no.activeUsers)} hint={no.activeUsers === null ? (no.activeUsersReason ?? "Not available yet") : undefined} />
              </div>
              <section className="space-y-3">
                <h2 className="text-sm font-semibold">Jobs by kind and state</h2>
                {no.jobs.length === 0 ? <Card><EmptyState title="No jobs" /></Card> : (
                  <DataTable label="Jobs">
                    <thead><tr><Th>Kind</Th><Th>State</Th><Th>Count</Th></tr></thead>
                    <tbody>{no.jobs.map((j, i) => <tr key={i}><Td>{taskName(j.kind)}</Td><Td>{j.state}</Td><Td>{j.count}</Td></tr>)}</tbody>
                  </DataTable>
                )}
              </section>
              <p className="text-xs text-muted"><button type="button" onClick={res.reload} className="underline">Refresh</button></p>
              <ToastStack items={toasts.items} onDismiss={toasts.dismiss} />
            </div>
          );
        }
        const jobMenu = (j: Job) => [
          { label: "See details", onSelect: () => setOpen(j) },
          { label: "Try again…", onSelect: () => setRetrying(j), disabled: !j.retry.allowed, reason: j.retry.reason, divider: true },
        ];
        return (
          <div className="space-y-6">
            <HealthStrip />
            {o.banner && <Notice tone={o.banner.level}>{o.banner.text} {o.paused && <Link href="/admin/usage" className="font-medium underline">Open Usage and cost to resume</Link>}</Notice>}

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-muted">{spanText(period)}</p>
                <PeriodPicker period={period} onChange={(p) => router.replace(`/admin${periodQuery(p)}`, { scroll: false })} />
              </div>
              <BusinessMetrics o={o} period={period} fetching={res.fetching} />
            </div>

            <section aria-labelledby="p" className="space-y-3">
              <h2 id="p" className="text-sm font-semibold">Problems to fix</h2>
              {o.problems.length === 0 ? (
                <Card><EmptyState title="Nothing needs you" body="Nothing has failed or got stuck." /></Card>
              ) : (
                <DataTable label="Problems to fix">
                  <thead><tr><Th>What</Th><Th>Status</Th><Th wide>Last change</Th><Th><span className="sr-only">Actions</span></Th></tr></thead>
                  <tbody>
                    {o.problems.map((j) => (
                      <ClickRow key={j.id} onOpen={() => setOpen(j)}>
                        <Td><RowOpen onOpen={() => setOpen(j)}>{taskName(j.kind)}</RowOpen></Td>
                        <Td><Badge tone={j.status === "failed_permanent" ? "danger" : "warning"}>{STATUS[j.status] ?? j.status.replace("_", " ")}</Badge></Td>
                        <Td wide className="whitespace-nowrap text-muted">{fmtUtc(j.updatedAt)}</Td>
                        <MenuTd><RowMenu label={`Actions for ${taskName(j.kind).toLowerCase()}`} items={jobMenu(j)} /></MenuTd>
                      </ClickRow>
                    ))}
                  </tbody>
                </DataTable>
              )}
            </section>

            <Card>
              <details className="group">
                <summary className="cursor-pointer list-none px-5 py-4 text-sm font-medium marker:hidden [&::-webkit-details-marker]:hidden">
                  More numbers <span className="ml-1 text-xs font-normal text-muted group-open:hidden">Show</span><span className="ml-1 hidden text-xs font-normal text-muted group-open:inline">Hide</span>
                </summary>
                <div className="space-y-5 border-t border-border p-5">
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    <Metric label="In line" value={o.queue.queued} hint="Waiting to be processed" />
                    <Metric label="Processing now" value={o.queue.running} />
                    <Metric label="Trying again" value={o.queue.retrying} />
                    <Metric label="Longest wait" value={ageText(o.queue.oldestDueSeconds)} tone={(o.queue.oldestDueSeconds ?? 0) > 600 ? "warning" : undefined} />
                    <Metric label="Host said no" value={o.meetings7d.deniedRate === null ? "–" : `${o.meetings7d.deniedRate}%`} hint="Meetings this week" />
                    <Metric label="Timed out" value={o.meetings7d.timedOutRate === null ? "–" : `${o.meetings7d.timedOutRate}%`} hint="Nobody let the bot in" />
                  </div>
                  <DataTable label="Last 24 hours" narrow>
                    <thead><tr><Th>Last 24 hours</Th><Th>Worked</Th><Th>Failed</Th><Th>Success</Th></tr></thead>
                    <tbody>
                      {o.last24h.length === 0 && <tr><Td className="text-muted">Nothing finished in the last 24 hours.</Td><Td /><Td /><Td /></tr>}
                      {o.last24h.map((k) => (
                        <tr key={k.kind}><Td>{taskName(k.kind)}</Td><Td>{k.succeeded}</Td><Td>{k.failed}</Td><Td>{k.successRate === null ? "–" : `${k.successRate}%`}</Td></tr>
                      ))}
                    </tbody>
                  </DataTable>
                </div>
              </details>
            </Card>

            <p className="text-xs text-muted">Updated {fmtUtc(o.generatedAt)}. <button type="button" onClick={res.reload} className="underline">Refresh</button></p>

            {open && (
              <DetailsDialog
                title={taskName(open.kind)}
                onClose={() => setOpen(null)}
                rows={[
                  ["Problem", STATUS[open.status] ?? open.status.replace("_", " ")],
                  ["What went wrong", open.lastError ?? "No message was recorded."],
                  ["Tries so far", `${open.attempts} of ${open.maxAttempts}`],
                  ["Last change", fmtUtc(open.updatedAt)],
                  ["Reference", <code key="id" className="break-all text-xs">{open.id}</code>],
                  ...(open.retry.allowed ? [] : ([["Why it can’t be retried", open.retry.reason ?? "–"]] as Array<[string, React.ReactNode]>)),
                ]}
                actions={open.retry.allowed ? <Button variant="primary" onClick={() => { setRetrying(open); setOpen(null); }}>Try again…</Button> : null}
              />
            )}
            {retrying && (
              <ActionDialog
                title="Try again?"
                description="It starts again from the beginning."
                confirmLabel="Try again"
                onClose={() => setRetrying(null)}
                onSubmit={async (v) => {
                  await adminPost(`/api/admin/jobs/${retrying.id}/retry`, { reason: v.reason });
                  toasts.push({ tone: "success", message: "Back in line." });
                  res.reload();
                }}
              />
            )}
            <ToastStack items={toasts.items} onDismiss={toasts.dismiss} />
          </div>
        );
      }}
    </ResourceBoundary>
  );
}
