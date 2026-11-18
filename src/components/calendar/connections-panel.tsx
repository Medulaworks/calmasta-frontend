"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, TriangleAlert } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  type ConnectionsResponse,
  type ConnectionView,
  connectDevCalendar,
  connectGoogleCalendar,
  connectMicrosoftCalendar,
  disconnectCalendar,
} from "@/lib/calendar-client";
import { qk } from "@/lib/queries";

/** The connected calendars, how to connect one, and the confirmed way to disconnect. Connecting never starts a recording. */
export function ConnectionsPanel({
  conns,
  onChanged,
  onError,
}: {
  conns: ConnectionsResponse | null;
  onChanged: () => void;
  onError: (message: string) => void;
}) {
  const [disconnecting, setDisconnecting] = useState<ConnectionView | null>(
    null,
  );
  const queryClient = useQueryClient();
  const isDevPreview = conns?.mock === true;
  const canConnectGoogle = !isDevPreview && !!conns?.capabilities?.connect && (conns?.providers?.includes("google") ?? true);
  const showDevConnect = isDevPreview;

  const connectDevMut = useMutation({
    mutationFn: () => connectDevCalendar(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.calendarConnections() });
      onChanged();
    },
    onError: (err) => onError(err instanceof Error ? err.message : "We couldn’t connect. Please try again."),
  });
  const connectGoogleMut = useMutation({
    mutationFn: () => connectGoogleCalendar(),
    onSuccess: (res) => {
      window.location.assign(res.authorizationUrl);
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : "We couldn’t connect. Please try again.";
      if (msg.includes("calendar_provider_not_configured") || (err as unknown as { code?: string })?.code === "calendar_provider_not_configured") {
        onError("Calendar connections aren’t set up yet. Please contact support.");
      } else onError(msg);
    },
  });
  const connectMicrosoftMut = useMutation({
    mutationFn: () => connectMicrosoftCalendar(),
    onSuccess: (res) => {
      window.location.assign(res.authorizationUrl);
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : "We couldn’t connect. Please try again.";
      if (msg.includes("calendar_provider_not_configured") || (err as unknown as { code?: string })?.code === "calendar_provider_not_configured") {
        onError("Calendar connections aren’t set up yet. Please contact support.");
      } else onError(msg);
    },
  });
  const disconnectMut = useMutation({
    mutationFn: (id: string) => disconnectCalendar(id),
    onSuccess: () => {
      setDisconnecting(null);
      queryClient.invalidateQueries({ queryKey: qk.calendarConnections() });
      queryClient.invalidateQueries({ queryKey: ["calendar", "agenda"] });
      onChanged();
    },
    onError: (err) => onError(err instanceof Error ? err.message : "We couldn’t disconnect. Please try again."),
  });
  const busy = connectDevMut.isPending || connectGoogleMut.isPending || connectMicrosoftMut.isPending || disconnectMut.isPending;

  function connectDev() {
    connectDevMut.mutate();
  }
  function connectGoogle() {
    connectGoogleMut.mutate();
  }
  function connectMicrosoft() {
    connectMicrosoftMut.mutate();
  }
  function confirmDisconnect() {
    if (!disconnecting) return;
    disconnectMut.mutate(disconnecting.id);
  }

  return (
    <>
      <Card>
        <CardHeader title="Connected calendars" />
        {conns === null ? (
          <div aria-hidden className="space-y-3 p-5">
            <div className="h-4 w-1/3 jb-skel rounded bg-border" />
            <div className="h-3 w-2/3 jb-skel rounded bg-border" />
          </div>
        ) : conns.connections.length === 0 ? (
          <EmptyState
            icon={<CalendarDays className="h-5 w-5" />}
            title="Connect your calendar"
            body="See your day in one place and keep people from booking over your other events. Connecting only reads your calendar: it never starts a recording, and Joobah does not change your existing events."
            action={
              showDevConnect ? (
                <div className="space-y-2">
                  <Button
                    variant="primary"
                    onClick={() => void connectDev()}
                    disabled={busy}>
                    {busy ? "Connecting…" : "Connect a development calendar"}
                  </Button>
                  <p className="text-xs text-muted">
                    Development stand-in: no real calendar is contacted.
                  </p>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="primary"
                    onClick={() => void connectGoogle()}
                    disabled={busy}
                    className="inline-flex items-center gap-2">
                    <Image src="/icons/icons8-google-96.png" alt="" width={18} height={18} className="h-5 w-5 shrink-0" />
                    {busy ? "Connecting…" : "Connect Google Calendar"}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => void connectMicrosoft()}
                    disabled={busy}
                    className="inline-flex items-center gap-2">
                    <Image src="/icons/icons8-microsoft-96.png" alt="" width={18} height={18} className="h-5 w-5 shrink-0" />
                    {busy ? "Connecting…" : "Connect Microsoft Calendar"}
                  </Button>
                </div>
              )
            }
          />
        ) : (
          <>
            <ul className="divide-y divide-border">
              {conns.connections.map((c) => (
              <li key={c.id} className="space-y-3 px-5 py-3 text-sm">
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
                      (showDevConnect ? (
                        <Button
                          variant="primary"
                          onClick={() => void connectDev()}
                          disabled={busy}>
                          Reconnect
                        </Button>
                      ) : (
                        <Button
                          variant="primary"
                          onClick={() => void connectGoogle()}
                          disabled={busy}>
                          Reconnect
                        </Button>
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
                      className="mt-1 h-4 w-4 shrink-0"
                    />{" "}
                    Joobah lost access to this calendar. Its events aren’t
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
            {!showDevConnect && (
              <div className="flex flex-wrap gap-2 border-t border-border p-5">
                <Button
                  variant="primary"
                  onClick={() => void connectGoogle()}
                  disabled={busy}
                  className="inline-flex items-center gap-2">
                  <Image src="/icons/icons8-google-96.png" alt="" width={18} height={18} className="h-5 w-5 shrink-0" />
                  Connect Google Calendar
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => void connectMicrosoft()}
                  disabled={busy}
                  className="inline-flex items-center gap-2">
                  <Image src="/icons/icons8-microsoft-96.png" alt="" width={18} height={18} className="h-5 w-5 shrink-0" />
                  Connect Microsoft Calendar
                </Button>
              </div>
            )}
          </>
        )}
      </Card>

      {disconnecting && (
        <div
          role="alertdialog"
          aria-label="Confirm disconnect"
          className="rounded-2xl border border-border bg-surface p-5 text-sm">
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
