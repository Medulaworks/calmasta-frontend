"use client";

import { Video } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Confirm,
  ErrorBox,
  Field,
  field,
} from "@/components/booking/form-bits";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  type MeetingTypeInput,
  type MeetingTypeView,
} from "@/lib/booking-client";
import { useDeleteMeetingType, useSaveMeetingType } from "@/lib/mutations";
import { availabilitiesQuery, meetingTypesQuery, pagesQuery } from "@/lib/queries";

const blank = (pageId = "", availabilityId = ""): MeetingTypeInput => ({
  pageId,
  availabilityId,
  name: "",
  description: "",
  durationMin: 30,
  locationText: "",
  active: true,
  captureEnabled: false,
  captureConfirmed: false,
});
const DURATIONS = [15, 20, 30, 45, 60, 90, 120];

export function MeetingTypesTab() {
  const typesQ = useQuery(meetingTypesQuery);
  const pagesQ = useQuery(pagesQuery);
  const availsQ = useQuery(availabilitiesQuery);
  const types = typesQ.data ?? null;
  const pages = pagesQ.data ?? [];
  const avails = availsQ.data ?? [];
  const qError = (typesQ.error as Error | undefined)?.message ?? (pagesQ.error as Error | undefined)?.message ?? (availsQ.error as Error | undefined)?.message ?? null;
  const saveM = useSaveMeetingType();
  const delM = useDeleteMeetingType();
  const [editing, setEditing] = useState<MeetingTypeView | "new" | null>(null);
  const [form, setForm] = useState<MeetingTypeInput>(blank());
  const [localError, setLocalError] = useState<string | null>(null);
  const error = localError ?? qError;
  const busy = saveM.isPending || delM.isPending;
  const [confirmDelete, setConfirmDelete] = useState<MeetingTypeView | null>(
    null,
  );

  function open(t: MeetingTypeView | "new") {
    setEditing(t);
    setLocalError(null);
    setForm(
      t === "new"
        ? blank(pages[0]?.id, avails[0]?.id)
        : {
            pageId: t.pageId,
            availabilityId: t.availabilityId,
            name: t.name,
            description: t.description,
            durationMin: t.durationMin,
            locationText: t.locationText,
            active: t.active,
            captureEnabled: t.captureEnabled,
            captureConfirmed: false,
          },
    );
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
      setLocalError(err instanceof Error ? err.message : "Could not delete.");
    }
  }

  const ready = pages.length > 0 && avails.length > 0;
  const wasCapturing = editing && editing !== "new" && editing.captureEnabled;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted">
          A meeting type is one thing guests can book: a name, a length and
          where it happens.
        </p>
        {editing === null && (
          <Button
            variant="primary"
            disabled={!ready}
            onClick={() => open("new")}>
            New meeting type
          </Button>
        )}
      </div>
      {types !== null && !ready && (
        <p
          role="status"
          className="rounded-lg border border-border bg-surface px-4 py-3 text-sm">
          {pages.length === 0
            ? "Create a booking page first (Pages tab)."
            : "Set your working hours first (Availability tab)."}
        </p>
      )}
      <ErrorBox message={editing ? null : error} />
      {confirmDelete && (
        <Confirm
          title={`Delete “${confirmDelete.name}”?`}
          text="Guests can no longer book it. Bookings already made are kept."
          action="Delete meeting type"
          busy={busy}
          onConfirm={() => void remove()}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      {editing && (
        <Card>
          <CardHeader
            title={editing === "new" ? "New meeting type" : "Edit meeting type"}
          />
          <form onSubmit={save} className="space-y-4 p-5">
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
              <Field label="Length">
                <select
                  value={form.durationMin}
                  onChange={(e) =>
                    setForm({ ...form, durationMin: Number(e.target.value) })
                  }
                  className={field}>
                  {[...new Set([...DURATIONS, form.durationMin])]
                    .sort((a, b) => a - b)
                    .map((d) => (
                      <option key={d} value={d}>
                        {d} minutes
                      </option>
                    ))}
                </select>
              </Field>
              <Field label="On this page">
                <select
                  value={form.pageId}
                  onChange={(e) => setForm({ ...form, pageId: e.target.value })}
                  className={field}>
                  {pages.map((p: import("@/lib/booking-client").PageView) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Available hours">
                <select
                  value={form.availabilityId}
                  onChange={(e) =>
                    setForm({ ...form, availabilityId: e.target.value })
                  }
                  className={field}>
                  {avails.map((a: import("@/lib/booking-client").AvailabilityView) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Description" hint="Shown to guests.">
              <textarea
                value={form.description}
                maxLength={2000}
                rows={2}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                className={field}
              />
            </Field>
            <Field
              label="Where it happens"
              hint="A video link (Google Meet, Teams or Zoom) or instructions like “Phone: I'll call you”. Guests see it after booking.">
              <input
                value={form.locationText}
                maxLength={500}
                onChange={(e) =>
                  setForm({ ...form, locationText: e.target.value })
                }
                className={field}
              />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
                className="h-4 w-4"
              />{" "}
              Guests can book this
            </label>

            <fieldset className="space-y-3 rounded-xl border border-border p-4">
              <legend className="px-1 text-sm font-medium">Recording</legend>
              <p className="text-sm text-muted">
                Off unless you turn it on. Connecting a calendar never records,
                and neither does a booking by default.
              </p>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.captureEnabled}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      captureEnabled: e.target.checked,
                      captureConfirmed: e.target.checked
                        ? form.captureConfirmed
                        : false,
                    })
                  }
                  className="mt-0.5 h-4 w-4"
                />
                <span>
                  <span className="font-medium">
                    Send the MyJooba Assistant to these meetings
                  </span>
                  <span className="block text-muted">
                    It joins as a visible participant named “MyJooba Assistant”
                    a couple of minutes before the start, and may need to be
                    admitted. If it can&apos;t join, the booking is unaffected.
                  </span>
                </span>
              </label>
              {form.captureEnabled && (
                <div className="space-y-3 border-t border-border pt-3">
                  {!wasCapturing && (
                    <label className="flex items-start gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={form.captureConfirmed}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            captureConfirmed: e.target.checked,
                          })
                        }
                        className="mt-0.5 h-4 w-4"
                      />
                      <span>
                        I have the right to record these meetings, and I will
                        tell my guests.
                      </span>
                    </label>
                  )}
                  {wasCapturing && (
                    <p className="text-sm text-muted">
                      You confirmed your right to record these meetings earlier.
                      Turn recording off and on again to confirm afresh.
                    </p>
                  )}
                  <p className="flex items-start gap-2 text-xs text-muted">
                    <Video
                      aria-hidden
                      className="mt-0.5 h-3.5 w-3.5 shrink-0"
                    />{" "}
                    The location above must be a Google Meet, Teams or Zoom link
                    for the assistant to join.
                  </p>
                </div>
              )}
            </fieldset>

            <ErrorBox message={error} />
            <div className="flex gap-2">
              <Button variant="primary" type="submit" disabled={busy}>
                {busy ? "Saving…" : "Save meeting type"}
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
        {types === null ? (
          <div aria-hidden className="p-5">
            <div className="h-4 w-1/3 animate-pulse rounded bg-border" />
          </div>
        ) : types.length === 0 ? (
          <EmptyState
            title="No meeting types yet"
            body="Add the first thing guests can book."
            action={
              ready ? (
                <Button variant="primary" onClick={() => open("new")}>
                  Add a meeting type
                </Button>
              ) : undefined
            }
          />
        ) : (
          <ul className="divide-y divide-border">
            {types.map((t: import("@/lib/booking-client").MeetingTypeView) => (
              <li
                key={t.id}
                className="flex flex-wrap items-start justify-between gap-3 px-5 py-4 text-sm">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{t.name}</p>
                    <span className="text-muted">{t.durationMin} min</span>
                    {!t.active && <Badge tone="neutral">Off</Badge>}
                    {t.captureEnabled && <Badge tone="danger">Recorded</Badge>}
                  </div>
                  <p className="text-xs text-muted">
                    {t.pageTitle} · {t.availabilityName}
                    {t.locationText ? ` · ${t.locationText}` : ""}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => open(t)}>
                    Edit
                  </Button>
                  <Button variant="ghost" onClick={() => setConfirmDelete(t)}>
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
