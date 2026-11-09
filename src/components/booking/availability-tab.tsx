"use client";

import { Clock } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Confirm,
  ErrorBox,
  Field,
  field,
} from "@/components/booking/form-bits";
import { timeZoneChoices } from "@/components/booking/slot-picker";
import { useProfile } from "@/components/shell/profile-context";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { summarizeWeek } from "@/lib/booking-hours";
import {
  type AvailabilityInput,
  type AvailabilityView,
  WEEKDAYS,
  type Weekday,
  type WeeklyHours,
} from "@/lib/booking-client";
import { useDeleteAvailability, useSaveAvailability } from "@/lib/mutations";
import { availabilitiesQuery, calendarConnectionsQuery } from "@/lib/queries";
import { browserTimeZone } from "@/lib/tz";

const NOTICE = [
  [0, "No notice"],
  [30, "30 minutes"],
  [60, "1 hour"],
  [120, "2 hours"],
  [240, "4 hours"],
  [720, "12 hours"],
  [1440, "1 day"],
  [2880, "2 days"],
] as const;
const WINDOWS = [
  [7, "1 week"],
  [14, "2 weeks"],
  [30, "30 days"],
  [60, "60 days"],
  [90, "90 days"],
  [180, "6 months"],
  [365, "1 year"],
] as const;
const BUFFERS = [0, 5, 10, 15, 30, 45, 60];
const STEPS = [
  [15, "Every 15 minutes"],
  [30, "Every 30 minutes"],
  [60, "On the hour"],
] as const;

const weekdayDefaults = (): WeeklyHours =>
  Object.fromEntries(
    (["mon", "tue", "wed", "thu", "fri"] as Weekday[]).map((d) => [
      d,
      [{ start: "09:00", end: "17:00" }],
    ]),
  );
const blank = (tz: string): AvailabilityInput => ({
  name: "Office hours",
  timezone: tz,
  weekly: weekdayDefaults(),
  bufferBeforeMin: 0,
  bufferAfterMin: 0,
  minNoticeMin: 240,
  maxDaysAhead: 60,
  slotStepMin: 30,
  conflictCalendarIds: [],
  destinationCalendarId: null,
});

export function AvailabilityTab() {
  const profile = useProfile();
  const tz = profile?.timezone || browserTimeZone();
  const availQ = useQuery(availabilitiesQuery);
  const connQ = useQuery(calendarConnectionsQuery);
  const items = availQ.data ?? null;
  const conns = connQ.data?.connections ?? [];
  const qError = (availQ.error as Error | undefined)?.message ?? (connQ.error as Error | undefined)?.message ?? null;
  const saveM = useSaveAvailability();
  const delM = useDeleteAvailability();
  const [editing, setEditing] = useState<AvailabilityView | "new" | null>(null);
  const [form, setForm] = useState<AvailabilityInput>(blank(tz));
  const [localError, setLocalError] = useState<string | null>(null);
  const error = localError ?? qError;
  const busy = saveM.isPending || delM.isPending;
  const [confirmDelete, setConfirmDelete] = useState<AvailabilityView | null>(
    null,
  );
  const zones = useMemo(() => timeZoneChoices(form.timezone), [form.timezone]);

  const calendars = conns.flatMap((c: { calendars: Array<{ id: string; name: string }>; accountEmail: string }) =>
    c.calendars.map((k: { id: string; name: string }) => ({ ...k, account: c.accountEmail })),
  );

  function open(a: AvailabilityView | "new") {
    setEditing(a);
    setLocalError(null);
    setForm(
      a === "new"
        ? blank(tz)
        : {
            name: a.name,
            timezone: a.timezone,
            weekly: a.weekly,
            bufferBeforeMin: a.bufferBeforeMin,
            bufferAfterMin: a.bufferAfterMin,
            minNoticeMin: a.minNoticeMin,
            maxDaysAhead: a.maxDaysAhead,
            slotStepMin: a.slotStepMin,
            conflictCalendarIds: a.conflictCalendarIds,
            destinationCalendarId: a.destinationCalendarId,
          },
    );
  }
  function setDay(
    day: Weekday,
    windows: Array<{ start: string; end: string }>,
  ) {
    const weekly = { ...form.weekly };
    if (windows.length === 0) delete weekly[day];
    else weekly[day] = windows;
    setForm({ ...form, weekly });
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setLocalError(null);
    try {
      await saveM.mutateAsync({ input: form, id: editing === "new" || !editing ? undefined : editing.id });
      setEditing(null);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Could not save.");
    }
  }
  async function remove() {
    if (!confirmDelete) return;
    try {
      await delM.mutateAsync(confirmDelete.id);
      setConfirmDelete(null);
    } catch (err) {
      setConfirmDelete(null);
      setLocalError(err instanceof Error ? err.message : "Could not delete.");
    }
  }
  const summary = (w: WeeklyHours) => summarizeWeek(w);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted">
          When guests may book, and which of your calendars to check so nobody
          is booked over another event.
        </p>
        {editing === null && (
          <Button variant="primary" onClick={() => open("new")}>
            New hours
          </Button>
        )}
      </div>
      <ErrorBox message={editing ? null : error} />
      {confirmDelete && (
        <Confirm
          title={`Delete “${confirmDelete.name}”?`}
          text="These working hours are removed. Meeting types must be moved to other hours first."
          action="Delete hours"
          busy={busy}
          onConfirm={() => void remove()}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      {editing && (
        <Card>
          <CardHeader
            title={
              editing === "new" ? "New working hours" : "Edit working hours"
            }
          />
          <form onSubmit={save} className="space-y-5 p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name">
                <input
                  value={form.name}
                  maxLength={100}
                  required
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className={field}
                />
              </Field>
              <Field
                label="Time zone"
                hint="The hours below are in this zone. Guests see times converted to theirs.">
                <select
                  value={form.timezone}
                  onChange={(e) =>
                    setForm({ ...form, timezone: e.target.value })
                  }
                  className={field}>
                  {zones.map((z) => (
                    <option key={z} value={z}>
                      {z.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Weekly hours</legend>
              {WEEKDAYS.map((d) => {
                const windows = form.weekly[d.id] ?? [];
                const on = windows.length > 0;
                return (
                  <div
                    key={d.id}
                    className="flex flex-wrap items-start gap-3 border-b border-border pb-2 text-sm last:border-0">
                    <label className="flex w-32 items-center gap-2 pt-2">
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={(e) =>
                          setDay(
                            d.id,
                            e.target.checked
                              ? [{ start: "09:00", end: "17:00" }]
                              : [],
                          )
                        }
                        className="h-4 w-4"
                      />{" "}
                      {d.label}
                    </label>
                    {on ? (
                      <div className="space-y-2">
                        {windows.map((w, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <input
                              type="time"
                              aria-label={`${d.label} from`}
                              value={w.start}
                              onChange={(e) =>
                                setDay(
                                  d.id,
                                  windows.map((x, j) =>
                                    j === i
                                      ? { ...x, start: e.target.value }
                                      : x,
                                  ),
                                )
                              }
                              className="rounded-lg border border-border bg-background px-2 py-2"
                            />
                            <span className="text-muted">to</span>
                            <input
                              type="time"
                              aria-label={`${d.label} to`}
                              value={w.end}
                              onChange={(e) =>
                                setDay(
                                  d.id,
                                  windows.map((x, j) =>
                                    j === i ? { ...x, end: e.target.value } : x,
                                  ),
                                )
                              }
                              className="rounded-lg border border-border bg-background px-2 py-2"
                            />
                            <button
                              type="button"
                              aria-label={`Remove this time range on ${d.label}`}
                              onClick={() =>
                                setDay(
                                  d.id,
                                  windows.filter((_, j) => j !== i),
                                )
                              }
                              className="rounded px-2 text-muted hover:text-foreground">
                              Remove
                            </button>
                          </div>
                        ))}
                        {windows.length < 6 && (
                          <button
                            type="button"
                            onClick={() =>
                              setDay(d.id, [
                                ...windows,
                                { start: "13:00", end: "17:00" },
                              ])
                            }
                            className="text-xs text-accent hover:underline">
                            Add another range
                          </button>
                        )}
                      </div>
                    ) : (
                      <span className="pt-2 text-muted">Unavailable</span>
                    )}
                  </div>
                );
              })}
            </fieldset>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Time before each meeting">
                <select
                  value={form.bufferBeforeMin}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      bufferBeforeMin: Number(e.target.value),
                    })
                  }
                  className={field}>
                  {BUFFERS.map((b) => (
                    <option key={b} value={b}>
                      {b === 0 ? "None" : `${b} minutes`}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Time after each meeting">
                <select
                  value={form.bufferAfterMin}
                  onChange={(e) =>
                    setForm({ ...form, bufferAfterMin: Number(e.target.value) })
                  }
                  className={field}>
                  {BUFFERS.map((b) => (
                    <option key={b} value={b}>
                      {b === 0 ? "None" : `${b} minutes`}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Minimum notice">
                <select
                  value={form.minNoticeMin}
                  onChange={(e) =>
                    setForm({ ...form, minNoticeMin: Number(e.target.value) })
                  }
                  className={field}>
                  {NOTICE.map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Guests can book up to">
                <select
                  value={form.maxDaysAhead}
                  onChange={(e) =>
                    setForm({ ...form, maxDaysAhead: Number(e.target.value) })
                  }
                  className={field}>
                  {WINDOWS.map(([v, l]) => (
                    <option key={v} value={v}>
                      {l} ahead
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Offer times">
                <select
                  value={form.slotStepMin}
                  onChange={(e) =>
                    setForm({ ...form, slotStepMin: Number(e.target.value) })
                  }
                  className={field}>
                  {STEPS.map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <fieldset className="space-y-3 rounded-xl border border-border p-4">
              <legend className="px-1 text-sm font-medium">Calendars</legend>
              {calendars.length === 0 ? (
                <p className="text-sm text-muted">
                  No calendar is connected, so only bookings made through
                  Jooba are checked for clashes.{" "}
                  <Link
                    href="/dashboard/calendar"
                    className="font-medium text-accent hover:underline">
                    Connect a calendar
                  </Link>{" "}
                  to avoid double-booking.
                </p>
              ) : (
                <>
                  <div>
                    <p className="text-sm font-medium">
                      Check these for clashes
                    </p>
                    <p className="text-xs text-muted">
                      Anything on them makes that time unavailable. If one
                      can&apos;t be read, booking pauses rather than risk a
                      double booking.
                    </p>
                    <ul className="mt-2 space-y-2">
                      {calendars.map((c: { id: string; name: string; account: string }) => (
                        <li key={c.id}>
                          <label className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={form.conflictCalendarIds.includes(c.id)}
                              onChange={(e) =>
                                setForm({
                                  ...form,
                                  conflictCalendarIds: e.target.checked
                                    ? [...form.conflictCalendarIds, c.id]
                                    : form.conflictCalendarIds.filter(
                                        (x: string) => x !== c.id,
                                      ),
                                })
                              }
                              className="h-4 w-4"
                            />{" "}
                            {c.name}{" "}
                            <span className="text-xs text-muted">
                              {c.account}
                            </span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <Field
                    label="Add new bookings to"
                    hint="Confirmed bookings are written here. Leave empty to keep them only in Jooba.">
                    <select
                      value={form.destinationCalendarId ?? ""}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          destinationCalendarId: e.target.value || null,
                        })
                      }
                      className={field}>
                      <option value="">Nowhere (Jooba only)</option>
                      {calendars.map((c: { id: string; name: string; account: string }) => (
                        <option key={c.id} value={c.id}>
                          {c.name} · {c.account}
                        </option>
                      ))}
                    </select>
                  </Field>
                </>
              )}
            </fieldset>

            <ErrorBox message={error} />
            <div className="flex gap-2">
              <Button variant="primary" type="submit" disabled={busy}>
                {busy ? "Saving…" : "Save hours"}
              </Button>
              <Button
                variant="ghost"
                type="button"
                disabled={busy}
                onClick={() => setEditing(null)}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Card>
        {items === null ? (
          <div aria-hidden className="p-5">
            <div className="h-4 w-1/3 jb-skel rounded bg-border" />
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={<Clock className="h-5 w-5" />}
            title="No working hours yet"
            body="Say when guests can book you. You can change it any time."
            action={
              <Button variant="primary" onClick={() => open("new")}>
                Set your hours
              </Button>
            }
          />
        ) : (
          <ul className="divide-y divide-border">
            {items.map((a: AvailabilityView) => (
              <li
                key={a.id}
                className="flex flex-wrap items-start justify-between gap-3 px-5 py-3 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {a.name}{" "}
                    <span className="font-normal text-muted">
                      · {a.timezone.replace(/_/g, " ")}
                    </span>
                  </p>
                  <p className="text-xs text-muted">{summary(a.weekly)}</p>
                  <p className="text-xs text-muted">
                    {a.conflictCalendarIds.length
                      ? `Checks ${a.conflictCalendarIds.length} calendar${a.conflictCalendarIds.length === 1 ? "" : "s"}`
                      : "No calendars checked"}{" "}
                    · used by {a.usedBy} meeting type{a.usedBy === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => open(a)}>
                    Edit
                  </Button>
                  <Button variant="ghost" onClick={() => setConfirmDelete(a)}>
                    Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
