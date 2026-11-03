"use client";

import {
  CalendarDays,
  ChevronDown,
  ExternalLink,
  Search,
  Settings2,
  Video,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useProfile } from "@/components/shell/profile-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  type Agenda,
  type AgendaEvent,
  type ConnectionView,
} from "@/lib/calendar-client";
import { agendaQuery, calendarConnectionsQuery } from "@/lib/queries";
import {
  EMPTY_FILTERS,
  type MeetingFilters,
  PLATFORM_LABEL,
  RECORDING_LABEL,
  activeCount,
  applyFilters,
  durationMin,
  groupByDay,
  isUpcoming,
  platformOf,
  recordingOf,
} from "@/lib/meetings";
import { captureStatus } from "@/lib/status";
import {
  addDays,
  browserTimeZone,
  dayRange,
  formatDay,
  formatTime,
  todayIn,
  zoneLabel,
} from "@/lib/tz";
import { ConnectionsPanel } from "./connections-panel";
import { MeetingOutcome } from "./meeting-outcome";
import { FilterChips, FilterPopover } from "./meeting-filters";

const STEP_DAYS = 31;
const MAX_STEPS = 3; // the server allows up to 93 days in one request

type Tab = "upcoming" | "past";

const initials = (name: string | null, email: string) =>
  ((name?.trim() || email)[0] ?? "?").toUpperCase();
const minutesText = (m: number) =>
  m < 60
    ? `${m} min`
    : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ""}`;

/**
 * Meetings: everything on your connected calendars plus your bookings, as a list you can search and filter in detail,
 * with the selected meeting's details beside it. Read-only: Jooba shows your events but never changes them, and
 * connecting a calendar never starts a recording.
 */
export function CalendarView() {
  const profile = useProfile();
  const search = useSearchParams();
  const queryClient = useQueryClient();
  const calParam = search.get("calendar");
  const outcome = calParam
    ? (() => {
        const map: Record<string, { ok: boolean; text: string }> = {
          connected: { ok: true, text: "Google Calendar connected." },
          denied: { ok: false, text: "Calendar connection was cancelled." },
          missing_scope: { ok: false, text: "Required calendar permissions were not granted. Please reconnect and allow them." },
          missing_grant: { ok: false, text: "Google did not return the credentials needed to keep the calendar connected. Please reconnect." },
          error: { ok: false, text: "Could not connect your calendar. Please try again." },
        };
        return map[calParam] ?? { ok: false, text: "Could not connect your calendar. Please try again." };
      })()
    : search.get("connected")
      ? { ok: true, text: "Calendar connected." }
      : search.get("error")
        ? {
            ok: false,
            text:
              (
                {
                  cancelled: "Connecting was cancelled, so nothing changed.",
                  not_available: "This setup has no real calendar to sign in to.",
                } as Record<string, string>
              )[search.get("error")!] ??
              "We couldn't connect your calendar. Please try again.",
          }
        : null;
  const timeZone = profile?.timezone || browserTimeZone();

  // consume calendar=<outcome> once, refetch, and remove only that param
  useEffect(() => {
    if (!calParam) return;
    const url = new URL(window.location.href);
    url.searchParams.delete("calendar");
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
    void queryClient.invalidateQueries({ queryKey: calendarConnectionsQuery.queryKey });
    void queryClient.invalidateQueries({ queryKey: ["calendar", "agenda"] });
  }, [calParam, queryClient]);

  const {
    data: connsRaw,
    error: connsError,
  } = useQuery(calendarConnectionsQuery);
  const conns = connsRaw ?? null;
  const [error, setError] = useState<string | null>(null);
  const connsErrorMsg = connsError ? (connsError instanceof Error ? connsError.message : "Could not load your calendars.") : null;
  const displayError = error ?? connsErrorMsg;
  const reload = () => {
    setError(null);
    void queryClient.invalidateQueries({ queryKey: calendarConnectionsQuery.queryKey });
    void queryClient.invalidateQueries({ queryKey: ["calendar", "agenda"] });
  };
  const [manage, setManage] = useState(false);

  const [tab, setTab] = useState<Tab>("upcoming");
  const [steps, setSteps] = useState(1);
  const [filters, setFilters] = useState<MeetingFilters>(EMPTY_FILTERS);
  const [selected, setSelected] = useState<string | null>(null);
  const [now] = useState(() => new Date());

  // What to ask the server for: a date range if one is chosen, otherwise the next (or previous) month, extendable.
  const win = useMemo(() => {
    const today = todayIn(timeZone, now);
    if (filters.from || filters.to) {
      const from = filters.from ?? addDays(filters.to!, -(STEP_DAYS - 1));
      let to = filters.to ?? addDays(filters.from!, STEP_DAYS - 1);
      if (to < from) to = from;
      const last = addDays(from, MAX_STEPS * STEP_DAYS - 2);
      return {
        from: dayRange(timeZone, from).from,
        to: dayRange(timeZone, to > last ? last : to).to,
        clamped: to > last,
        ranged: true,
      };
    }
    if (tab === "upcoming")
      return {
        from: dayRange(timeZone, today).from,
        to: dayRange(timeZone, today, steps * STEP_DAYS).to,
        clamped: false,
        ranged: false,
      };
    return {
      from: dayRange(timeZone, addDays(today, -steps * STEP_DAYS)).from,
      to: dayRange(timeZone, today).to,
      clamped: false,
      ranged: false,
    };
  }, [filters.from, filters.to, tab, steps, timeZone, now]);
  const winKey = `${win.from.toISOString()}|${win.to.toISOString()}`;

  const {
    data: agendaData,
    error: agendaError,
    isLoading: agendaLoading,
    isFetching: agendaFetching,
  } = useQuery({
    ...agendaQuery(win.from, win.to),
    placeholderData: (prev) => prev,
  });
  const agenda: { key: string; data: Agenda | null; error?: string } | null = agendaError
    ? { key: winKey, data: null, error: agendaError instanceof Error ? agendaError.message : "Could not load your meetings." }
    : agendaData
      ? { key: winKey, data: agendaData }
      : null;
  const loading = agendaLoading || (agendaFetching && !agendaData);
  const loaded: AgendaEvent[] = useMemo(
    () => (agenda?.data?.events ?? []),
    [agenda],
  );
  // Outside a date range, Upcoming and Past split the loaded window at "now".
  const inTab = useMemo(
    () =>
      win.ranged
        ? loaded
        : loaded.filter((e) => (tab === "upcoming") === isUpcoming(e, now)),
    [loaded, win.ranged, tab, now],
  );
  const shown = useMemo(
    () => applyFilters(inTab, filters, timeZone),
    [inTab, filters, timeZone],
  );
  const groups = useMemo(
    () =>
      groupByDay(
        shown,
        timeZone,
        win.ranged || tab === "upcoming" ? "asc" : "desc",
        now,
      ),
    [shown, timeZone, win.ranged, tab, now],
  );
  const picked = shown.find((e) => e.id === selected) ?? null;
  const filtersOn = activeCount(filters) > 0;
  const nameOf = (email: string) =>
    loaded
      .flatMap((e) => e.attendees)
      .find((a) => a.email.toLowerCase() === email)?.name ?? email;
  const data = loading ? null : agenda!.data;
  const connected = (conns?.connections.length ?? 0) > 0;

  function changeTab(t: Tab) {
    setTab(t);
    setSteps(1);
    setSelected(null);
  }

  return (
    <div className="space-y-5">
      {outcome && (
        <p
          role={outcome.ok ? "status" : "alert"}
          className={`rounded-lg border px-4 py-3 text-sm ${outcome.ok ? "border-success/30 bg-success/10 text-success" : "border-danger/30 bg-danger/10 text-danger"}`}>
          {outcome.text}
        </p>
      )}
      {displayError && (
        <p
          role="alert"
          className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {displayError}
        </p>
      )}

      {conns && !connected ? (
        <ConnectionsPanel conns={conns} onChanged={reload} onError={setError} />
      ) : (
        <div>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface/50 px-4 py-2 text-sm">
            <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-medium">
                {conns
                  ? conns.connections.map((c: ConnectionView) => c.accountEmail).join(", ")
                  : "Loading calendars…"}
              </span>
              {conns?.connections.some(
                (c: ConnectionView) => c.status === "needs_reconnect",
              ) && <Badge tone="warning">Needs reconnecting</Badge>}
              {conns &&
                (() => {
                  const n = conns.connections.reduce(
                    (t: number, c: ConnectionView) => t + c.calendars.length,
                    0,
                  );
                  const a = conns.connections.length;
                  return (
                    <span className="text-muted">
                      · {a} {a === 1 ? "email" : "emails"}, {n}{" "}
                      {n === 1 ? "calendar" : "calendars"}
                    </span>
                  );
                })()}
            </p>
            <button
              type="button"
              onClick={() => setManage((m) => !m)}
              aria-expanded={manage}
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-muted hover:bg-surface hover:text-foreground">
              <Settings2 aria-hidden className="h-4 w-4" /> Manage calendars{" "}
              <ChevronDown
                aria-hidden
                className={`h-4 w-4 transition-transform ${manage ? "rotate-180" : ""}`}
              />
            </button>
          </div>
          {manage && (
            <div className="mt-3">
              <ConnectionsPanel
                conns={conns}
                onChanged={reload}
                onError={setError}
              />
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div
          role="group"
          aria-label="Show"
          className="flex rounded-lg border border-border bg-surface/60 p-1 text-sm">
          {(["upcoming", "past"] as const).map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={!win.ranged && tab === t}
              disabled={win.ranged}
              onClick={() => changeTab(t)}
              className={`rounded-md px-4 py-1.5 font-medium capitalize transition-colors ${!win.ranged && tab === t ? "bg-background text-foreground shadow-sm" : "text-muted hover:text-foreground disabled:opacity-60"}`}>
              {t}
            </button>
          ))}
        </div>
        <FilterPopover
          filters={filters}
          onChange={(f) => {
            setFilters(f);
            setSelected(null);
            setSteps(1);
          }}
          events={inTab}
          timeZone={timeZone}
        />
        <label className="relative min-w-[12rem] flex-1 sm:max-w-sm">
          <span className="sr-only">Search meetings</span>
          <Search
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
          />
          <input
            type="search"
            value={filters.query}
            onChange={(e) => setFilters({ ...filters, query: e.target.value })}
            placeholder="Search by title, person or place"
            maxLength={100}
            className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm placeholder:text-muted"
          />
        </label>
        <p role="status" className="ml-auto text-sm text-muted">
          {loading
            ? "Loading…"
            : `${shown.length} ${shown.length === 1 ? "meeting" : "meetings"}`}
        </p>
      </div>

      <FilterChips
        filters={filters}
        onChange={(f) => {
          setFilters(f);
          setSelected(null);
          setSteps(1);
        }}
        personName={nameOf}
      />
      {win.ranged && (
        <p className="text-xs text-muted">
          Showing everything from {formatDay(win.from, timeZone)} to{" "}
          {formatDay(new Date(win.to.getTime() - 1), timeZone)}
          {win.clamped ? " (the first 93 days of the range you chose)" : ""},
          past and upcoming.
        </p>
      )}

      {data?.problems.map((p: Agenda["problems"][number]) => (
        <p
          key={p.connectionId}
          role="status"
          className="rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
          {p.reason === "needs_reconnect"
            ? `${p.accountEmail} needs reconnecting, so its events aren't shown.`
            : `${p.accountEmail} could not be reached just now, so some meetings may be missing. Try again in a moment.`}
        </p>
      ))}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="min-w-0 space-y-6">
          {agenda && agenda.key === winKey && agenda.error ? (
            <p
              role="alert"
              className="rounded-xl border border-border px-5 py-6 text-sm text-danger">
              {agenda.error}
            </p>
          ) : loading ? (
            <ul aria-hidden className="space-y-3">
              {[0, 1, 2].map((i) => (
                <li
                  key={i}
                  className="h-20 jb-skel rounded-xl border border-border bg-surface/50"
                />
              ))}
            </ul>
          ) : shown.length === 0 ? (
            <Card>
              {filtersOn ? (
                <EmptyState
                  icon={<Search className="h-5 w-5" />}
                  title="No meetings match"
                  body="Try removing a filter or changing your search."
                  action={
                    <Button onClick={() => setFilters(EMPTY_FILTERS)}>
                      Clear all filters
                    </Button>
                  }
                />
              ) : (
                <EmptyState
                  icon={<CalendarDays className="h-5 w-5" />}
                  title={
                    tab === "upcoming"
                      ? "Nothing coming up"
                      : "No past meetings"
                  }
                  body={
                    data?.connected
                      ? tab === "upcoming"
                        ? "Your calendars have nothing in this period. Bookings made through Jooba appear here too."
                        : "Nothing happened in this period."
                      : "Connect a calendar to see everything in one place. Bookings made through Jooba appear here too."
                  }
                />
              )}
            </Card>
          ) : (
            groups.map((g) => (
              <section key={g.key} aria-label={g.label}>
                <h2 className="mb-2 text-sm font-semibold text-muted">
                  {g.label}
                </h2>
                <ul className="space-y-2">
                  {g.events.map((e) => (
                    <MeetingRow
                      key={e.id}
                      e={e}
                      timeZone={timeZone}
                      selected={selected === e.id}
                      upcoming={isUpcoming(e, now)}
                      onSelect={() => setSelected(e.id)}
                    />
                  ))}
                </ul>
              </section>
            ))
          )}

          {!loading && !win.ranged && steps < MAX_STEPS && (
            <div className="text-center">
              <Button onClick={() => setSteps((s) => s + 1)}>
                {tab === "upcoming"
                  ? `Show another ${STEP_DAYS} days ahead`
                  : `Show another ${STEP_DAYS} days back`}
              </Button>
            </div>
          )}
          {!loading && !win.ranged && steps >= MAX_STEPS && (
            <p className="text-center text-sm text-muted">
              That&rsquo;s as far as {tab === "upcoming" ? "ahead" : "back"}{" "}
              this list goes. Use a date range under Filters to look elsewhere.
            </p>
          )}
          <p className="text-xs text-muted">
            Times shown in {timeZone.replace(/_/g, " ")} ({zoneLabel(timeZone)}
            ). Read-only: change events in your calendar app.
          </p>
        </div>

        <MeetingDetail
          event={picked}
          timeZone={timeZone}
          upcoming={picked ? isUpcoming(picked, now) : false}
        />
      </div>
    </div>
  );
}

function MeetingRow({
  e,
  timeZone,
  selected,
  upcoming,
  onSelect,
}: {
  e: AgendaEvent;
  timeZone: string;
  selected: boolean;
  upcoming: boolean;
  onSelect: () => void;
}) {
  const others = e.attendees.filter((a) => !a.self);
  const rec = recordingOf(e);
  const st = e.capture
    ? captureStatus({
        source: "meeting_url",
        state: "",
        status: e.capture.status,
      })
    : null;
  const platform = platformOf(e);
  return (
    <li
      className={`flex items-stretch overflow-hidden rounded-xl border transition-colors ${selected ? "border-accent bg-accent/5 ring-1 ring-accent/30" : "border-border hover:bg-surface"}`}>
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className="flex min-w-0 flex-1 items-center gap-4 px-4 py-3 text-left">
        <span
          aria-hidden
          className="h-10 w-1 shrink-0 rounded-full"
          style={{ background: e.calendarColor ?? "var(--accent)" }}
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{e.title}</span>
          <span className="mt-0.5 block truncate text-sm text-muted">
            {e.allDay
              ? "All day"
              : `${formatTime(e.start, timeZone)} to ${formatTime(e.end, timeZone)}`}
            {!e.allDay && ` · ${minutesText(durationMin(e))}`}
            {e.calendarName && ` · ${e.calendarName}`}
          </span>
          <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {e.source === "booking" && <Badge tone="info">Booking</Badge>}
            {st && rec !== "not_recorded" && (
              <Badge tone={st.tone} active={st.active} indicator={st.indicator}>
                {rec === "recorded" ? "Recorded" : st.label}
              </Badge>
            )}
            {platform !== "none" && (
              <span className="rounded-full bg-surface px-2 py-0.5 text-xs text-muted ring-1 ring-inset ring-border">
                {PLATFORM_LABEL[platform]}
              </span>
            )}
            {!e.organizerSelf && (
              <span className="rounded-full bg-surface px-2 py-0.5 text-xs text-muted ring-1 ring-inset ring-border">
                Invited
              </span>
            )}
          </span>
        </span>
        {others.length > 0 && (
          <span
            className="hidden shrink-0 items-center sm:flex"
            title={others.map((a) => a.name ?? a.email).join(", ")}>
            {others.slice(0, 3).map((a, i) => (
              <span
                key={a.email}
                aria-hidden
                className={`grid h-8 w-8 place-items-center rounded-full border-2 border-background bg-accent/15 text-xs font-semibold text-accent ${i > 0 ? "-ml-2" : ""}`}>
                {initials(a.name, a.email)}
              </span>
            ))}
            {others.length > 3 && (
              <span
                aria-hidden
                className="-ml-2 grid h-8 min-w-8 place-items-center rounded-full border-2 border-background bg-surface px-1 text-xs text-muted">
                +{others.length - 3}
              </span>
            )}
            <span className="sr-only">
              {others.length}{" "}
              {others.length === 1 ? "participant" : "participants"}
            </span>
          </span>
        )}
      </button>
      {upcoming && e.joinUrl && (
        <a
          href={e.joinUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Join ${e.title}`}
          className="flex w-14 shrink-0 items-center justify-center border-l border-border text-muted transition-colors hover:bg-accent-solid hover:text-on-accent">
          <Video aria-hidden className="h-5 w-5" />
        </a>
      )}
    </li>
  );
}

const RESPONSE: Record<
  string,
  { label: string; tone: "success" | "warning" | "danger" | "neutral" }
> = {
  accepted: { label: "Going", tone: "success" },
  tentative: { label: "Maybe", tone: "warning" },
  declined: { label: "Declined", tone: "danger" },
  pending: { label: "No reply", tone: "neutral" },
};

function MeetingDetail({
  event,
  timeZone,
  upcoming,
}: {
  event: AgendaEvent | null;
  timeZone: string;
  upcoming: boolean;
}) {
  return (
    <Card className="h-fit min-w-0 lg:sticky lg:top-20">
      <CardHeader title="Meeting details" />
      {!event ? (
        <p className="px-5 py-8 text-sm text-muted">
          Choose a meeting to see who is invited, where it is and whether it is
          being recorded.
        </p>
      ) : (
        <div className="space-y-5 px-5 py-4 text-sm">
          <div>
            <p className="text-lg font-semibold leading-snug">{event.title}</p>
            <p className="mt-1 text-muted">
              {event.allDay
                ? `${formatDay(event.start, timeZone)}, all day`
                : `${formatDay(event.start, timeZone)}, ${formatTime(event.start, timeZone)} to ${formatTime(event.end, timeZone)}`}
              {!event.allDay && ` (${minutesText(durationMin(event))})`}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {event.source === "booking" && <Badge tone="info">Booking</Badge>}
              <Badge tone={event.organizerSelf ? "neutral" : "info"}>
                {event.organizerSelf ? "Hosted by you" : "Invited"}
              </Badge>
              <Badge tone={upcoming ? "success" : "neutral"}>
                {upcoming ? "Upcoming" : "Past"}
              </Badge>
            </div>
          </div>

          {event.joinUrl && upcoming && (
            <a
              href={event.joinUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-9 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-accent-solid px-4 text-sm font-medium text-on-accent transition-colors hover:brightness-95 active:brightness-90 disabled:pointer-events-none disabled:opacity-50 w-full">
              <Video aria-hidden className="h-4 w-4" /> Join{" "}
              {PLATFORM_LABEL[platformOf(event)]}
            </a>
          )}

          <dl className="space-y-3">
            <div>
              <dt className="text-xs text-muted">Calendar</dt>
              <dd>
                {event.calendarName}
                {event.accountEmail ? ` · ${event.accountEmail}` : ""}
              </dd>
            </div>
            {event.location && (
              <div>
                <dt className="text-xs text-muted">Where</dt>
                <dd className="break-words">{event.location}</dd>
              </div>
            )}
            {event.joinUrl && (
              <div>
                <dt className="text-xs text-muted">Video link</dt>
                <dd>
                  <a
                    href={event.joinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-start gap-1 break-all text-accent hover:underline">
                    {event.joinUrl}
                    <ExternalLink
                      aria-hidden
                      className="mt-0.5 h-3 w-3 shrink-0"
                    />
                  </a>
                </dd>
              </div>
            )}
          </dl>

          <div>
            <h3 className="text-xs font-medium text-muted">
              Participants ({event.attendees.length})
            </h3>
            {event.attendees.length === 0 ? (
              <p className="mt-1 text-muted">
                This event has no invited participants.
              </p>
            ) : (
              <ul className="mt-2 space-y-2">
                {event.attendees.map((a) => {
                  const r = a.status ? RESPONSE[a.status] : null;
                  return (
                    <li key={a.email} className="flex items-center gap-3">
                      <span
                        aria-hidden
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent/15 text-xs font-semibold text-accent">
                        {initials(a.name, a.email)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">
                          {a.name ?? a.email}
                          {a.self && (
                            <span className="font-normal text-muted">
                              {" "}
                              (you)
                            </span>
                          )}
                        </span>
                        {a.name && (
                          <span className="block truncate text-xs text-muted">
                            {a.email}
                          </span>
                        )}
                      </span>
                      {r && <Badge tone={r.tone}>{r.label}</Badge>}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {event.capture && !upcoming ? (
            <MeetingOutcome
              key={event.capture.id}
              captureId={event.capture.id}
              captureStatus={event.capture.status}
            />
          ) : (
            <div className="rounded-lg border border-border bg-surface px-3 py-3">
              <p className="text-xs font-medium text-muted">Recording</p>
              {event.capture ? (
                <p className="mt-1">
                  {RECORDING_LABEL[recordingOf(event)]}.{" "}
                  <Link
                    href={`/dashboard/captures/${event.capture.id}`}
                    className="font-medium text-accent hover:underline">
                    Open the conversation
                  </Link>
                </p>
              ) : event.joinUrl && upcoming ? (
                <div className="mt-1 space-y-1">
                  <p className="text-muted">
                    Not being recorded. Nothing is captured unless you choose
                    it.
                  </p>
                  <Link
                    href={`/dashboard/capture?link=${encodeURIComponent(event.joinUrl)}`}
                    className="font-medium text-accent hover:underline">
                    Send the meeting assistant…
                  </Link>
                </div>
              ) : (
                <div className="mt-1 space-y-1">
                  <p className="text-muted">
                    {event.joinUrl
                      ? "This meeting wasn't recorded, so there's no transcript or summary."
                      : "No video link, so there is nothing for the assistant to join."}
                  </p>
                  {!upcoming && (
                    <Link
                      href="/dashboard/voice"
                      className="font-medium text-accent hover:underline">
                      Upload audio from this meeting
                    </Link>
                  )}
                </div>
              )}
            </div>
          )}

          {event.bookingId && (
            <p>
              <Link
                href="/dashboard/booking"
                className="font-medium text-accent hover:underline">
                Manage this booking
              </Link>
            </p>
          )}
        </div>
      )}
    </Card>
  );
}
