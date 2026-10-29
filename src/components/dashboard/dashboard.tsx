"use client";

import { dashboardPath } from "@/lib/app-routes";

import { AlertTriangle, ArrowDown, ArrowRight, ArrowUp, CheckCircle2, Circle, Clock, Gauge, ListChecks, Mic, Video } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { useProfile } from "@/components/shell/profile-context";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { type Dashboard, fetchDashboard } from "@/lib/dashboard-client";
import { type PlanSummary, fetchPlan, formatDate } from "@/lib/plan-client";
import { PLAN_LABEL } from "@/lib/plan-types";
import { formatMinutes, greeting, timeAgo } from "@/lib/status";
import { browserTimeZone, formatDay } from "@/lib/tz";
import { ItemRow, ItemRowSkeleton } from "./item-row";
import { QuotaCard } from "./quota-card";
import { UpcomingMeetings } from "./upcoming-meetings";

const noSubscribe = () => () => {};
// -1 on the server so the first paint never disagrees with the browser's clock.
const useHour = () => useSyncExternalStore(noSubscribe, () => new Date().getHours(), () => -1);

/** "2 more than last month", "Same as last month": which way a figure is going, in words as well as an arrow. */
function Delta({ now, before, format = String }: { now: number; before: number; format?: (n: number) => string }) {
  if (now === 0 && before === 0) return <span className="text-xs text-muted">Nothing yet</span>;
  const diff = now - before;
  if (diff === 0) return <span className="text-xs text-muted">Same as last month</span>;
  const up = diff > 0;
  return (
    <span className={`inline-flex items-center gap-1 text-xs ${up ? "text-success" : "text-muted"}`}>
      {up ? <ArrowUp aria-hidden className="h-3 w-3" /> : <ArrowDown aria-hidden className="h-3 w-3" />}
      {format(Math.abs(diff))} {up ? "more" : "fewer"} than last month
    </span>
  );
}

function Metric({ label, value, icon, href, children, tone }: { label: string; value: React.ReactNode; icon: React.ReactNode; href: string; children: React.ReactNode; tone?: "warning" }) {
  return (
    <Link href={dashboardPath(href)} className="group block rounded-xl border border-border bg-background p-5 transition-colors hover:bg-surface focus-visible:bg-surface">
      <span className="flex items-center justify-between text-muted">
        <span className="text-sm">{label}</span>
        <span aria-hidden className="group-hover:text-foreground">{icon}</span>
      </span>
      <span className={`mt-3 block text-3xl font-medium tracking-tight tabular-nums ${tone === "warning" ? "text-warning" : ""}`}>{value}</span>
      <span className="mt-1.5 block">{children}</span>
    </Link>
  );
}

function MetricSkeleton() {
  return (
    <div aria-hidden className="rounded-xl border border-border bg-background p-5">
      <div className="h-3 w-24 animate-pulse rounded bg-border" />
      <div className="mt-4 h-8 w-16 animate-pulse rounded bg-border" />
      <div className="mt-3 h-2.5 w-32 animate-pulse rounded bg-border" />
    </div>
  );
}

function ListCard({ title, id, items, empty, action, showReason }: { title: string; id: string; items: Dashboard["recentRecordings"] | null; empty: React.ReactNode; action?: React.ReactNode; showReason?: boolean }) {
  return (
    <Card>
      <CardHeader title={title} id={id} action={action} />
      {items === null ? (
        <ul aria-labelledby={id} className="divide-y divide-border">{[0, 1, 2].map((i) => <ItemRowSkeleton key={i} />)}</ul>
      ) : items.length === 0 ? (
        empty
      ) : (
        <ul aria-labelledby={id} className="divide-y divide-border">
          {items.map((it) => <ItemRow key={`${it.kind}-${it.id}`} item={it} showReason={showReason} />)}
        </ul>
      )}
    </Card>
  );
}

const viewAll = (href: string) => (
  <Link href={dashboardPath(href)} className="inline-flex items-center gap-1 text-xs text-muted hover:text-foreground">
    View all <ArrowRight aria-hidden className="h-3 w-3" />
  </Link>
);

/** Only rendered when there is something to decide on; the first few, with the full count in the header. */
function ActionItems({ d }: { d: Dashboard }) {
  const m = d.metrics.actionItems;
  if (!m) return null;
  return (
    <Card>
      <CardHeader title="Action items" id="actions" action={<span className="text-xs text-muted">{m.toReview} to review · {m.open} open</span>} />
      <ul aria-labelledby="actions" className="divide-y divide-border">
        {d.actionItems.slice(0, 3).map((a) => (
          <li key={a.id}>
            <Link href={dashboardPath(a.href)} className="block px-5 py-3 transition-colors hover:bg-surface">
              <span className="flex items-start justify-between gap-3">
                <span className="line-clamp-2 text-sm">{a.text}</span>
                <Badge tone={a.status === "suggested" ? "warning" : "info"}>{a.status === "suggested" ? "To review" : "Open"}</Badge>
              </span>
              <span className="mt-1 block truncate text-xs text-muted">From {a.captureTitle} · {timeAgo(a.at)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function GettingStarted({ d }: { d: Dashboard }) {
  const latest = d.recentRecordings.find((r) => r.kind === "recording");
  const steps = [
    { done: d.progress.hasRecording, title: "Record or upload audio", body: "Speak for a minute or upload a file.", href: "/dashboard/voice" },
    ...(d.progress.hasDocument !== null
      ? [{ done: d.progress.hasDocument, title: "Turn it into a document", body: "Pick a template and edit the result.", href: latest?.href ?? "/dashboard/voice" }]
      : []),
    { done: d.progress.hasMeetingCapture, title: "Capture a meeting", body: "Send a visible assistant to a call.", href: "/dashboard/capture" },
  ];
  if (steps.every((s) => s.done)) return null;
  const done = steps.filter((s) => s.done).length;
  return (
    <Card>
      <CardHeader title="Get started" action={<span className="text-xs text-muted">{done} of {steps.length}</span>} />
      <ol className="divide-y divide-border">
        {steps.map((s) => (
          <li key={s.title}>
            <Link href={dashboardPath(s.href)} className="flex items-start gap-3 px-5 py-3 transition-colors hover:bg-surface">
              {s.done ? <CheckCircle2 aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-success" /> : <Circle aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-muted" />}
              <span className="min-w-0">
                <span className={`block text-sm font-medium ${s.done ? "text-muted line-through" : ""}`}>{s.title}</span>
                <span className="block text-xs text-muted">{s.body}</span>
              </span>
              <span className="sr-only">{s.done ? "(done)" : "(to do)"}</span>
            </Link>
          </li>
        ))}
      </ol>
    </Card>
  );
}

export function Dashboard() {
  const hour = useHour();
  const profile = useProfile();
  const timeZone = profile?.timezone || browserTimeZone();
  const [data, setData] = useState<Dashboard | null>(null);
  const [plan, setPlan] = useState<PlanSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    fetchDashboard().then(
      (d) => {
        if (cancelled) return;
        setData(d);
        setError(null);
      },
      (err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load your dashboard.");
      },
    );
    fetchPlan().then((p) => !cancelled && setPlan(p), () => undefined);
    return () => {
      cancelled = true;
    };
  }, [tick]);

  // While anything is still being processed, keep the numbers and statuses fresh.
  const busy = (data?.stats.inProgress ?? 0) > 0;
  useEffect(() => {
    if (!busy) return;
    const id = setInterval(refresh, 4000);
    return () => clearInterval(id);
  }, [busy, refresh]);

  const m = data?.metrics;
  // One list for everything recent: what is running now first, then meetings and recordings together, newest first.
  const conversations = data
    ? [...data.inProgress, ...[...data.recentMeetings, ...data.recentRecordings].filter((r) => !data.inProgress.some((i) => i.id === r.id)).sort((a, b) => b.at.localeCompare(a.at))]
        .filter((r, i, all) => all.findIndex((x) => x.id === r.id && x.kind === r.kind) === i)
        .slice(0, 5)
    : null;
  const side = true;
  const first = (profile?.name?.trim() || "").split(/\s+/)[0];
  const today = hour >= 0 ? formatDay(new Date(), timeZone) : "";

  return (
    <div className="space-y-8">
      <PageHeader
        title={hour >= 0 ? `${greeting(hour)}${first ? `, ${first}` : ""}` : "Welcome back"}
        description={today ? `${today}. Here's what's coming up and what needs you.` : "Here's what's coming up and what needs you."}
        actions={
          <>
            <ButtonLink href="/dashboard/capture" variant="secondary">
              <Video aria-hidden className="h-4 w-4" /> Capture a meeting
            </ButtonLink>
            <ButtonLink href="/dashboard/voice" variant="primary">
              <Mic aria-hidden className="h-4 w-4" /> Record a thought
            </ButtonLink>
          </>
        }
      />

      {error && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          <span>{error}</span>
          <Button variant="secondary" onClick={refresh}>Retry</Button>
        </div>
      )}

      <section aria-label="This month" className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {m && data ? (
          <>
            <Metric label="Meetings captured" value={m.meetingsCaptured.thisMonth} icon={<Video className="h-4 w-4" />} href="/dashboard/library?tab=recordings">
              <Delta now={m.meetingsCaptured.thisMonth} before={m.meetingsCaptured.lastMonth} />
            </Metric>
            <Metric label="Time transcribed" value={formatMinutes(m.minutesTranscribed.thisMonth)} icon={<Clock className="h-4 w-4" />} href="/dashboard/plan">
              <Delta now={m.minutesTranscribed.thisMonth} before={m.minutesTranscribed.lastMonth} format={formatMinutes} />
            </Metric>
            {m.actionItems !== null ? (
              <Metric label="Action items to review" value={m.actionItems.toReview} icon={<ListChecks className="h-4 w-4" />} href={data.actionItems[0]?.href ?? "/dashboard/library"} tone={m.actionItems.toReview > 0 ? "warning" : undefined}>
                <span className="text-xs text-muted">{m.actionItems.open} open · accepted, not done</span>
              </Metric>
            ) : (
              <Metric label="Recordings this month" value={data.stats.recordingsThisMonth} icon={<Mic className="h-4 w-4" />} href="/dashboard/library?tab=recordings">
                <span className="text-xs text-muted">Uploads and meetings created</span>
              </Metric>
            )}
            {plan ? (
              <Metric label="Allowance left" value={formatMinutes(plan.remainingMinutes)} icon={<Gauge className="h-4 w-4" />} href="/dashboard/plan" tone={plan.exhausted ? "warning" : undefined}>
                <span className="block h-1.5 overflow-hidden rounded-full bg-border" aria-hidden>
                  <span className={`block h-full rounded-full ${plan.exhausted ? "bg-danger-solid" : "bg-accent-solid"}`} style={{ width: `${Math.min(100, Math.round((plan.usedMinutes / Math.max(1, plan.allowanceMinutes)) * 100))}%` }} />
                </span>
                <span className="mt-1.5 block text-xs text-muted">{PLAN_LABEL[plan.plan.plan]} · resets {formatDate(plan.resetsAt, plan.timezone)}</span>
              </Metric>
            ) : (
              <Metric label="In progress" value={data.stats.inProgress} icon={<Gauge className="h-4 w-4" />} href="/dashboard/library?tab=recordings">
                <span className="text-xs text-muted">{data.stats.inProgress === 0 ? "Nothing running right now" : "Currently recording or transcribing"}</span>
              </Metric>
            )}
          </>
        ) : (
          [0, 1, 2, 3].map((i) => <MetricSkeleton key={i} />)
        )}
      </section>

      {data && data.needsAttention.length > 0 && (
        <section aria-label="Needs attention" className="rounded-xl border border-danger/30 bg-danger/5">
          <ul className="divide-y divide-danger/15">
            {data.needsAttention.slice(0, 2).map((it) => (
              <li key={`${it.kind}-${it.id}`}>
                <Link href={dashboardPath(it.href)} className="flex items-center gap-3 px-4 py-3 text-sm transition-colors hover:bg-danger/5">
                  <AlertTriangle aria-hidden className="h-4 w-4 shrink-0 text-danger" />
                  <span className="min-w-0 flex-1 truncate"><span className="font-medium">{it.title}</span> <span className="text-muted">· {it.failureReason ?? "needs a look"}</span></span>
                  <ArrowRight aria-hidden className="h-4 w-4 shrink-0 text-muted" />
                </Link>
              </li>
            ))}
          </ul>
          {data.needsAttention.length > 2 && <p className="px-4 pb-3 text-xs text-muted">and {data.needsAttention.length - 2} more in your library</p>}
        </section>
      )}

      <div className={`grid gap-6 ${side ? "xl:grid-cols-3" : ""}`}>
        <div className="min-w-0 space-y-6 xl:col-span-2">
          {data?.capabilities?.calendar !== false && <UpcomingMeetings timeZone={timeZone} />}

          <ListCard
            title="Recent conversations"
            id="recent-conversations"
            items={conversations}
            action={viewAll("/dashboard/library?tab=recordings")}
            empty={<EmptyState icon={<Mic className="h-5 w-5" />} title="No conversations yet" body="Record a thought, upload audio or send an assistant to a meeting. The transcript lands here." action={<ButtonLink href="/dashboard/voice" variant="primary">Record a thought</ButtonLink>} />}
          />
        </div>

        <div className="min-w-0 space-y-6">
          <QuotaCard />
          {data && data.actionItems.length > 0 && <ActionItems d={data} />}
          {data && <GettingStarted d={data} />}
        </div>
      </div>
    </div>
  );
}
