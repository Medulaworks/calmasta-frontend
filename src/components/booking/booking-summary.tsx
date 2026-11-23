"use client";

import { CalendarDays, CalendarPlus, Check, Mail, UserRound, Video, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
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

/** One line of the details: a small icon, then what it is. */
function Row({ icon: Icon, children }: { icon: typeof CalendarDays; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4 px-5 py-4">
      <Icon aria-hidden className="mt-0.5 size-5 shrink-0 text-muted" />
      <div className="min-w-0 text-sm">{children}</div>
    </div>
  );
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
  const what = `${booking.meetingName}${booking.hostName ? ` with ${booking.hostName}` : ""}`;
  return (
    <section aria-label="Your booking" className="rounded-2xl border border-border bg-background p-6 shadow-sm sm:p-8">
      <div className="flex flex-col items-center text-center">
        <span aria-hidden className={`grid size-14 place-items-center rounded-full ${cancelled ? "bg-surface text-muted ring-1 ring-border" : "bg-success/10 text-success"}`}>
          {cancelled ? <X className="size-7" /> : <Check className="size-7" strokeWidth={2.5} />}
        </span>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight">
          {heading ?? (cancelled ? "This booking was cancelled" : "You’re booked")}
        </h1>
        <p className="mt-1 text-sm text-muted">{what}</p>
        {((booking.rescheduled && !cancelled) || cancelled) && (
          <p className="mt-3 flex flex-wrap items-center justify-center gap-2 text-sm text-muted">
            {booking.rescheduled && !cancelled && <Badge tone="info">Rescheduled</Badge>}
            {cancelled && <span>{booking.cancelledBy === "host" ? "Cancelled by the host." : "Cancelled by you."}</span>}
          </p>
        )}
      </div>

      <dl className="mt-7 divide-y divide-border overflow-hidden rounded-xl border border-border">
        <Row icon={CalendarDays}>
          <dd className={`font-medium ${cancelled ? "line-through" : ""}`}>
            {formatDay(booking.startAt, timeZone)}
            <span className="block font-normal tabular-nums">{formatTime(booking.startAt, timeZone)} to {formatTime(booking.endAt, timeZone)} · {booking.durationMin} minutes</span>
          </dd>
          <dd className="mt-0.5 text-xs text-muted">{timeZone.replace(/_/g, " ")} ({zoneLabel(timeZone, new Date(booking.startAt))})</dd>
        </Row>
        {booking.locationText && !cancelled && (
          <Row icon={Video}>
            <dd>
              {isUrl(booking.locationText) ? (
                <a href={booking.locationText} target="_blank" rel="noopener noreferrer" className="break-all font-medium text-accent hover:underline">{booking.locationText}</a>
              ) : (
                booking.locationText
              )}
            </dd>
          </Row>
        )}
        <Row icon={UserRound}>
          <dd className="font-medium">{booking.guestName}</dd>
          <dd className="break-all text-muted">{booking.guestEmail}</dd>
        </Row>
      </dl>

      {!cancelled && (
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <a href={`/api/public/bookings/${encodeURIComponent(token)}/ics`} className={buttonClass("primary", "w-full", "lg")}>
            <CalendarPlus aria-hidden className="size-4" /> Add to calendar
          </a>
          <a href={googleCalendarLink(booking)} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary", "w-full", "lg")}>
            Google Calendar
          </a>
        </div>
      )}

      {/* The booking is confirmed whether or not an email could be sent; say which it is, never imply one was sent. */}
      {!cancelled && booking.emailStatus === "not_configured" && (
        <p role="status" className="mt-5 flex items-start gap-3 text-sm text-muted">
          <Mail aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span><span className="font-medium text-foreground">No confirmation email was sent.</span> Email isn’t set up yet, but your booking is confirmed. Keep this page’s link to change or cancel it later.</span>
        </p>
      )}
      {!cancelled && booking.emailStatus === "failed" && (
        <p role="status" className="mt-5 flex items-start gap-3 rounded-xl border border-warning/30 bg-warning/5 px-4 py-3 text-sm text-warning">
          <Mail aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span><span className="font-medium">Your booking is confirmed, but the confirmation email couldn’t be sent.</span> Keep this page’s link: it’s how you change or cancel.</span>
        </p>
      )}
      {!cancelled && booking.emailStatus === "pending" && (
        <p role="status" className="mt-5 flex items-start gap-3 text-sm text-muted">
          <Mail aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>Your booking is confirmed. The confirmation email is on its way and can take a few minutes.</span>
        </p>
      )}
    </section>
  );
}
