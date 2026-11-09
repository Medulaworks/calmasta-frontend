"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { Slot, SlotsResponse } from "@/lib/booking-client";
import { addDays, dayKey, formatDay, formatTime, todayIn } from "@/lib/tz";

const WINDOW_DAYS = 14;
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

/**
 * Pick a day, then a time. Times arrive as exact instants and are shown in `timeZone` (the viewer's), grouped by the
 * date they fall on THERE. `load` is asked for 14 days at a time starting from a date in that same zone.
 */
export function SlotPicker({ load, timeZone, selected, onPick, split = false }: { load: (from: string, days: number) => Promise<SlotsResponse>; timeZone: string; selected: string | null; onPick: (slot: Slot) => void; split?: boolean }) {
  const today = todayIn(timeZone);
  const [from, setFrom] = useState(today);
  // The latest answer, tagged with the request it answers. Anything tagged with an older request counts as "loading".
  const [res, setRes] = useState<{ load: typeof load; from: string; tz: string; slots?: Slot[]; error?: string } | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const current = res && res.load === load && res.from === from && res.tz === timeZone ? res : null;
  const slots = current?.slots ?? null;
  const error = current?.error ?? null;

  useEffect(() => {
    let cancelled = false;
    load(from, WINDOW_DAYS).then(
      (r) => {
        if (cancelled) return;
        setRes({ load, from, tz: timeZone, slots: r.slots });
        const first = r.slots[0] ? dayKey(r.slots[0].start, timeZone) : null;
        setDay((d) => (d && r.slots.some((s) => dayKey(s.start, timeZone) === d) ? d : first));
      },
      (err) => !cancelled && setRes({ load, from, tz: timeZone, error: err instanceof Error ? err.message : "Could not load times." }),
    );
    return () => {
      cancelled = true;
    };
  }, [from, timeZone, load]);

  const byDay = useMemo(() => {
    const m = new Map<string, Slot[]>();
    for (const s of slots ?? []) {
      const k = dayKey(s.start, timeZone);
      m.set(k, [...(m.get(k) ?? []), s]);
    }
    return m;
  }, [slots, timeZone]);
  const days = Array.from({ length: WINDOW_DAYS }, (_, i) => addDays(from, i));

  if (error) {
    return <p role="alert" className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>;
  }

  // The two-week window drawn as a calendar: weekday headings, and the first row padded so each date sits under its weekday.
  const lead = (new Date(`${from}T00:00:00Z`).getUTCDay() + 6) % 7;
  const cells: (string | null)[] = [...Array<null>(lead).fill(null), ...days];
  while (cells.length % 7) cells.push(null);
  const fmt = (d: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(undefined, { timeZone: "UTC", ...o }).format(new Date(`${d}T00:00:00Z`));
  const rangeLabel = `${fmt(days[0], { day: "numeric", month: "short" })} to ${fmt(days[days.length - 1], { day: "numeric", month: "short", year: "numeric" })}`;
  const times = day ? byDay.get(day) : undefined;

  return (
    <div className={split ? "grid gap-5 md:grid-cols-[1fr_11rem]" : "space-y-5"}>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold">{rangeLabel}</p>
          <div className="flex gap-2">
            <button type="button" aria-label="Earlier days" disabled={from <= today} onClick={() => setFrom(addDays(from, -WINDOW_DAYS) < today ? today : addDays(from, -WINDOW_DAYS))} className="grid size-9 place-items-center rounded-lg border border-border transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"><ChevronLeft aria-hidden className="size-4" /></button>
            <button type="button" aria-label="Later days" onClick={() => setFrom(addDays(from, WINDOW_DAYS))} className="grid size-9 place-items-center rounded-lg border border-border transition-colors hover:bg-surface"><ChevronRight aria-hidden className="size-4" /></button>
          </div>
        </div>

        {slots === null ? (
          <div aria-hidden className="space-y-2">{[0, 1].map((r) => <div key={r} className="grid grid-cols-7 gap-2">{[0, 1, 2, 3, 4, 5, 6].map((c) => <span key={c} className="h-10 jb-skel rounded-xl bg-border/60" />)}</div>)}</div>
        ) : slots.length === 0 ? (
          <div role="status" className="rounded-xl border border-border bg-surface px-4 py-6 text-center text-sm">
            <p className="font-medium">No times available in these two weeks</p>
            <p className="mt-1 text-muted">Try the next two weeks, or check back later.</p>
          </div>
        ) : (
          <div role="group" aria-label="Days">
            <div aria-hidden className="mb-2 grid grid-cols-7 gap-2 text-center text-xs font-medium uppercase tracking-wider text-muted">
              {WEEKDAYS.map((w) => <span key={w}>{w}</span>)}
            </div>
            <div className="grid grid-cols-7 gap-2">
              {cells.map((d, i) => {
                if (!d) return <span key={`blank-${i}`} aria-hidden />;
                const n = byDay.get(d)?.length ?? 0;
                const label = fmt(d, { weekday: "long", day: "numeric", month: "long" });
                const chosen = day === d;
                return (
                  <button
                    key={d}
                    type="button"
                    disabled={n === 0}
                    aria-pressed={chosen}
                    aria-label={n ? `${label}, ${n} times` : `${label}, no times`}
                    onClick={() => setDay(d)}
                    className={`relative grid h-10 place-items-center rounded-xl text-sm tabular-nums transition-colors disabled:cursor-not-allowed ${chosen ? "bg-accent-solid font-semibold text-on-accent shadow-sm" : n ? "bg-accent-solid/10 font-medium text-accent hover:bg-accent-solid/20" : "text-muted/50"}`}
                  >
                    {Number(d.slice(8))}
                    {d === today && <span aria-hidden className={`absolute bottom-1 size-1 rounded-full ${chosen ? "bg-on-accent" : "bg-accent-solid"}`} />}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {slots !== null && slots.length > 0 && day && times && (
        <div>
          <p className="mb-3 text-sm font-semibold">{formatDay(times[0].start, timeZone)}</p>
          <div role="group" aria-label="Times" className={split ? "grid max-h-80 gap-2 overflow-y-auto pr-1" : "grid grid-cols-3 gap-2 sm:grid-cols-4"}>
            {times.map((s) => (
              <button key={s.start} type="button" aria-pressed={selected === s.start} onClick={() => onPick(s)} className={`h-10 rounded-xl border text-sm tabular-nums transition-colors ${selected === s.start ? "border-accent-solid bg-accent-solid font-semibold text-on-accent shadow-sm" : "border-accent-solid/30 font-medium text-accent hover:border-accent-solid hover:bg-accent-solid/10"}`}>
                {formatTime(s.start, timeZone)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Zone names the browser knows, with the current one guaranteed to be present. */
export function timeZoneChoices(current: string): string[] {
  const all = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [];
  return all.includes(current) ? all : [current, ...all];
}
