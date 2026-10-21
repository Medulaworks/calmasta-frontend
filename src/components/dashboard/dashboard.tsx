"use client";

import { AlertTriangle, ArrowRight, CheckCircle2, Circle, Clock, FileText, Loader, Mic, Video } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatTile, StatTileSkeleton } from "@/components/ui/stat-tile";
import { type Dashboard, fetchDashboard } from "@/lib/dashboard-client";
import { formatMinutes, greeting } from "@/lib/status";
import { ItemRow, ItemRowSkeleton } from "./item-row";

const noSubscribe = () => () => {};
// -1 on the server so the first paint never disagrees with the browser's clock.
const useHour = () => useSyncExternalStore(noSubscribe, () => new Date().getHours(), () => -1);

function ListCard({ title, id, items, empty, action, showReason }: { title: string; id: string; items: Dashboard["recentRecordings"] | null; empty: React.ReactNode; action?: React.ReactNode; showReason?: boolean }) {
  return (
    <Card>
      <CardHeader title={title} id={id} action={action} />
      {items === null ? (
        <ul aria-labelledby={id} className="divide-y divide-border">
          {[0, 1, 2].map((i) => (
            <ItemRowSkeleton key={i} />
          ))}
        </ul>
      ) : items.length === 0 ? (
        empty
      ) : (
        <ul aria-labelledby={id} className="divide-y divide-border">
          {items.map((it) => (
            <ItemRow key={`${it.kind}-${it.id}`} item={it} showReason={showReason} />
          ))}
        </ul>
      )}
    </Card>
  );
}

function GettingStarted({ d }: { d: Dashboard }) {
  const latest = d.recentRecordings.find((r) => r.kind === "recording");
  const steps = [
    { done: d.progress.hasRecording, title: "Record or upload audio", body: "Speak for a minute or upload a file.", href: "/voice" },
    { done: d.progress.hasDocument, title: "Turn it into a document", body: "Pick a template and edit the result.", href: latest?.href ?? "/voice" },
    { done: d.progress.hasMeetingCapture, title: "Capture a meeting", body: "Send a visible assistant to a call.", href: "/capture" },
  ];
  if (steps.every((s) => s.done)) return null;
  const done = steps.filter((s) => s.done).length;
  return (
    <Card>
      <CardHeader title="Get started" action={<span className="text-xs text-muted">{done} of {steps.length}</span>} />
      <ol className="divide-y divide-border">
        {steps.map((s) => (
          <li key={s.title}>
            <Link href={s.href} className="flex items-start gap-3 px-5 py-3.5 transition-colors hover:bg-surface">
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
  const [data, setData] = useState<Dashboard | null>(null);
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

  const s = data?.stats;
  return (
    <div className="space-y-8">
      <PageHeader
        title={hour >= 0 ? greeting(hour) : "Welcome back"}
        description="Here is what is happening with your conversations."
        actions={
          <>
            <ButtonLink href="/capture" variant="secondary">
              <Video aria-hidden className="h-4 w-4" /> Capture a meeting
            </ButtonLink>
            <ButtonLink href="/voice" variant="primary">
              <Mic aria-hidden className="h-4 w-4" /> Record a thought
            </ButtonLink>
          </>
        }
      />

      {error && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          <span>{error}</span>
          <Button variant="secondary" onClick={refresh}>
            Retry
          </Button>
        </div>
      )}

      <section aria-label="Overview" className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {s ? (
          <>
            <StatTile label="Recordings" value={s.recordingsThisMonth} hint="This month" icon={<Mic className="h-4 w-4" />} />
            <StatTile label="Transcribed" value={formatMinutes(s.minutesTranscribedThisMonth)} hint="This month" icon={<Clock className="h-4 w-4" />} />
            <StatTile label="Documents" value={s.documents} hint="In your library" icon={<FileText className="h-4 w-4" />} />
            <StatTile label="In progress" value={s.inProgress} hint={s.inProgress ? "Updating automatically" : "Nothing running"} icon={<Loader className={`h-4 w-4 ${s.inProgress ? "animate-spin" : ""}`} />} />
          </>
        ) : (
          [0, 1, 2, 3].map((i) => <StatTileSkeleton key={i} />)
        )}
      </section>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="min-w-0 space-y-6 xl:col-span-2">
          {data && data.needsAttention.length > 0 && (
            <Card className="border-danger/30">
              <div className="flex items-center gap-2 border-b border-danger/20 px-5 py-3.5 text-danger">
                <AlertTriangle aria-hidden className="h-4 w-4" />
                <h2 className="text-sm font-semibold">Needs attention</h2>
              </div>
              <ul className="divide-y divide-border">
                {data.needsAttention.map((it) => (
                  <ItemRow key={`${it.kind}-${it.id}`} item={it} showReason />
                ))}
              </ul>
            </Card>
          )}

          {data && data.inProgress.length > 0 && (
            <ListCard title="In progress" id="in-progress" items={data.inProgress} empty={null} />
          )}

          <ListCard
            title="Recent recordings"
            id="recent-recordings"
            items={data ? data.recentRecordings : null}
            action={
              <Link href="/library?tab=recordings" className="inline-flex items-center gap-1 text-xs text-muted hover:text-foreground">
                View all <ArrowRight aria-hidden className="h-3 w-3" />
              </Link>
            }
            empty={
              <EmptyState
                icon={<Mic className="h-5 w-5" />}
                title="No recordings yet"
                body="Record a thought or upload audio to get your first transcript."
                action={<ButtonLink href="/voice" variant="primary">Record a thought</ButtonLink>}
              />
            }
          />
        </div>

        <div className="min-w-0 space-y-6">
          {data && <GettingStarted d={data} />}
          <ListCard
            title="Recent documents"
            id="recent-documents"
            items={data ? data.recentDocuments : null}
            action={
              <Link href="/library" className="inline-flex items-center gap-1 text-xs text-muted hover:text-foreground">
                View all <ArrowRight aria-hidden className="h-3 w-3" />
              </Link>
            }
            empty={<EmptyState icon={<FileText className="h-5 w-5" />} title="No documents yet" body="Documents you create from a recording appear here." />}
          />
        </div>
      </div>
    </div>
  );
}
