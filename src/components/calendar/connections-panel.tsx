"use client";

import { CalendarDays, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  type ConnectionView,
  connectDevCalendar,
  disconnectCalendar,
} from "@/lib/calendar-client";

/** The connected calendars, how to connect one, and the confirmed way to disconnect. Connecting never starts a recording. */
export function ConnectionsPanel({
  conns,
  onChanged,
  onError,
}: {
  conns: { provider: string; connections: ConnectionView[] } | null;
  onChanged: () => void;
  onError: (message: string) => void;
}) {
  const [disconnecting, setDisconnecting] = useState<ConnectionView | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const isDev = conns?.provider === "mock";

  async function connect() {
    setBusy(true);
    try {
      await connectDevCalendar();
      onChanged();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not connect.");
    }
    setBusy(false);
  }
  async function confirmDisconnect() {
    if (!disconnecting) return;
    setBusy(true);
    try {
      await disconnectCalendar(disconnecting.id);
      setDisconnecting(null);
      onChanged();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not disconnect.");
    }
    setBusy(false);
  }

  return (
    <>
      <Card>
        <CardHeader title="Connected calendars" />
        {conns === null ? (
          <div aria-hidden className="space-y-3 p-5">
            <div className="h-4 w-1/3 animate-pulse rounded bg-border" />
            <div className="h-3 w-2/3 animate-pulse rounded bg-border" />
          </div>
        ) : conns.connections.length === 0 ? (
          <EmptyState
            icon={<CalendarDays className="h-5 w-5" />}
            title="Connect your calendar"
            body="See your day in one place and keep people from booking over your other events. Connecting only reads your calendar: it never starts a recording, and MyJooba does not change your existing events."
            action={
              isDev ? (
                <div className="space-y-2">
                  <Button
                    variant="primary"
                    onClick={() => void connect()}
                    disabled={busy}>
                    {busy ? "Connecting…" : "Connect a development calendar"}
                  </Button>
                  <p className="text-xs text-muted">
                    Development stand-in: no real calendar is contacted.
                  </p>
                </div>
              ) : (
                <a
                  href="/api/calendar/connect/start"
                  className="inline-flex min-h-9 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-accent-solid px-4 text-sm font-medium text-on-accent transition-colors hover:brightness-95 active:brightness-90 disabled:pointer-events-none disabled:opacity-50">
                  Connect Google Calendar
                </a>
              )
            }
          />
        ) : (
          <ul className="divide-y divide-border">
            {conns.connections.map((c) => (
              <li key={c.id} className="space-y-3 px-5 py-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{c.accountEmail}</p>
                    <Badge
                      tone={c.status === "connected" ? "success" : "warning"}>
                      {c.status === "connected"
                        ? "Connected"
                        : "Needs reconnecting"}
                    </Badge>
                  </div>
                  <div className="flex gap-2">
                    {c.status === "needs_reconnect" &&
                      (isDev ? (
                        <Button
                          variant="primary"
                          onClick={() => void connect()}
                          disabled={busy}>
                          Reconnect
                        </Button>
                      ) : (
                        <a
                          href="/api/calendar/connect/start"
                          className="inline-flex min-h-9 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-accent-solid px-4 text-sm font-medium text-on-accent transition-colors hover:brightness-95 active:brightness-90 disabled:pointer-events-none disabled:opacity-50">
                          Reconnect
                        </a>
                      ))}
                    <Button variant="ghost" onClick={() => setDisconnecting(c)}>
                      Disconnect
                    </Button>
                  </div>
                </div>
                {c.status === "needs_reconnect" && (
                  <p
                    role="status"
                    className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-warning">
                    <TriangleAlert
                      aria-hidden
                      className="mt-0.5 h-4 w-4 shrink-0"
                    />{" "}
                    MyJooba lost access to this calendar. Its events aren&apos;t
                    shown, and booking pages that check it are paused so nobody
                    is booked over your events. Reconnect to fix it.
                  </p>
                )}
                <ul className="flex flex-wrap gap-2">
                  {c.calendars.map((k) => (
                    <li
                      key={k.id}
                      className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs">
                      <span
                        aria-hidden
                        className="h-2 w-2 rounded-full"
                        style={{ background: k.color ?? "var(--muted)" }}
                      />{" "}
                      {k.name}
                      {k.isPrimary && (
                        <span className="text-muted">(main)</span>
                      )}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {disconnecting && (
        <div
          role="alertdialog"
          aria-label="Confirm disconnect"
          className="rounded-xl border border-border bg-surface p-5 text-sm">
          <p className="font-medium">
            Disconnect {disconnecting.accountEmail}?
          </p>
          <p className="mt-1 text-muted">
            This disconnects the whole account, so all{" "}
            {disconnecting.calendars.length} of its{" "}
            {disconnecting.calendars.length === 1 ? "calendar" : "calendars"} (
            {disconnecting.calendars.map((k) => k.name).join(", ")}) go
            together.
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
            <li>
              {disconnecting.impact.upcomingBookings > 0
                ? `${disconnecting.impact.upcomingBookings} upcoming booking${disconnecting.impact.upcomingBookings === 1 ? "" : "s"} stay confirmed, but will no longer be added to this calendar.`
                : "No upcoming bookings are written to this calendar."}
            </li>
            <li>
              {disconnecting.impact.availabilities > 0
                ? `${disconnecting.impact.availabilities} availability setting${disconnecting.impact.availabilities === 1 ? "" : "s"} use it and will stop checking it for clashes. Guests could then be offered times when you are busy.`
                : "No availability settings use it."}
            </li>
            <li>
              Events already on your calendar are not deleted. Recording is not
              affected: it is controlled per meeting type.
            </li>
          </ul>
          <div className="mt-4 flex gap-2">
            <Button
              variant="danger"
              disabled={busy}
              onClick={() => void confirmDisconnect()}>
              {busy ? "Disconnecting…" : "Disconnect"}
            </Button>
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => setDisconnecting(null)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
