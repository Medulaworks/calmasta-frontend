"use client";

import { CalendarDays, ChevronLeft, ChevronRight, ExternalLink, TriangleAlert, Video } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useProfile } from "@/components/shell/profile-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { type Agenda, type AgendaEvent, type ConnectionView, connectDevCalendar, disconnectCalendar, getAgenda, getConnections } from "@/lib/calendar-client";
import { captureStatus } from "@/lib/status";
import { addDays, browserTimeZone, dayRange, formatDay, formatTime, todayIn, zoneLabel } from "@/lib/tz";

/** A read-only view of the user's days, and the connection behind it. Connecting a calendar never starts recording. */
export function CalendarView() {
  const profile = useProfile();
  const search = useSearchParams();
  const outcome = search.get("connected") ? { ok: true, text: "Calendar connected." } : search.get("error") ? { ok: false, text: ({ cancelled: "Connecting was cancelled, so nothing changed.", not_available: "This setup has no real calendar to sign in to." } as Record<string, string>)[search.get("error")!] ?? "We couldn't connect your calendar. Please try again." } : null;
  const timeZone = profile?.timezone || browserTimeZone();
  const [conns, setConns] = useState<{ provider: string; connections: ConnectionView[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((n) => n + 1), []);
  const [disconnecting, setDisconnecting] = useState<ConnectionView | null>(null);
  const [busy, setBusy] = useState(false);

  const [date, setDate] = useState(() => todayIn(timeZone));
  const [agenda, setAgenda] = useState<{ date: string; tz: string; data: Agenda | null; error?: string } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getConnections().then(
      (c) => !cancelled && setConns(c),
      (err) => !cancelled && setError(err instanceof Error ? err.message : "Could not load your calendars."),
    );
    return () => {
      cancelled = true;
    };
  }, [tick]);

  useEffect(() => {
    let cancelled = false;
    const { from, to } = dayRange(timeZone, date);
    getAgenda(from, to).then(
      (data) => !cancelled && setAgenda({ date, tz: timeZone, data }),
      (err) => !cancelled && setAgenda({ date, tz: timeZone, data: null, error: err instanceof Error ? err.message : "Could not load your day." }),
    );
    return () => {
      cancelled = true;
    };
  }, [date, timeZone, tick]);

  const loading = !agenda || agenda.date !== date || agenda.tz !== timeZone;
  const data = loading ? null : agenda!.data;
  const events = data?.events ?? [];
  const picked = events.find((e) => e.id === selected) ?? null;
  const today = todayIn(timeZone);
  const isDev = conns?.provider === "mock";

  async function connect() {
    setBusy(true);
    setError(null);
    try {
      await connectDevCalendar();
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not connect.");
    }
    setBusy(false);
  }
  async function confirmDisconnect() {
    if (!disconnecting) return;
    setBusy(true);
    try {
      await disconnectCalendar(disconnecting.id);
      setDisconnecting(null);
      setSelected(null);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not disconnect.");
    }
    setBusy(false);
  }

  return (
    <div className="space-y-6">
      {outcome && <p role={outcome.ok ? "status" : "alert"} className={`rounded-lg border px-4 py-3 text-sm ${outcome.ok ? "border-success/30 bg-success/10 text-success" : "border-danger/30 bg-danger/10 text-danger"}`}>{outcome.text}</p>}
      {error && <p role="alert" className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>}

      <Card>
        <CardHeader title="Connected calendars" />
        {conns === null ? (
          <div aria-hidden className="space-y-3 p-5"><div className="h-4 w-1/3 animate-pulse rounded bg-border" /><div className="h-3 w-2/3 animate-pulse rounded bg-border" /></div>
        ) : conns.connections.length === 0 ? (
          <EmptyState
            icon={<CalendarDays className="h-5 w-5" />}
            title="Connect your calendar"
            body="See your day in one place and keep people from booking over your other events. Connecting only reads your calendar: it never starts a recording, and CalMasta does not change your existing events."
            action={
              isDev ? (
                <div className="space-y-2">
                  <Button variant="primary" onClick={() => void connect()} disabled={busy}>{busy ? "Connecting…" : "Connect a development calendar"}</Button>
                  <p className="text-xs text-muted">Development stand-in: no real calendar is contacted.</p>
                </div>
              ) : (
                <a href="/api/calendar/connect/start" className="inline-flex items-center justify-center rounded-lg bg-accent-solid px-4 py-2 text-sm font-medium text-white hover:opacity-90">Connect Google Calendar</a>
              )
            }
          />
        ) : (
          <ul className="divide-y divide-border">
            {conns.connections.map((c) => (
              <li key={c.id} className="space-y-3 px-5 py-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{c.accountEmail}</p>
                    <Badge tone={c.status === "connected" ? "success" : "warning"}>{c.status === "connected" ? "Connected" : "Needs reconnecting"}</Badge>
                  </div>
                  <div className="flex gap-2">
                    {c.status === "needs_reconnect" && (isDev ? <Button variant="primary" onClick={() => void connect()} disabled={busy}>Reconnect</Button> : <a href="/api/calendar/connect/start" className="inline-flex items-center rounded-lg bg-accent-solid px-4 py-2 text-sm font-medium text-white">Reconnect</a>)}
                    <Button variant="ghost" onClick={() => setDisconnecting(c)}>Disconnect</Button>
                  </div>
                </div>
                {c.status === "needs_reconnect" && (
                  <p role="status" className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-warning"><TriangleAlert aria-hidden className="mt-0.5 h-4 w-4 shrink-0" /> CalMasta lost access to this calendar. Its events aren&apos;t shown, and booking pages that check it are paused so nobody is booked over your events. Reconnect to fix it.</p>
                )}
                <ul className="flex flex-wrap gap-2">
                  {c.calendars.map((k) => (
                    <li key={k.id} className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs">
                      <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: k.color ?? "var(--muted)" }} /> {k.name}{k.isPrimary && <span className="text-muted">(main)</span>}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {disconnecting && (
        <div role="alertdialog" aria-label="Confirm disconnect" className="rounded-xl border border-border bg-surface p-5 text-sm">
          <p className="font-medium">Disconnect {disconnecting.accountEmail}?</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
            <li>
              {disconnecting.impact.upcomingBookings > 0
                ? `${disconnecting.impact.upcomingBookings} upcoming booking${disconnecting.impact.upcomingBookings === 1 ? "" : "s"} stay confirmed, but will no longer be added to this calendar.`
                : "No upcoming bookings are written to this calendar."}
            </li>
            <li>
              {disconnecting.impact.availabilities > 0
                ? `${disconnecting.impact.availabilities} availability setting${disconnecting.impact.availabilities === 1 ? "" : "s"} use it and will stop checking it for clashes. Guests could then be offered times when you are busy.`
                : "No availability settings use it."}
            </li>
            <li>Events already on your calendar are not deleted. Recording is not affected: it is controlled per meeting type.</li>
          </ul>
          <div className="mt-4 flex gap-2">
            <Button variant="danger" disabled={busy} onClick={() => void confirmDisconnect()}>{busy ? "Disconnecting…" : "Disconnect"}</Button>
            <Button variant="ghost" disabled={busy} onClick={() => setDisconnecting(null)}>Cancel</Button>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="min-w-0 lg:col-span-2">
          <CardHeader
            title="Agenda"
            action={
              <div className="flex items-center gap-1">
                <button type="button" aria-label="Previous day" onClick={() => setDate(addDays(date, -1))} className="grid h-8 w-8 place-items-center rounded-lg border border-border hover:bg-surface"><ChevronLeft aria-hidden className="h-4 w-4" /></button>
                <button type="button" onClick={() => setDate(today)} disabled={date === today} className="rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-surface disabled:opacity-50">Today</button>
                <button type="button" aria-label="Next day" onClick={() => setDate(addDays(date, 1))} className="grid h-8 w-8 place-items-center rounded-lg border border-border hover:bg-surface"><ChevronRight aria-hidden className="h-4 w-4" /></button>
              </div>
            }
          />
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-3 text-sm">
            <p className="font-medium">{formatDay(dayRange(timeZone, date).from, timeZone)}</p>
            <label className="flex items-center gap-2 text-xs text-muted">
              <span className="sr-only">Go to date</span>
              <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className="rounded-lg border border-border bg-background px-2 py-1" />
            </label>
          </div>
          <p className="border-b border-border px-5 py-2 text-xs text-muted">Times shown in {timeZone.replace(/_/g, " ")} ({zoneLabel(timeZone)}). Read-only: change events in your calendar app.</p>

          {data?.problems.map((p) => (
            <p key={p.connectionId} role="status" className="flex items-start gap-2 border-b border-border bg-warning/10 px-5 py-3 text-sm text-warning">
              <TriangleAlert aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
              {p.reason === "needs_reconnect" ? `${p.accountEmail} needs reconnecting, so its events aren't shown.` : `${p.accountEmail} could not be reached just now, so some events may be missing. Try again in a moment.`}
            </p>
          ))}

          {agenda && agenda.date === date && agenda.error ? (
            <p role="alert" className="px-5 py-6 text-sm text-danger">{agenda.error}</p>
          ) : loading ? (
            <ul aria-hidden className="divide-y divide-border">{[0, 1, 2].map((i) => <li key={i} className="px-5 py-4"><div className="h-4 w-1/2 animate-pulse rounded bg-border" /></li>)}</ul>
          ) : events.length === 0 ? (
            <EmptyState icon={<CalendarDays className="h-5 w-5" />} title="Nothing scheduled" body={data?.connected ? "Your calendars have nothing on this day." : "Connect a calendar to see everything in one place. Bookings made through CalMasta appear here too."} />
          ) : (
            <ul className="divide-y divide-border">
              {events.map((e) => (
                <li key={e.id}>
                  <button type="button" onClick={() => setSelected(e.id)} aria-pressed={selected === e.id} className={`flex w-full items-start gap-4 px-5 py-3.5 text-left text-sm transition-colors hover:bg-surface ${selected === e.id ? "bg-accent/5" : ""}`}>
                    <span className="w-28 shrink-0 pt-0.5 font-mono text-xs text-muted">{e.allDay ? "All day" : `${formatTime(e.start, timeZone)}–${formatTime(e.end, timeZone)}`}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{e.title}</span>
                      <span className="mt-0.5 flex items-center gap-2 text-xs text-muted">
                        <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: e.calendarColor ?? "var(--accent)" }} />
                        {e.calendarName}
                      </span>
                    </span>
                    {e.source === "booking" && <Badge tone="info">Booking</Badge>}
                    {e.capture && (() => { const st = captureStatus({ source: "meeting_url", state: "", status: e.capture.status }); return <Badge tone={st.tone} active={st.active}>{e.capture.status === "completed" ? "Captured" : st.label}</Badge>; })()}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <EventDetail event={picked} timeZone={timeZone} />
      </div>
    </div>
  );
}

function EventDetail({ event, timeZone }: { event: AgendaEvent | null; timeZone: string }) {
  return (
    <Card className="h-fit min-w-0">
      <CardHeader title="Event" />
      {!event ? (
        <p className="px-5 py-6 text-sm text-muted">Choose an event to see its details.</p>
      ) : (
        <div className="space-y-4 px-5 py-4 text-sm">
          <div>
            <p className="text-base font-semibold">{event.title}</p>
            <p className="mt-1 text-muted">
              {event.allDay ? `${formatDay(event.start, timeZone)}, all day` : `${formatDay(event.start, timeZone)}, ${formatTime(event.start, timeZone)} to ${formatTime(event.end, timeZone)}`}
            </p>
          </div>
          <dl className="space-y-2">
            <div><dt className="text-xs text-muted">Calendar</dt><dd>{event.calendarName}{event.accountEmail ? ` · ${event.accountEmail}` : ""}</dd></div>
            {event.location && <div><dt className="text-xs text-muted">Where</dt><dd>{event.location}</dd></div>}
            {event.joinUrl && <div><dt className="text-xs text-muted">Join link</dt><dd><a href={event.joinUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 break-all text-accent hover:underline">{event.joinUrl}<ExternalLink aria-hidden className="h-3 w-3 shrink-0" /></a></dd></div>}
          </dl>
          {event.capture ? (
            <p className="rounded-lg border border-border bg-surface px-3 py-2"><Video aria-hidden className="mr-1.5 inline h-4 w-4" />This meeting has a CalMasta capture. <Link href={`/captures/${event.capture.id}`} className="font-medium text-accent hover:underline">Open the conversation</Link></p>
          ) : event.joinUrl ? (
            <div className="space-y-1 rounded-lg border border-border bg-surface px-3 py-2">
              <p className="text-muted">Not being recorded. Nothing is captured unless you choose it.</p>
              <Link href={`/capture?link=${encodeURIComponent(event.joinUrl)}`} className="font-medium text-accent hover:underline">Add the meeting bot…</Link>
            </div>
          ) : (
            <p className="text-muted">No video link, so there is nothing for the bot to join.</p>
          )}
          {event.bookingId && <p><Link href="/booking" className="font-medium text-accent hover:underline">Manage this booking</Link></p>}
        </div>
      )}
    </Card>
  );
}
