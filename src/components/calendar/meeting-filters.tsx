"use client";

import { CalendarDays, Clock, Eye, Filter, Search, UserCheck, Users, Video, X } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useDismiss } from "@/components/ui/use-dismiss";
import type { AgendaEvent } from "@/lib/calendar-client";
import {
  DURATION_LABEL, type DurationBucket, EMPTY_FILTERS, type MeetingFilters, PLATFORM_LABEL, type Platform, RECORDING_LABEL, type RecordingState,
  ROLE_LABEL, type Role, activeCount, durationBucket, durationMin, participantList, platformOf, recordingOf,
} from "@/lib/meetings";
import { addDays, todayIn } from "@/lib/tz";

type Category = "participants" | "date" | "duration" | "calendar" | "platform" | "recording" | "role";

const CATEGORIES: ReadonlyArray<{ id: Category; label: string; Icon: typeof Users }> = [
  { id: "participants", label: "Participants", Icon: Users },
  { id: "date", label: "Date range", Icon: CalendarDays },
  { id: "duration", label: "Duration", Icon: Clock },
  { id: "calendar", label: "Calendar", Icon: CalendarDays },
  { id: "platform", label: "Platform", Icon: Video },
  { id: "recording", label: "Recording", Icon: Eye },
  { id: "role", label: "Role", Icon: UserCheck },
];

const initials = (name: string | null, email: string) => ((name?.trim() || email)[0] ?? "?").toUpperCase();
const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

function countFor(f: MeetingFilters, c: Category): number {
  switch (c) {
    case "participants": return f.participants.length;
    case "date": return f.from || f.to ? 1 : 0;
    case "duration": return f.durations.length;
    case "calendar": return f.calendars.length;
    case "platform": return f.platforms.length;
    case "recording": return f.recording.length;
    case "role": return f.roles.length;
  }
}

function CheckRow({ checked, onChange, children, count }: { checked: boolean; onChange: () => void; children: React.ReactNode; count?: number }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-surface">
      <input type="checkbox" checked={checked} onChange={onChange} className="h-4 w-4 shrink-0 accent-[var(--accent-solid)]" />
      <span className="min-w-0 flex-1">{children}</span>
      {count !== undefined && <span className="text-xs tabular-nums text-muted">{count}</span>}
    </label>
  );
}

/** The detailed filters, as one popover: categories on the left, the choices for the selected one on the right. */
export function FilterPopover({ filters, onChange, events, timeZone }: { filters: MeetingFilters; onChange: (f: MeetingFilters) => void; events: AgendaEvent[]; timeZone: string }) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<Category>("participants");
  const [pq, setPq] = useState("");
  const panel = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, close, panel, trigger);
  // Keep the popover on screen: if it would run off the right edge, slide it left by the overflow.
  useEffect(() => {
    const el = panel.current, t = trigger.current;
    if (!open || !el || !t) return;
    const over = t.getBoundingClientRect().left + el.offsetWidth - (window.innerWidth - 16);
    el.style.transform = over > 0 ? `translateX(-${Math.ceil(over)}px)` : "";
  }, [open]);
  const id = useId();
  // The search box lives in the toolbar, so it isn't counted on this button.
  const active = activeCount({ ...filters, query: "" });
  const set = (patch: Partial<MeetingFilters>) => onChange({ ...filters, ...patch });

  const people = useMemo(() => participantList(events), [events]);
  const shownPeople = people.filter((p) => !pq.trim() || `${p.name ?? ""} ${p.email}`.toLowerCase().includes(pq.trim().toLowerCase()));
  const calendars = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of events) m.set(e.calendarName ?? "", (m.get(e.calendarName ?? "") ?? 0) + 1);
    return [...m.entries()].filter(([name]) => name).sort((a, b) => a[0].localeCompare(b[0]));
  }, [events]);
  const countBy = <T extends string>(of: (e: AgendaEvent) => T) => {
    const m = new Map<T, number>();
    for (const e of events) m.set(of(e), (m.get(of(e)) ?? 0) + 1);
    return m;
  };
  const platformCounts = useMemo(() => countBy(platformOf), [events]); // eslint-disable-line react-hooks/exhaustive-deps
  const recordingCounts = useMemo(() => countBy(recordingOf), [events]); // eslint-disable-line react-hooks/exhaustive-deps
  const durationCounts = useMemo(() => countBy((e) => (e.allDay ? ("none" as DurationBucket) : durationBucket(durationMin(e)))), [events]); // eslint-disable-line react-hooks/exhaustive-deps

  const today = todayIn(timeZone);
  const presets: Array<{ label: string; from: string; to: string }> = [
    { label: "Today", from: today, to: today },
    { label: "Next 7 days", from: today, to: addDays(today, 6) },
    { label: "Next 30 days", from: today, to: addDays(today, 29) },
    { label: "Last 7 days", from: addDays(today, -7), to: addDays(today, -1) },
    { label: "Last 30 days", from: addDays(today, -30), to: addDays(today, -1) },
  ];

  return (
    <div className="relative">
      <button
        ref={trigger}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${active > 0 || open ? "border-accent bg-accent/10 text-accent" : "border-border hover:bg-surface"}`}
      >
        <Filter aria-hidden className="h-4 w-4" /> Filters{active > 0 && <span className="rounded-full bg-accent px-1.5 text-xs text-background">{active}</span>}
      </button>
      {open && (
        <div ref={panel} id={id} role="dialog" aria-label="Filter meetings" className="absolute left-0 top-12 z-40 flex w-[40rem] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-xl border border-border bg-background shadow-xl sm:flex-row">
          <div className="flex shrink-0 flex-row gap-1 overflow-x-auto border-b border-border p-2 sm:w-52 sm:flex-col sm:overflow-visible sm:border-b-0 sm:border-r">
            {CATEGORIES.map(({ id: c, label, Icon }) => {
              const n = countFor(filters, c);
              return (
                <button key={c} type="button" onClick={() => setCategory(c)} aria-pressed={category === c} className={`flex items-center gap-3 whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm transition-colors ${category === c ? "bg-accent/10 font-medium text-accent" : "text-muted hover:bg-surface hover:text-foreground"}`}>
                  <Icon aria-hidden className="h-4 w-4 shrink-0" />
                  <span className="flex-1">{label}</span>
                  {n > 0 && <span className="rounded-full bg-accent px-1.5 text-xs text-background">{n}</span>}
                </button>
              );
            })}
            <button type="button" disabled={active === 0} onClick={() => onChange({ ...EMPTY_FILTERS, query: filters.query })} className="mt-1 hidden rounded-lg border border-border px-3 py-2 text-sm text-muted transition-colors hover:bg-surface disabled:opacity-50 sm:mt-auto sm:block">
              Clear all filters
            </button>
          </div>

          <div className="min-h-[18rem] min-w-0 flex-1 p-3">
            {category === "participants" && (
              <div className="flex h-full flex-col gap-2">
                <div className="flex items-center gap-2">
                  <label className="relative flex-1">
                    <span className="sr-only">Search participant</span>
                    <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                    <input value={pq} onChange={(e) => setPq(e.target.value)} placeholder="Search participant" className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm" />
                  </label>
                  <button type="button" disabled={filters.participants.length === 0} onClick={() => set({ participants: [] })} className="text-sm text-muted hover:text-foreground disabled:opacity-50">Clear</button>
                </div>
                <ul className="max-h-72 flex-1 overflow-y-auto">
                  {shownPeople.length === 0 && <li className="px-3 py-6 text-sm text-muted">{people.length === 0 ? "No one else was invited to the meetings shown." : "No one matches that."}</li>}
                  {shownPeople.map((p) => (
                    <li key={p.email}>
                      <CheckRow checked={filters.participants.includes(p.email)} onChange={() => set({ participants: toggle(filters.participants, p.email) })} count={p.meetings}>
                        <span className="flex items-center gap-3">
                          <span aria-hidden className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent/15 text-xs font-semibold text-accent">{initials(p.name, p.email)}</span>
                          <span className="min-w-0">
                            <span className="block truncate font-medium">{p.name ?? p.email}</span>
                            {p.name && <span className="block truncate text-xs text-muted">{p.email}</span>}
                          </span>
                        </span>
                      </CheckRow>
                    </li>
                  ))}
                </ul>
                <p className="px-1 text-xs text-muted">People from the meetings currently loaded. Choosing several shows meetings with any of them.</p>
              </div>
            )}

            {category === "date" && (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {presets.map((p) => (
                    <button key={p.label} type="button" onClick={() => set({ from: p.from, to: p.to })} className={`rounded-full border px-3 py-1 text-xs ${filters.from === p.from && filters.to === p.to ? "border-accent bg-accent/10 font-medium text-accent" : "border-border text-muted hover:bg-surface"}`}>{p.label}</button>
                  ))}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-sm"><span className="text-muted">From</span><input type="date" value={filters.from ?? ""} onChange={(e) => set({ from: e.target.value || null })} className="mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2" /></label>
                  <label className="block text-sm"><span className="text-muted">To</span><input type="date" value={filters.to ?? ""} onChange={(e) => set({ to: e.target.value || null })} className="mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2" /></label>
                </div>
                <p className="text-xs text-muted">With a date range, the list shows everything in it, past and upcoming, up to 93 days at a time. Days are in {timeZone.replace(/_/g, " ")}.</p>
                <button type="button" disabled={!filters.from && !filters.to} onClick={() => set({ from: null, to: null })} className="text-sm text-muted hover:text-foreground disabled:opacity-50">Clear dates</button>
              </div>
            )}

            {category === "duration" && (
              <ul>
                {(Object.keys(DURATION_LABEL) as DurationBucket[]).map((d) => (
                  <li key={d}><CheckRow checked={filters.durations.includes(d)} onChange={() => set({ durations: toggle(filters.durations, d) })} count={durationCounts.get(d) ?? 0}>{DURATION_LABEL[d]}</CheckRow></li>
                ))}
                <li className="px-3 pt-2 text-xs text-muted">All-day events are left out when a duration is chosen.</li>
              </ul>
            )}

            {category === "calendar" && (
              <ul>
                {calendars.length === 0 && <li className="px-3 py-6 text-sm text-muted">No calendars in the meetings shown.</li>}
                {calendars.map(([name, n]) => (
                  <li key={name}><CheckRow checked={filters.calendars.includes(name)} onChange={() => set({ calendars: toggle(filters.calendars, name) })} count={n}>{name}</CheckRow></li>
                ))}
              </ul>
            )}

            {category === "platform" && (
              <ul>
                {(Object.keys(PLATFORM_LABEL) as Platform[]).map((p) => (
                  <li key={p}><CheckRow checked={filters.platforms.includes(p)} onChange={() => set({ platforms: toggle(filters.platforms, p) })} count={platformCounts.get(p) ?? 0}>{PLATFORM_LABEL[p]}</CheckRow></li>
                ))}
              </ul>
            )}

            {category === "recording" && (
              <ul>
                {(Object.keys(RECORDING_LABEL) as RecordingState[]).map((r) => (
                  <li key={r}><CheckRow checked={filters.recording.includes(r)} onChange={() => set({ recording: toggle(filters.recording, r) })} count={recordingCounts.get(r) ?? 0}>{RECORDING_LABEL[r]}</CheckRow></li>
                ))}
                <li className="px-3 pt-2 text-xs text-muted">Only meetings where you sent the assistant, or a guest agreed to recording, are ever recorded.</li>
              </ul>
            )}

            {category === "role" && (
              <ul>
                {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
                  <li key={r}><CheckRow checked={filters.roles.includes(r)} onChange={() => set({ roles: toggle(filters.roles, r) })}>{ROLE_LABEL[r]}</CheckRow></li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** One removable chip per active filter, shown under the toolbar. */
export function FilterChips({ filters, onChange, personName }: { filters: MeetingFilters; onChange: (f: MeetingFilters) => void; personName: (email: string) => string }) {
  const chips: Array<{ key: string; label: string; clear: () => void }> = [];
  const f = filters;
  if (f.participants.length) chips.push({ key: "p", label: f.participants.length === 1 ? personName(f.participants[0]) : `${f.participants.length} participants`, clear: () => onChange({ ...f, participants: [] }) });
  if (f.from || f.to) chips.push({ key: "d", label: f.from && f.to ? (f.from === f.to ? f.from : `${f.from} to ${f.to}`) : f.from ? `From ${f.from}` : `Until ${f.to}`, clear: () => onChange({ ...f, from: null, to: null }) });
  if (f.durations.length) chips.push({ key: "u", label: f.durations.map((d) => DURATION_LABEL[d]).join(", "), clear: () => onChange({ ...f, durations: [] }) });
  if (f.calendars.length) chips.push({ key: "c", label: f.calendars.join(", "), clear: () => onChange({ ...f, calendars: [] }) });
  if (f.platforms.length) chips.push({ key: "l", label: f.platforms.map((p) => PLATFORM_LABEL[p]).join(", "), clear: () => onChange({ ...f, platforms: [] }) });
  if (f.recording.length) chips.push({ key: "r", label: f.recording.map((r) => RECORDING_LABEL[r]).join(", "), clear: () => onChange({ ...f, recording: [] }) });
  if (f.roles.length) chips.push({ key: "o", label: f.roles.map((r) => ROLE_LABEL[r]).join(", "), clear: () => onChange({ ...f, roles: [] }) });
  if (chips.length === 0) return null;
  return (
    <ul className="flex flex-wrap items-center gap-2" aria-label="Active filters">
      {chips.map((c) => (
        <li key={c.key} className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-surface py-1 pl-3 pr-1.5 text-xs">
          <span className="truncate">{c.label}</span>
          <button type="button" onClick={c.clear} aria-label={`Remove filter: ${c.label}`} className="grid h-5 w-5 place-items-center rounded-full text-muted hover:bg-border hover:text-foreground"><X aria-hidden className="h-3 w-3" /></button>
        </li>
      ))}
      <li><button type="button" onClick={() => onChange({ ...EMPTY_FILTERS, query: f.query })} className="text-xs text-muted underline-offset-2 hover:text-foreground hover:underline">Clear all</button></li>
    </ul>
  );
}
