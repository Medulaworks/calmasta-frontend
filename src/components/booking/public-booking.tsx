"use client";

import { Clock, Loader2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BookingSummary } from "@/components/booking/booking-summary";
import { SlotPicker, timeZoneChoices } from "@/components/booking/slot-picker";
import { type GuestBooking, type PublicPage, type Slot, createPublicBooking, getPublicPage, publicSlots } from "@/lib/booking-client";
import { browserTimeZone, formatDay, formatTime, zoneLabel } from "@/lib/tz";
import { ApiError } from "@/lib/upload-client";

type Step = "time" | "details" | "done";

const input = "mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm";

/**
 * What a guest sees: pick a time, give a name and email, done. No account. The chosen meeting, duration, day, time
 * and time zone stay visible while the details are typed, and if the time is taken in the meantime the details stay put.
 */
export function PublicBooking({ slug }: { slug: string }) {
  const [page, setPage] = useState<PublicPage | null>(null);
  const [loadError, setLoadError] = useState<{ title: string; text: string } | null>(null);
  const [typeId, setTypeId] = useState<string | null>(null);
  // Read from the browser at first render. Nothing time-zone-specific is drawn until the page has loaded, so server and browser agree.
  const [timeZone, setTimeZone] = useState(() => browserTimeZone());
  const [step, setStep] = useState<Step>("time");
  const [slot, setSlot] = useState<Slot | null>(null);
  const [form, setForm] = useState({ name: "", email: "", note: "" });
  const [fieldError, setFieldError] = useState<{ name?: string; email?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [result, setResult] = useState<{ token: string; booking: GuestBooking } | null>(null);

  useEffect(() => {
    getPublicPage(slug).then(
      (p) => {
        setPage(p);
        if (p.meetingTypes.length === 1) setTypeId(p.meetingTypes[0].id);
      },
      (err) => {
        const unavailable = err instanceof ApiError && err.status === 404;
        setLoadError({ title: unavailable ? "This booking page isn't available" : "We couldn't load this page", text: unavailable ? "The link may be wrong, or the page has been switched off. Check with whoever sent it." : "Please try again in a moment." });
      },
    );
  }, [slug]);

  const type = page?.meetingTypes.find((t) => t.id === typeId) ?? null;
  // A new function when the page, type, zone or a refresh changes, which is what makes the picker load again.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback((from: string, days: number) => publicSlots(slug, typeId!, from, days, timeZone), [slug, typeId, timeZone, refresh]);
  const zones = useMemo(() => timeZoneChoices(timeZone), [timeZone]);

  function chooseSlot(s: Slot) {
    setSlot(s);
    setNotice(null);
    setStep("details");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!type || !slot) return;
    const errs: typeof fieldError = {};
    if (!form.name.trim()) errs.name = "Please enter your name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim())) errs.email = "That email address doesn't look right.";
    setFieldError(errs);
    if (errs.name || errs.email) return;
    setSubmitting(true);
    setFormError(null);
    try {
      const r = await createPublicBooking(slug, { typeId: type.id, start: slot.start, guestName: form.name, guestEmail: form.email, guestTimezone: timeZone, note: form.note });
      setResult({ token: r.manageToken, booking: r.booking });
      setStep("done");
    } catch (err) {
      if (err instanceof ApiError && err.code === "slot_unavailable") {
        // Keep everything they typed; only the time has to be chosen again.
        setSlot(null);
        setStep("time");
        setRefresh((n) => n + 1);
        setNotice("That time was just taken. Please choose another. Your details are saved.");
      } else {
        setFormError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      }
    }
    setSubmitting(false);
  }

  if (loadError) {
    return (
      <div role="alert" className="mx-auto max-w-md py-16 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">{loadError.title}</h1>
        <p className="mt-2 text-muted">{loadError.text}</p>
      </div>
    );
  }
  if (!page) return <div aria-hidden className="mx-auto max-w-3xl animate-pulse space-y-4 py-10"><div className="h-8 w-64 rounded bg-border" /><div className="h-64 rounded-xl bg-border/50" /></div>;

  if (step === "done" && result) {
    return (
      <div className="mx-auto max-w-xl py-10">
        <BookingSummary booking={result.booking} token={result.token} timeZone={timeZone} />
        <p className="mt-6 text-sm"><Link href={`/manage/${result.token}`} className="font-medium text-accent hover:underline">Change or cancel this booking</Link></p>
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-4xl gap-8 py-10 md:grid-cols-[18rem_1fr]">
      <aside className="space-y-4">
        {page.hostName && <p className="text-sm text-muted">{page.hostName}</p>}
        <h1 className="text-2xl font-semibold tracking-tight">{page.title}</h1>
        {page.description && <p className="whitespace-pre-line text-sm text-muted">{page.description}</p>}

        {type && (
          <dl className="space-y-2 rounded-xl border border-border bg-surface p-4 text-sm" aria-label="Your selection">
            <div><dt className="text-muted">Meeting</dt><dd className="font-medium">{type.name}</dd></div>
            <div className="flex items-center gap-2"><Clock aria-hidden className="h-4 w-4 text-muted" /><dd>{type.durationMin} minutes</dd></div>
            {slot && (
              <div>
                <dt className="text-muted">When</dt>
                <dd className="font-medium">{formatDay(slot.start, timeZone)}, {formatTime(slot.start, timeZone)} to {formatTime(slot.end, timeZone)}</dd>
              </div>
            )}
            <div><dt className="text-muted">Your time zone</dt><dd>{timeZone.replace(/_/g, " ")} ({zoneLabel(timeZone)})</dd></div>
          </dl>
        )}
      </aside>

      <div className="min-w-0 space-y-5">
        {notice && <p role="status" className="rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">{notice}</p>}

        {!type ? (
          <section aria-labelledby="pick-type">
            <h2 id="pick-type" className="text-sm font-medium">What would you like to book?</h2>
            <ul className="mt-3 space-y-2">
              {page.meetingTypes.map((t) => (
                <li key={t.id}>
                  <button type="button" onClick={() => setTypeId(t.id)} className="w-full rounded-xl border border-border p-4 text-left hover:bg-surface">
                    <span className="block font-medium">{t.name}</span>
                    <span className="block text-sm text-muted">{t.durationMin} minutes{t.description ? ` · ${t.description}` : ""}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : step === "time" ? (
          <section aria-label="Choose a time" className="space-y-4">
            <label className="block text-sm">
              <span className="text-muted">Show times in</span>
              <select value={timeZone} onChange={(e) => { setTimeZone(e.target.value); setSlot(null); }} className={input}>
                {zones.map((z) => <option key={z} value={z}>{z.replace(/_/g, " ")}</option>)}
              </select>
            </label>
            <SlotPicker load={load} timeZone={timeZone} selected={slot?.start ?? null} onPick={chooseSlot} />
            {page.meetingTypes.length > 1 && <button type="button" onClick={() => { setTypeId(null); setSlot(null); }} className="text-sm text-muted hover:text-foreground">&larr; Choose a different meeting</button>}
          </section>
        ) : (
          <form onSubmit={submit} noValidate aria-label="Your details" className="space-y-4">
            <h2 className="text-lg font-semibold">Your details</h2>
            <label className="block text-sm">
              <span className="font-medium">Name</span>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoComplete="name" maxLength={100} aria-invalid={!!fieldError.name} aria-describedby={fieldError.name ? "err-name" : undefined} className={input} />
              {fieldError.name && <span id="err-name" className="mt-1 block text-danger">{fieldError.name}</span>}
            </label>
            <label className="block text-sm">
              <span className="font-medium">Email</span>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="email" maxLength={254} aria-invalid={!!fieldError.email} aria-describedby={fieldError.email ? "err-email" : undefined} className={input} />
              {fieldError.email && <span id="err-email" className="mt-1 block text-danger">{fieldError.email}</span>}
            </label>
            <label className="block text-sm">
              <span className="font-medium">Anything to share? <span className="font-normal text-muted">(optional)</span></span>
              <textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} maxLength={500} rows={3} className={input} />
            </label>
            {formError && <p role="alert" className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">{formError}</p>}
            <div className="flex flex-wrap items-center gap-3">
              <button type="submit" disabled={submitting} className="inline-flex min-h-9 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-accent-solid px-4 text-sm font-medium text-on-accent transition-colors hover:brightness-95 active:brightness-90 disabled:pointer-events-none disabled:opacity-50">
                {submitting && <Loader2 aria-hidden className="h-4 w-4 animate-spin" />}
                {submitting ? "Checking availability…" : "Confirm booking"}
              </button>
              <button type="button" disabled={submitting} onClick={() => setStep("time")} className="text-sm text-muted hover:text-foreground">&larr; Choose another time</button>
            </div>
            <p className="text-xs text-muted">We only use your details to make this booking.</p>
          </form>
        )}
      </div>
    </div>
  );
}
