"use client";

import { CalendarClock, Video } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Confirm, ErrorBox } from "@/components/booking/form-bits";
import { SlotPicker } from "@/components/booking/slot-picker";
import { useProfile } from "@/components/shell/profile-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { type HostBooking, type Slot, cancelBookingAsHost, hostSlots, listBookings, rescheduleBookingAsHost } from "@/lib/booking-client";
import { browserTimeZone, formatDateTime, formatTime } from "@/lib/tz";

type Scope = "upcoming" | "past";

export function BookingsTab() {
  const profile = useProfile();
  const timeZone = profile?.timezone || browserTimeZone();
  const [scope, setScope] = useState<Scope>("upcoming");
  const [rows, setRows] = useState<{ scope: Scope; items: HostBooking[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [confirm, setConfirm] = useState<HostBooking | null>(null);
  const [moving, setMoving] = useState<HostBooking | null>(null);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listBookings(scope).then(
      (items) => !cancelled && setRows({ scope, items }),
      (err) => !cancelled && setError(err instanceof Error ? err.message : "Could not load bookings."),
    );
    return () => {
      cancelled = true;
    };
  }, [scope, tick]);
  const items = rows && rows.scope === scope ? rows.items : null;
  const reload = () => setTick((n) => n + 1);

  async function cancel() {
    if (!confirm) return;
    setBusy(true);
    setError(null);
    try {
      await cancelBookingAsHost(confirm.id);
      setConfirm(null);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not cancel.");
    }
    setBusy(false);
  }
  async function move() {
    if (!moving || !slot) return;
    setBusy(true);
    setError(null);
    try {
      await rescheduleBookingAsHost(moving.id, slot.start);
      setMoving(null);
      setSlot(null);
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not move the booking.");
      setSlot(null);
    }
    setBusy(false);
  }
  const loadSlots = useCallback((from: string, days: number) => hostSlots(moving!.id, from, days), [moving]);

  return (
    <div className="space-y-4">
      <div className="flex gap-1" role="group" aria-label="Show">
        {(["upcoming", "past"] as const).map((s) => (
          <button key={s} type="button" aria-pressed={scope === s} onClick={() => setScope(s)} className={`rounded-lg px-3 py-1.5 text-sm ${scope === s ? "bg-surface font-medium" : "text-muted hover:text-foreground"}`}>{s === "upcoming" ? "Upcoming" : "Past and cancelled"}</button>
        ))}
      </div>
      <ErrorBox message={error} />
      {confirm && <Confirm title={`Cancel the booking with ${confirm.guestName}?`} text="The time is given back and the booking is removed from your calendar. Their link will show it as cancelled. They are not emailed (email isn't set up), so let them know yourself." action="Cancel booking" busy={busy} onConfirm={() => void cancel()} onCancel={() => setConfirm(null)} />}

      {moving && (
        <Card>
          <div className="space-y-4 p-5">
            <p className="font-medium">Move {moving.guestName}&apos;s booking</p>
            <p className="text-sm text-muted">Now: {formatDateTime(moving.startAt, timeZone)}. Times are shown in your time zone ({timeZone.replace(/_/g, " ")}).</p>
            <SlotPicker load={loadSlots} timeZone={timeZone} selected={slot?.start ?? null} onPick={setSlot} />
            {slot && <p className="text-sm">New time: <span className="font-medium">{formatDateTime(slot.start, timeZone)}</span></p>}
            <div className="flex gap-2">
              <Button variant="primary" disabled={!slot || busy} onClick={() => void move()}>{busy ? "Checking availability…" : "Move booking"}</Button>
              <Button variant="ghost" disabled={busy} onClick={() => { setMoving(null); setSlot(null); }}>Back</Button>
            </div>
            <p className="text-xs text-muted">The guest is not emailed (email isn&apos;t set up). Their link shows the new time.</p>
          </div>
        </Card>
      )}

      <Card>
        {items === null ? (
          <ul aria-hidden className="divide-y divide-border">{[0, 1, 2].map((i) => <li key={i} className="px-5 py-4"><div className="h-4 w-1/2 animate-pulse rounded bg-border" /></li>)}</ul>
        ) : items.length === 0 ? (
          <EmptyState icon={<CalendarClock className="h-5 w-5" />} title={scope === "upcoming" ? "No upcoming bookings" : "Nothing here yet"} body={scope === "upcoming" ? "When someone books through one of your pages, it appears here. Set up a page, meeting type and your hours in the other tabs." : "Past and cancelled bookings are kept here."} />
        ) : (
          <ul className="divide-y divide-border">
            {items.map((b) => (
              <li key={b.id} className="space-y-2 px-5 py-4 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className={`font-medium ${b.status === "cancelled" ? "line-through" : ""}`}>{b.meetingName} with {b.guestName}</p>
                    <p className="text-muted">{formatDateTime(b.startAt, timeZone)} to {formatTime(b.endAt, timeZone)} · {b.durationMin} min</p>
                    <p className="text-xs text-muted">{b.guestEmail} · guest&apos;s time zone {b.guestTimezone.replace(/_/g, " ")}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={b.status === "confirmed" ? "success" : "neutral"}>{b.status === "confirmed" ? "Confirmed" : `Cancelled${b.cancelledBy ? ` by ${b.cancelledBy}` : ""}`}</Badge>
                    {b.rescheduled && b.status === "confirmed" && <Badge tone="info">Rescheduled</Badge>}
                  </div>
                </div>
                {b.guestNote && <p className="rounded-lg bg-surface px-3 py-2 text-muted">&ldquo;{b.guestNote}&rdquo;</p>}
                <ul className="space-y-1 text-xs text-muted">
                  {b.status === "confirmed" && b.emailStatus === "not_configured" && <li>The guest was not emailed (email isn&apos;t set up). They have a link to manage the booking.</li>}
                  {b.status === "confirmed" && b.calendarStatus === "failed" && <li className="text-warning">Could not be added to your calendar. The booking itself is confirmed.</li>}
                  {b.status === "confirmed" && b.calendarStatus === "created" && <li>Added to your calendar.</li>}
                  {b.captureId && <li className="flex items-center gap-1.5"><Video aria-hidden className="h-3.5 w-3.5" /> The Mojooba Assistant is scheduled to join. <Link href={`/captures/${b.captureId}`} className="font-medium text-accent hover:underline">View</Link></li>}
                </ul>
                {b.status === "confirmed" && new Date(b.startAt) > new Date() && (
                  <div className="flex gap-2 pt-1">
                    <Button variant="secondary" onClick={() => { setMoving(b); setSlot(null); setConfirm(null); setError(null); }}>Reschedule</Button>
                    <Button variant="ghost" onClick={() => { setConfirm(b); setMoving(null); setError(null); }}>Cancel</Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
