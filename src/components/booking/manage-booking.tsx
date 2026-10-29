"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BookingSummary } from "@/components/booking/booking-summary";
import { SlotPicker, timeZoneChoices } from "@/components/booking/slot-picker";
import {
  type GuestBooking,
  type Slot,
  cancelGuestBooking,
  getGuestBooking,
  guestSlots,
  rescheduleGuestBooking,
} from "@/lib/booking-client";
import { browserTimeZone, formatDay, formatTime } from "@/lib/tz";
import { ApiError } from "@/lib/upload-client";

type Mode = "view" | "reschedule" | "confirm-cancel";

/** A guest changes or cancels their own booking using the secret link. Nothing here needs an account. */
export function ManageBooking({ token }: { token: string }) {
  const [booking, setBooking] = useState<GuestBooking | null>(null);
  const [problem, setProblem] = useState<{
    title: string;
    text: string;
  } | null>(null);
  const [mode, setMode] = useState<Mode>("view");
  const [timeZone, setTimeZone] = useState<string>(() => browserTimeZone());
  const [slot, setSlot] = useState<Slot | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    getGuestBooking(token).then(
      (b) => setBooking(b),
      (err) => {
        if (err instanceof ApiError && err.status === 410)
          setProblem({
            title: "This link has expired",
            text: "Links stop working a month after the meeting. If you need something changed, contact the person you booked with.",
          });
        else if (err instanceof ApiError && err.status === 404)
          setProblem({
            title: "We couldn't find that booking",
            text: "The link may be incomplete. Try opening it again from the message you received.",
          });
        else
          setProblem({
            title: "We couldn't load your booking",
            text: "Please try again in a moment.",
          });
      },
    );
  }, [token]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback(
    (from: string, days: number) => guestSlots(token, from, days, timeZone),
    [token, timeZone, refresh],
  );
  const zones = useMemo(() => timeZoneChoices(timeZone), [timeZone]);

  async function cancel() {
    setBusy(true);
    setError(null);
    try {
      setBooking(await cancelGuestBooking(token));
      setMode("view");
      setSaved("Your booking has been cancelled.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not cancel. Please try again.",
      );
    }
    setBusy(false);
  }
  async function move() {
    if (!slot) return;
    setBusy(true);
    setError(null);
    try {
      setBooking(await rescheduleGuestBooking(token, slot.start));
      setMode("view");
      setSlot(null);
      setSaved("Your booking has been moved.");
    } catch (err) {
      if (err instanceof ApiError && err.code === "slot_unavailable") {
        setError("That time was just taken. Please choose another.");
        setSlot(null);
        setRefresh((n) => n + 1);
      } else
        setError(
          err instanceof Error
            ? err.message
            : "Could not move the booking. Please try again.",
        );
    }
    setBusy(false);
  }

  if (problem) {
    return (
      <div role="alert" className="mx-auto max-w-md py-16 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          {problem.title}
        </h1>
        <p className="mt-2 text-muted">{problem.text}</p>
      </div>
    );
  }
  if (!booking)
    return (
      <div
        aria-hidden
        className="mx-auto max-w-xl animate-pulse space-y-4 py-10">
        <div className="h-8 w-56 rounded bg-border" />
        <div className="h-48 rounded-xl bg-border/50" />
      </div>
    );

  return (
    <div className="mx-auto max-w-xl space-y-6 py-10">
      {saved && (
        <p
          role="status"
          className="rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
          {saved}
        </p>
      )}
      <BookingSummary
        booking={booking}
        token={token}
        timeZone={timeZone}
        heading={booking.status === "confirmed" ? "Your booking" : undefined}
      />

      {error && (
        <p
          role="alert"
          className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}

      {booking.status === "confirmed" && !booking.canChange && (
        <p role="status" className="text-sm text-muted">
          This meeting has already started, so it can no longer be changed here.
        </p>
      )}

      {booking.canChange && mode === "view" && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setMode("reschedule");
              setSaved(null);
              setError(null);
            }}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-surface">
            Reschedule
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("confirm-cancel");
              setSaved(null);
              setError(null);
            }}
            className="rounded-lg px-4 py-2 text-sm font-medium text-danger hover:bg-surface">
            Cancel booking
          </button>
        </div>
      )}

      {mode === "confirm-cancel" && (
        <div
          role="alertdialog"
          aria-label="Confirm cancel"
          className="rounded-xl border border-border bg-surface p-5 text-sm">
          <p className="font-medium">Cancel this booking?</p>
          <p className="mt-1 text-muted">
            The time will be given back. You can book again whenever you like.
          </p>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void cancel()}
              className="inline-flex min-h-9 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-danger-solid px-4 text-sm font-medium text-white transition-colors hover:brightness-95 active:brightness-90 disabled:pointer-events-none disabled:opacity-50">
              {busy ? "Cancelling…" : "Yes, cancel it"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setMode("view")}
              className="rounded-lg px-4 py-2 text-muted hover:text-foreground">
              Keep it
            </button>
          </div>
        </div>
      )}

      {mode === "reschedule" && (
        <section
          aria-label="Choose a new time"
          className="space-y-4 rounded-xl border border-border p-5">
          <h2 className="font-semibold">Choose a new time</h2>
          <label className="block text-sm">
            <span className="text-muted">Show times in</span>
            <select
              value={timeZone}
              onChange={(e) => {
                setTimeZone(e.target.value);
                setSlot(null);
              }}
              className="mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
              {zones.map((z) => (
                <option key={z} value={z}>
                  {z.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </label>
          <SlotPicker
            load={load}
            timeZone={timeZone}
            selected={slot?.start ?? null}
            onPick={setSlot}
          />
          {slot && (
            <p className="text-sm">
              New time:{" "}
              <span className="font-medium">
                {formatDay(slot.start, timeZone)},{" "}
                {formatTime(slot.start, timeZone)}
              </span>
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!slot || busy}
              onClick={() => void move()}
              className="inline-flex min-h-9 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-accent-solid px-4 text-sm font-medium text-on-accent transition-colors hover:brightness-95 active:brightness-90 disabled:pointer-events-none disabled:opacity-50">
              {busy ? "Checking availability…" : "Confirm new time"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setMode("view");
                setSlot(null);
                setError(null);
              }}
              className="rounded-lg px-4 py-2 text-sm text-muted hover:text-foreground">
              Back
            </button>
          </div>
        </section>
      )}
      <p className="text-xs text-muted">
        Booked through MyJooba.{" "}
        <Link href="/" className="underline">
          What is MyJooba?
        </Link>
      </p>
    </div>
  );
}
