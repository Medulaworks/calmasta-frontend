"use client";

import { dashboardPath } from "@/lib/app-routes";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, Sparkles } from "lucide-react";
import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { useProfile } from "@/components/shell/profile-context";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { InboxIllustration, VoiceIllustration } from "@/components/ui/illustrations";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { type Dashboard } from "@/lib/dashboard-client";
import { type DashboardState, resolveDashboardState } from "@/lib/dashboard-state";
import { markResultSeen, resultSeen } from "@/lib/first-result";
import { dashboardQuery } from "@/lib/queries";
import { greeting } from "@/lib/status";
import { browserTimeZone } from "@/lib/tz";
import { ItemRow, ItemRowSkeleton, statusFor } from "./item-row";
import { ActionCards, WelcomeBar } from "./home";
import { ActionDock, CalendarPrompt, Checklist, DropAnywhere, FirstResultCard, FollowUps, SampleResult } from "./parts";
import { refetchWhileRunning } from "./running";
import { UpcomingMeetings } from "./upcoming-meetings";

const noSubscribe = () => () => {};
// -1 on the server so the first paint never disagrees with the browser's clock.
const useHour = () => useSyncExternalStore(noSubscribe, () => new Date().getHours(), () => -1);

function ListCard({ title, id, items, empty, action, showReason }: { title: string; id: string; items: Dashboard["recentRecordings"] | null; empty: React.ReactNode; action?: React.ReactNode; showReason?: boolean }) {
  return (
    <Card className="flex min-h-72 flex-1 flex-col">
      <CardHeader title={title} id={id} action={action} />
      {items === null ? (
        <ul aria-labelledby={id} className="flex-1 divide-y divide-border">{[0, 1, 2].map((i) => <ItemRowSkeleton key={i} />)}</ul>
      ) : items.length === 0 ? (
        empty
      ) : (
        <ul aria-labelledby={id} className="flex-1 divide-y divide-border">
          {items.map((it) => <ItemRow key={`${it.kind}-${it.id}`} item={it} showReason={showReason} />)}
        </ul>
      )}
    </Card>
  );
}

const viewAll = (href: string) => (
  <ButtonLink href={href} variant="secondary" size="sm">
    View all <ArrowRight aria-hidden className="size-4" />
  </ButtonLink>
);

export function Dashboard() {
  const hour = useHour();
  const profile = useProfile();
  const timeZone = profile?.timezone || browserTimeZone();
  const {
    data: dataRaw,
    error: queryError,
    refetch,
  } = useQuery({
    ...dashboardQuery,
    refetchInterval: refetchWhileRunning,
  });
  const data = dataRaw ?? null;
  const error = queryError ? (queryError instanceof Error ? queryError.message : "We couldn’t load your dashboard. Please try again.") : null;
  const refresh = () => void refetch();
  const [seen, setSeen] = useState(() => (typeof window === "undefined" ? true : resultSeen()));
  const first = (profile?.name?.trim() || "").split(/\s+/)[0];

  // One list for everything recent: what is running now first, then meetings and recordings together, newest first.
  const conversations = data
    ? [...data.inProgress, ...[...data.recentMeetings, ...data.recentRecordings].filter((r: Dashboard["recentRecordings"][number]) => !data.inProgress.some((i: Dashboard["inProgress"][number]) => i.id === r.id && i.kind === r.kind))]
        .filter((r: Dashboard["recentRecordings"][number], i: number, all: Dashboard["recentRecordings"]) => all.findIndex((x: Dashboard["recentRecordings"][number]) => x.id === r.id && x.kind === r.kind) === i)
        .sort((a, b) => (b.at > a.at ? 1 : -1))
        .slice(0, 8)
    : null;

  // Finished captures, for the state. The server only sends the latest few, so "this month" fills in the count when it is larger.
  const finished = data ? conversations!.filter((c) => c.kind !== "document" && statusFor(c).tone === "success") : [];
  const captureCount = data ? Math.max(finished.length, data.stats.recordingsThisMonth + data.metrics.meetingsCaptured.thisMonth) : 0;
  const state: DashboardState | null = data
    ? resolveDashboardState({ captureCount, captureDates: finished.map((c) => c.at), firstResultSeen: seen, now: new Date(), timeZone })
    : null;

  const greetingTitle = hour < 0 ? "Welcome back" : state === "cold" ? `${greeting(hour)}.` : state === "lapsed" ? "Welcome back." : `Welcome back${first ? `, ${first}` : ""}.`;
  const waiting = data?.metrics.actionItems ? data.metrics.actionItems.open + data.metrics.actionItems.toReview : 0;
  const subtitle =
    state === "cold" ? "Your ideas deserve somewhere useful to go."
    : state === "lapsed" ? "Here’s where you left off."
    : waiting > 0 ? `${waiting} ${waiting === 1 ? "thing is" : "things are"} waiting on you.`
    : "Here’s what’s been happening.";

  const recent = (limit = 8) => (
    <ListCard
      title="History"
      id="recent-conversations"
      items={conversations ? conversations.slice(0, limit) : null}
      action={viewAll("/dashboard/library?tab=recordings")}
      empty={<EmptyState illustration={<InboxIllustration />} title="Your next good idea starts here" body="Capture a conversation, record a thought or upload an audio file. Your transcripts, summaries and action points will appear here." />}
    />
  );

  return (
    <div className="flex flex-col gap-4">
      <DropAnywhere />
      {state === "cold" && <PageHeader title={greetingTitle} description={subtitle} />}

      {error && (
        <div role="alert" className="flex items-center justify-between gap-4 rounded-2xl border border-danger/30 bg-danger/10 px-5 py-3 text-sm text-danger">
          <span>{error}</span>
          <Button variant="secondary" onClick={refresh}>Try again</Button>
        </div>
      )}

      {data && data.needsAttention.length > 0 && (
        <section aria-label="Needs attention" className="rounded-2xl border border-danger/30 bg-danger/5">
          <ul className="divide-y divide-danger/15">
            {data.needsAttention.slice(0, 2).map((it: Dashboard["needsAttention"][number]) => (
              <li key={`${it.kind}-${it.id}`}>
                <Link href={dashboardPath(it.href)} className="flex items-center gap-4 px-5 py-3 text-sm transition-colors hover:bg-danger/5">
                  <AlertTriangle aria-hidden className="h-5 w-5 shrink-0 text-danger" />
                  <span className="min-w-0 flex-1 truncate"><span className="font-medium">{it.title}</span> <span className="text-muted">· {it.failureReason ?? "needs a look"}</span></span>
                  <ArrowRight aria-hidden className="h-5 w-5 shrink-0 text-muted" />
                </Link>
              </li>
            ))}
          </ul>
          {data.needsAttention.length > 2 && <p className="px-5 pb-4 text-xs text-muted">and {data.needsAttention.length - 2} more in your folder</p>}
        </section>
      )}

      {state === null && (
        <div role="status" aria-label="Loading" aria-busy="true" className="space-y-5">
          <div className="h-48 jb-skel rounded-3xl border border-border bg-surface" />
          <div className="grid gap-5 lg:grid-cols-2">{[0, 1].map((i) => <div key={i} className="h-64 jb-skel rounded-2xl border border-border bg-surface" />)}</div>
        </div>
      )}

      {data && state === "cold" && (
        <>
          <section className="jb-rise relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-accent-solid/15 via-background to-background p-6 md:p-12">
            <div aria-hidden className="jb-orb pointer-events-none absolute -right-20 -top-20 size-72 rounded-full bg-accent-solid/20 blur-3xl" />
            <div className="relative grid items-center gap-6 md:grid-cols-[1fr_16rem]">
              <div>
                <p className="inline-flex items-center gap-2 rounded-full border border-border bg-background/80 px-4 py-1 text-xs font-medium text-muted backdrop-blur"><Sparkles aria-hidden className="size-4 text-accent" /> Capture · Understand · Act</p>
                <h2 className="mt-4 text-3xl font-semibold tracking-tight md:text-4xl">Capture it. Make sense of it. Put it to work.</h2>
                <p className="mt-4 max-w-2xl text-base text-muted">Meetings, ideas, conversations and voice notes deserve more than a recording. Joobah helps you turn what you say and hear into organised information, useful insights and actionable next steps.</p>
              </div>
              <div className="mx-auto hidden w-full max-w-64 md:block"><VoiceIllustration /></div>
            </div>
          </section>

          <div className="jb-rise" style={{ ["--d" as string]: "0.1s" } as React.CSSProperties}>
            <h2 className="mb-4 text-lg font-semibold">What would you like to do?</h2>
            <ActionDock />
          </div>

          <div className="grid gap-5 xl:grid-cols-3">
            <div className="min-w-0 xl:col-span-2"><SampleResult /></div>
            <div className="min-w-0 space-y-5">
              {data.capabilities?.calendar !== false && <CalendarPrompt />}
              <Checklist d={data} seen={seen} />
            </div>
          </div>

          <p className="mx-auto max-w-2xl pb-4 text-center text-base text-muted">Your thoughts should not get lost. Your conversations should not go to waste. Joobah helps you remember more, organise better and follow through.</p>
        </>
      )}

      {data && state !== null && state !== "cold" && (
        <>
          <WelcomeBar title={greetingTitle} subtitle={subtitle} timeZone={timeZone} />
          <ActionCards />
          {state === "first_result" && <FirstResultCard d={data} onOpen={() => { markResultSeen(); setSeen(true); }} />}
          {(() => {
            const side = [
              data.capabilities?.calendar !== false ? <UpcomingMeetings key="up" timeZone={timeZone} /> : <CalendarPrompt key="cal" />,
              state !== "lapsed" && (state === "active" || waiting > 0) && <FollowUps key="fu" d={data} />,
            ].filter(Boolean);
            return (
              <div className={`flex flex-col gap-4 ${side.length ? "xl:grid xl:grid-cols-3 xl:items-start" : ""}`}>
                <div className="flex min-w-0 flex-col xl:col-span-2 xl:[&:only-child]:col-span-3">{recent(state === "lapsed" ? 5 : 8)}</div>
                {side.length > 0 && <div className="min-w-0 space-y-4">{side}</div>}
              </div>
            );
          })()}
        </>
      )}
    </div>
  );
}
