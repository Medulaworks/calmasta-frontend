"use client";

import {
  CalendarPlus,
  CheckCircle2,
  Clock,
  MapPin,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { GuestBooking } from "@/lib/booking-client";
import { formatDay, formatTime, zoneLabel } from "@/lib/tz";

const isUrl = (s: string) => /^https?:\/\//i.test(s);

function googleCalendarLink(b: GuestBooking) {
  const t = (iso: string) => iso.replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const p = new URLSearchParams({
    action: "TEMPLATE",
    text: b.hostName ? `${b.meetingName} with ${b.hostName}` : b.meetingName,
    dates: `${t(b.startAt)}/${t(b.endAt)}`,
    details: "Booked through Joobah.",
  });
  if (b.locationText) p.set("location", b.locationText);
  return `https://calendar.google.com/calendar/render?${p}`;
}

/** The booking as the guest should see it: the times in THEIR zone, what happens next, and honest notes about email. */
export function BookingSummary({
  booking,
  token,
  timeZone,
  heading,
}: {
  booking: GuestBooking;
  token: string;
  timeZone: string;
  heading?: string;
}) {
  const cancelled = booking.status === "cancelled";
  return (
    <section aria-label="Your booking" className="space-y-5">
      <div className="flex items-start gap-3">
        {cancelled ? (
          <XCircle aria-hidden className="mt-1 h-6 w-6 shrink-0 text-muted" />
        ) : (
          <CheckCircle2
            aria-hidden
            className="mt-1 h-6 w-6 shrink-0 text-success"
          />
        )}
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {heading ??
              (cancelled ? "This booking was cancelled" : "You’re booked")}
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
            <Badge tone={cancelled ? "neutral" : "success"}>
              {cancelled ? "Cancelled" : "Confirmed"}
            </Badge>
            {booking.rescheduled && !cancelled && (
              <Badge tone="info">Rescheduled</Badge>
            )}
            {cancelled && (
              <span>
                {booking.cancelledBy === "host"
                  ? "Cancelled by the host."
                  : "Cancelled by you."}
              </span>
            )}
          </p>
        </div>
      </div>

      <dl className="space-y-3 rounded-2xl border border-border p-5 text-sm">
        <div>
          <dt className="text-muted">What</dt>
          <dd className="font-medium">
            {booking.meetingName}
            {booking.hostName ? ` with ${booking.hostName}` : ""}
          </dd>
        </div>
        <div className="flex items-start gap-2">
          <Clock aria-hidden className="mt-1 h-4 w-4 shrink-0 text-muted" />
          <div>
            <dd className={`font-medium ${cancelled ? "line-through" : ""}`}>
              {formatDay(booking.startAt, timeZone)},{" "}
              {formatTime(booking.startAt, timeZone)} to{" "}
              {formatTime(booking.endAt, timeZone)}
            </dd>
            <dd className="text-muted">
              {booking.durationMin} minutes · times shown in{" "}
              {timeZone.replace(/_/g, " ")} (
              {zoneLabel(timeZone, new Date(booking.startAt))})
            </dd>
          </div>
        </div>
        {booking.locationText && !cancelled && (
          <div className="flex items-start gap-2">
            <MapPin
              aria-hidden
              className="mt-1 h-4 w-4 shrink-0 text-muted"
            />
            <dd>
              {isUrl(booking.locationText) ? (
                <a
                  href={booking.locationText}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="break-all text-accent hover:underline">
                  {booking.locationText}
                </a>
              ) : (
                booking.locationText
              )}
            </dd>
          </div>
        )}
        <div>
          <dt className="text-muted">For</dt>
          <dd>
            {booking.guestName} · {booking.guestEmail}
          </dd>
        </div>
      </dl>

      {!cancelled && (
        <div className="flex flex-wrap gap-2">
          <a
            href={`/api/public/bookings/${encodeURIComponent(token)}/ics`}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-surface">
            <CalendarPlus aria-hidden className="h-4 w-4" /> Add to calendar
            (.ics)
          </a>
          <a
            href={googleCalendarLink(booking)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-surface">
            Google Calendar
          </a>
        </div>
      )}

      {/* The booking is confirmed whether or not an email could be sent; say which it is, never imply one was sent. */}
      {!cancelled && booking.emailStatus === "not_configured" && (
        <p
          role="status"
          className="rounded-lg border border-border bg-surface px-4 py-3 text-sm">
          <span className="font-medium">No confirmation email was sent.</span>{" "}
          Email isn’t set up yet, but your booking is confirmed. Keep this
          page’s link to change or cancel it later.
        </p>
      )}
      {!cancelled && booking.emailStatus === "failed" && (
        <p
          role="status"
          className="rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
          <span className="font-medium">
            Your booking is confirmed, but the confirmation email couldn’t
            be sent.
          </span>{" "}
          Keep this page’s link: it’s how you change or cancel.
        </p>
      )}
      {!cancelled && booking.emailStatus === "pending" && (
        <p
          role="status"
          className="rounded-lg border border-border bg-surface px-4 py-3 text-sm">
          Your booking is confirmed. The confirmation email is on its way and
          can take a few minutes.
        </p>
      )}
    </section>
  );
}
