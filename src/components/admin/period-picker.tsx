"use client";

import { Calendar, Check, ChevronDown } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useDismiss } from "@/components/ui/use-dismiss";
import { type Period, type PeriodKey, PERIOD_LABEL, periodTitle, today, validDay } from "@/lib/admin-period";
import { inputClass } from "./ui";

const OPTIONS: Array<Exclude<PeriodKey, "range">> = ["day", "week", "month", "all"];
const field = `mt-1 ${inputClass}`;

/**
 * A small filter button: pick Today, Last 7 days, Last 30 days, All time, or your own dates. The picked window is the
 * caller's to keep (this app keeps it in the page address). A date range needs a start and an end, start first, none in the future.
 */
export function PeriodPicker({ period, onChange }: { period: Period; onChange: (p: Period) => void }) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState(period.key === "range");
  const [from, setFrom] = useState(period.from ?? "");
  const [to, setTo] = useState(period.to ?? "");
  const btn = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const id = useId();
  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, close, panel, btn);
  useEffect(() => { if (open) panel.current?.querySelector<HTMLElement>('[aria-checked="true"], button')?.focus(); }, [open]);

  const now = new Date();
  const ok = validDay(from, now) && validDay(to, now) && from <= to;
  const err = from && to && !ok ? (from > to ? "The start comes after the end." : "Dates can’t be in the future.") : null;

  function pick(key: Exclude<PeriodKey, "range">) {
    onChange({ key });
    setCustom(false);
    setOpen(false);
  }

  const row = "flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm outline-none transition-colors hover:bg-surface focus-visible:bg-surface";
  return (
    <div className="relative">
      <Button ref={btn} size="sm" aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? id : undefined} onClick={() => setOpen((o) => !o)}>
        <Calendar aria-hidden className="size-4" /> {periodTitle(period, now)} <ChevronDown aria-hidden className="size-4" />
      </Button>
      {open && (
        <div ref={panel} id={id} role="dialog" aria-label="Choose a time period" className="absolute right-0 top-full z-30 mt-2 w-64 max-w-[85vw] overflow-hidden rounded-xl border border-border bg-background py-1 shadow-xl">
          <div role="radiogroup" aria-label="Time period">
            {OPTIONS.map((k) => (
              <button key={k} type="button" role="radio" aria-checked={period.key === k} onClick={() => pick(k)} className={row}>
                {PERIOD_LABEL[k]}{period.key === k && <Check aria-hidden className="size-4 text-accent" />}
              </button>
            ))}
            <button type="button" role="radio" aria-checked={period.key === "range"} onClick={() => setCustom(true)} className={row}>
              Date range…{period.key === "range" && <Check aria-hidden className="size-4 text-accent" />}
            </button>
          </div>
          {custom && (
            <form
              onSubmit={(e) => { e.preventDefault(); if (ok) { onChange({ key: "range", from, to }); setOpen(false); } }}
              className="space-y-3 border-t border-border p-3"
            >
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-xs text-muted">From<input type="date" value={from} max={today(now)} onChange={(e) => setFrom(e.target.value)} className={field} /></label>
                <label className="block text-xs text-muted">To<input type="date" value={to} max={today(now)} onChange={(e) => setTo(e.target.value)} className={field} /></label>
              </div>
              {err && <p role="alert" className="text-xs text-danger">{err}</p>}
              <Button type="submit" variant="primary" size="sm" className="w-full" disabled={!ok}>Apply</Button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
