"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { Slot, SlotsResponse } from "@/lib/booking-client";
import { addDays, dayKey, formatDay, formatTime, todayIn } from "@/lib/tz";

const WINDOW_DAYS = 14;

/**
 * Pick a day, then a time. Times arrive as exact instants and are shown in `timeZone` (the viewer's), grouped by the
 * date they fall on THERE. `load` is asked for 14 days at a time starting from a date in that same zone.
 */
export function SlotPicker({ load, timeZone, selected, onPick }: { load: (from: string, days: number) => Promise<SlotsResponse>; timeZone: string; selected: string | null; onPick: (slot: Slot) => void }) {
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
    return <p role="alert" className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>;
  }
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Choose a day</p>
        <div className="flex gap-1">
          <button type="button" aria-label="Earlier days" disabled={from <= today} onClick={() => setFrom(addDays(from, -WINDOW_DAYS) < today ? today : addDays(from, -WINDOW_DAYS))} className="grid h-8 w-8 place-items-center rounded-lg border border-border hover:bg-surface disabled:opacity-40"><ChevronLeft aria-hidden className="h-4 w-4" /></button>
          <button type="button" aria-label="Later days" onClick={() => setFrom(addDays(from, WINDOW_DAYS))} className="grid h-8 w-8 place-items-center rounded-lg border border-border hover:bg-surface"><ChevronRight aria-hidden className="h-4 w-4" /></button>
        </div>
      </div>

      {slots === null ? (
        <div aria-hidden className="grid grid-cols-7 gap-2">{days.map((d) => <span key={d} className="h-14 animate-pulse rounded-lg bg-border/60" />)}</div>
      ) : slots.length === 0 ? (
        <div role="status" className="rounded-lg border border-border bg-surface px-4 py-6 text-center text-sm">
          <p className="font-medium">No times available in these two weeks</p>
          <p className="mt-1 text-muted">Try the next two weeks, or check back later.</p>
        </div>
      ) : (
        <>
          <div role="group" aria-label="Days" className="grid grid-cols-4 gap-2 sm:grid-cols-7">
            {days.map((d) => {
              const n = byDay.get(d)?.length ?? 0;
              const label = new Intl.DateTimeFormat(undefined, { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" }).format(new Date(`${d}T00:00:00Z`));
              return (
                <button
                  key={d}
                  type="button"
                  disabled={n === 0}
                  aria-pressed={day === d}
                  aria-label={n ? `${label}, ${n} times` : `${label}, no times`}
                  onClick={() => setDay(d)}
                  className={`rounded-lg border px-1 py-2 text-center text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${day === d ? "border-accent-solid bg-accent/10 font-medium text-accent" : "border-border hover:bg-surface"}`}
                >
                  <span className="block">{label.split(" ")[0]}</span>
                  <span className="block text-sm">{label.split(" ").slice(1).join(" ")}</span>
                </button>
              );
            })}
          </div>
          {day && byDay.get(day) && (
            <div>
              <p className="mb-2 text-sm font-medium">{formatDay(byDay.get(day)![0].start, timeZone)}</p>
              <div role="group" aria-label="Times" className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {byDay.get(day)!.map((s) => (
                  <button key={s.start} type="button" aria-pressed={selected === s.start} onClick={() => onPick(s)} className={`rounded-lg border px-2 py-2 text-sm transition-colors ${selected === s.start ? "border-accent-solid bg-accent-solid font-medium text-on-accent" : "border-border hover:bg-surface"}`}>
                    {formatTime(s.start, timeZone)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** Zone names the browser knows, with the current one guaranteed to be present. */
export function timeZoneChoices(current: string): string[] {
  const all = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [];
  return all.includes(current) ? all : [current, ...all];
}
