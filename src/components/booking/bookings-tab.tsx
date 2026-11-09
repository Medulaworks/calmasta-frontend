"use client";

import { CalendarClock, CalendarDays, Check, Video } from "lucide-react";
import Link from "next/link";
import { useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Confirm, ErrorBox } from "@/components/booking/form-bits";
import { SlotPicker } from "@/components/booking/slot-picker";
import { useProfile } from "@/components/shell/profile-context";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { type HostBooking, type Slot, hostSlots } from "@/lib/booking-client";
import { useCancelBookingHost, useRescheduleBookingHost } from "@/lib/mutations";
import { bookingsQuery } from "@/lib/queries";
import { browserTimeZone, formatDateTime, formatTime } from "@/lib/tz";

type Scope = "upcoming" | "past";

export function BookingsTab() {
  const profile = useProfile();
  const timeZone = profile?.timezone || browserTimeZone();
  const [scope, setScope] = useState<Scope>("upcoming");
  const bookingsQ = useQuery(bookingsQuery(scope));
  const items = bookingsQ.data ?? null;
  const qError = bookingsQ.error ? (bookingsQ.error as Error).message : null;
  const [localError, setLocalError] = useState<string | null>(null);
  const error = localError ?? qError;
  const [confirm, setConfirm] = useState<HostBooking | null>(null);
  const [moving, setMoving] = useState<HostBooking | null>(null);
  const [slot, setSlot] = useState<Slot | null>(null);
  const cancelM = useCancelBookingHost();
  const moveM = useRescheduleBookingHost();
  const busy = cancelM.isPending || moveM.isPending;

  async function cancel() {
    if (!confirm) return;
    setLocalError(null);
    try {
      await cancelM.mutateAsync(confirm.id);
      setConfirm(null);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Could not cancel.");
    }
  }
  async function move() {
    if (!moving || !slot) return;
    setLocalError(null);
    try {
      await moveM.mutateAsync({ id: moving.id, start: slot.start });
      setMoving(null);
      setSlot(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not move the booking.";
      // slot_conflict -> clear selection and let picker reload on next open
      if (msg.toLowerCase().includes("slot") || msg.toLowerCase().includes("conflict") || msg.toLowerCase().includes("taken")) setSlot(null);
      setLocalError(msg);
    }
  }
  const loadSlots = useCallback(
    (from: string, days: number) => hostSlots(moving!.id, from, days),
    [moving],
  );

  const dayOf = (iso: string) => new Intl.DateTimeFormat(undefined, { timeZone, day: "numeric" }).format(new Date(iso));
  const monthOf = (iso: string) => new Intl.DateTimeFormat(undefined, { timeZone, month: "short" }).format(new Date(iso));
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Show" className="inline-flex rounded-xl bg-surface p-1 ring-1 ring-border">
          {(["upcoming", "past"] as const).map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={scope === s}
              onClick={() => setScope(s)}
              className={`h-9 rounded-lg px-4 text-sm font-medium transition-colors ${scope === s ? "bg-background text-foreground shadow-sm ring-1 ring-border" : "text-muted hover:text-foreground"}`}>
              {s === "upcoming" ? "Upcoming" : "Past and cancelled"}
            </button>
          ))}
        </div>
        <p className="flex items-center gap-2 text-xs text-muted">
          <CalendarDays aria-hidden className="size-4" /> Bookings here also appear in your Calendar.
        </p>
      </div>
      <ErrorBox message={error} />
      {confirm && (
        <Confirm
          title={`Cancel the booking with ${confirm.guestName}?`}
          text="The time is given back and the booking is removed from your calendar. Their link will show it as cancelled. They are not emailed (email isn't set up), so let them know yourself."
          action="Cancel booking"
          busy={busy}
          onConfirm={() => void cancel()}
          onCancel={() => setConfirm(null)}
        />
      )}

      {moving && (
        <Card>
          <div className="space-y-4 p-5">
            <div>
              <p className="text-base font-semibold">Move {moving.guestName}&apos;s booking</p>
              <p className="mt-1 text-sm text-muted">
                Now: {formatDateTime(moving.startAt, timeZone)}. Times are shown in your time zone ({timeZone.replace(/_/g, " ")}).
              </p>
            </div>
            <SlotPicker load={loadSlots} timeZone={timeZone} selected={slot?.start ?? null} onPick={setSlot} />
            {slot && (
              <p className="rounded-xl bg-surface px-4 py-3 text-sm">
                New time: <span className="font-medium">{formatDateTime(slot.start, timeZone)}</span>
              </p>
            )}
            <div className="flex flex-wrap gap-3">
              <Button variant="primary" disabled={!slot || busy} onClick={() => void move()}>
                {busy ? "Checking availability…" : "Move booking"}
              </Button>
              <Button variant="ghost" disabled={busy} onClick={() => { setMoving(null); setSlot(null); }}>Back</Button>
            </div>
            <p className="text-xs text-muted">The guest is not emailed (email isn&apos;t set up). Their link shows the new time.</p>
          </div>
        </Card>
      )}

      <Card>
        {items === null ? (
          <ul aria-hidden className="divide-y divide-border">
            {[0, 1, 2].map((i) => (
              <li key={i} className="flex items-center gap-4 px-5 py-3">
                <span className="size-14 jb-skel rounded-xl bg-border" />
                <span className="flex-1 space-y-2">
                  <span className="block h-3 w-1/2 jb-skel rounded bg-border" />
                  <span className="block h-3 w-1/3 jb-skel rounded bg-border" />
                </span>
              </li>
            ))}
          </ul>
        ) : items.length === 0 ? (
          <EmptyState
            icon={<CalendarClock />}
            title={scope === "upcoming" ? "No upcoming bookings" : "Nothing here yet"}
            body={scope === "upcoming" ? "When someone books through one of your pages, it appears here. To start, set up a page, a meeting type and your hours." : "Past and cancelled bookings are kept here."}
            action={scope === "upcoming" ? <ButtonLink href="/dashboard/booking?tab=pages" variant="primary">Set up a booking page</ButtonLink> : undefined}
          />
        ) : (
          <ul className="divide-y divide-border">
            {items.map((b: import("@/lib/booking-client").HostBooking) => {
              const cancelled = b.status === "cancelled";
              const upcoming = b.status === "confirmed" && new Date(b.startAt) > new Date();
              return (
                <li key={b.id} className="flex flex-col gap-4 px-5 py-3 sm:flex-row sm:items-start">
                  <span aria-hidden className={`grid size-14 shrink-0 place-items-center rounded-xl text-center leading-none ${cancelled ? "bg-surface text-muted" : "bg-accent-solid/15 text-accent"}`}>
                    <span>
                      <span className="block text-xl font-semibold tabular-nums">{dayOf(b.startAt)}</span>
                      <span className="mt-1 block text-xs font-medium uppercase tracking-wider">{monthOf(b.startAt)}</span>
                    </span>
                  </span>
                  <div className="min-w-0 flex-1 space-y-2 text-sm">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                      <p className={`font-medium ${cancelled ? "text-muted line-through" : ""}`}>{b.meetingName} with {b.guestName}</p>
                      <Badge tone={cancelled ? "neutral" : "success"}>{cancelled ? `Cancelled${b.cancelledBy ? ` by ${b.cancelledBy}` : ""}` : "Confirmed"}</Badge>
                      {b.rescheduled && !cancelled && <Badge tone="info">Rescheduled</Badge>}
                    </div>
                    <p className="text-muted tabular-nums">{formatDateTime(b.startAt, timeZone)} to {formatTime(b.endAt, timeZone)} · {b.durationMin} min</p>
                    <p className="text-xs text-muted">{b.guestEmail} · guest&apos;s time zone {b.guestTimezone.replace(/_/g, " ")}</p>
                    {b.guestNote && <p className="rounded-xl bg-surface px-4 py-3 text-muted">&ldquo;{b.guestNote}&rdquo;</p>}
                    <ul className="space-y-1 text-xs text-muted">
                      {!cancelled && b.emailStatus === "not_configured" && <li>The guest was not emailed (email isn&apos;t set up). They have a link to manage the booking.</li>}
                      {!cancelled && b.calendarStatus === "failed" && <li className="text-warning">Could not be added to your calendar. The booking itself is confirmed.</li>}
                      {!cancelled && b.calendarStatus === "created" && <li className="flex items-center gap-1.5"><Check aria-hidden className="size-3.5 text-success" strokeWidth={3} /> Added to your calendar.</li>}
                      {b.captureId && (
                        <li className="flex items-center gap-2">
                          <Video aria-hidden className="size-4" /> The Jooba Assistant is scheduled to join.{" "}
                          <Link href={`/dashboard/captures/${b.captureId}`} className="font-medium text-accent hover:underline">View</Link>
                        </li>
                      )}
                    </ul>
                  </div>
                  {upcoming && (
                    <div className="flex shrink-0 gap-2 sm:flex-col">
                      <Button size="sm" variant="secondary" onClick={() => { setMoving(b); setSlot(null); setConfirm(null); setLocalError(null); }}>Reschedule</Button>
                      <Button size="sm" variant="ghost" onClick={() => { setConfirm(b); setMoving(null); setLocalError(null); }}>Cancel</Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
