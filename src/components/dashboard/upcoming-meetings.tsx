"use client";

import { ArrowRight, CalendarDays, Video } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { type Agenda, type AgendaEvent, getAgenda } from "@/lib/calendar-client";
import { PLATFORM_LABEL, isUpcoming, platformOf, recordingOf } from "@/lib/meetings";
import { addDays, dayKey, dayRange, formatTime, todayIn } from "@/lib/tz";

const DAYS = 7;
const SHOWN = 4;

function when(e: AgendaEvent, tz: string, now: Date): { day: string; time: string; soon: string | null } {
  const today = todayIn(tz, now);
  const k = dayKey(e.start, tz);
  const day = k === today ? "Today" : k === addDays(today, 1) ? "Tomorrow" : new Intl.DateTimeFormat(undefined, { timeZone: tz, weekday: "short", day: "numeric", month: "short" }).format(new Date(e.start));
  const mins = Math.round((new Date(e.start).getTime() - now.getTime()) / 60_000);
  const soon = new Date(e.start) <= now ? "Happening now" : mins <= 90 ? (mins < 2 ? "Starting now" : `In ${mins} min`) : null;
  return { day, time: e.allDay ? "All day" : formatTime(e.start, tz), soon };
}

/** The next week of meetings from the connected calendars and bookings, so the day's first question has an answer. */
export function UpcomingMeetings({ timeZone }: { timeZone: string }) {
  const [now] = useState(() => new Date());
  const win = useMemo(() => {
    const today = todayIn(timeZone, now);
    return { from: dayRange(timeZone, today).from, to: dayRange(timeZone, today, DAYS).to };
  }, [timeZone, now]);
  const [state, setState] = useState<{ key: string; data: Agenda | null; error: boolean } | null>(null);
  const key = `${win.from.getTime()}|${win.to.getTime()}`;
  useEffect(() => {
    let cancelled = false;
    getAgenda(win.from, win.to).then(
      (data) => !cancelled && setState({ key, data, error: false }),
      () => !cancelled && setState({ key, data: null, error: true }),
    );
    return () => {
      cancelled = true;
    };
  }, [win.from, win.to, key]);

  const loading = !state || state.key !== key;
  const upcoming = useMemo(() => (loading || !state.data ? [] : state.data.events.filter((e) => !e.allDay && isUpcoming(e, now))), [loading, state, now]);
  const shown = upcoming.slice(0, SHOWN);

  return (
    <Card>
      <CardHeader
        title="Upcoming meetings"
        id="upcoming"
        action={
          <span className="flex items-center gap-3">
            <Link href="/dashboard/calendar" className="inline-flex items-center gap-1 text-xs text-muted hover:text-foreground">Calendar <ArrowRight aria-hidden className="h-3 w-3" /></Link>
          </span>
        }
      />
      {loading ? (
        <ul aria-hidden className="divide-y divide-border">{[0, 1, 2].map((i) => <li key={i} className="px-5 py-4"><span className="block h-4 w-2/3 jb-skel rounded bg-border" /></li>)}</ul>
      ) : state.error ? (
        <p role="alert" className="px-5 py-6 text-sm text-danger">Couldn&rsquo;t load your calendar just now. Try refreshing in a moment.</p>
      ) : !state.data?.connected ? (
        <EmptyState icon={<CalendarDays className="h-5 w-5" />} title="Connect your calendar" body="See what's coming up here, avoid double-booking, and send the assistant to a meeting in one click." action={<ButtonLink href="/dashboard/calendar" variant="primary">Connect a calendar</ButtonLink>} />
      ) : shown.length === 0 ? (
        <EmptyState icon={<CalendarDays className="h-5 w-5" />} title="Nothing in the next week" body="Meetings from your calendars and bookings will show up here." action={<ButtonLink href="/dashboard/booking" variant="secondary">Set up booking</ButtonLink>} />
      ) : (
        <ul aria-labelledby="upcoming" className="divide-y divide-border">
          {shown.map((e, i) => {
            const w = when(e, timeZone, now);
            const others = e.attendees.filter((a) => !a.self);
            const platform = platformOf(e);
            const rec = recordingOf(e);
            return (
              <li key={e.id} className={`flex items-stretch ${i === 0 ? "bg-accent/5" : ""}`}>
                <Link href="/dashboard/calendar" className="flex min-w-0 flex-1 items-center gap-4 px-5 py-3 transition-colors hover:bg-surface">
                  <span className="w-20 shrink-0 text-xs">
                    <span className="block font-medium text-foreground">{w.day}</span>
                    <span className="block tabular-nums text-muted">{w.time}</span>
                  </span>
                  <span aria-hidden className="h-9 w-1 shrink-0 rounded-full" style={{ background: e.calendarColor ?? "var(--accent)" }} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{e.title}</span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                      {platform !== "none" && <span>{PLATFORM_LABEL[platform]}</span>}
                      {others.length > 0 && <span>{others.length} {others.length === 1 ? "guest" : "guests"}</span>}
                      {rec === "in_progress" && <Badge tone="warning" active>Assistant joining</Badge>}
                      {w.soon && <Badge tone={w.soon === "Happening now" ? "success" : "info"}>{w.soon}</Badge>}
                    </span>
                  </span>
                </Link>
                {e.joinUrl && (
                  <a href={e.joinUrl} target="_blank" rel="noopener noreferrer" aria-label={`Join ${e.title}`} className="flex w-14 shrink-0 items-center justify-center border-l border-border text-muted transition-colors hover:bg-accent-solid hover:text-on-accent">
                    <Video aria-hidden className="h-5 w-5" />
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
