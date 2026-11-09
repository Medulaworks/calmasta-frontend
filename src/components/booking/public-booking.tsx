"use client";

import { SkeletonGuest } from "@/components/ui/skeleton";
import { ArrowLeft, CalendarDays, Clock, Globe, Loader2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BookingSummary } from "@/components/booking/booking-summary";
import { SlotPicker, timeZoneChoices } from "@/components/booking/slot-picker";
import { type GuestBooking, type PublicPage, type Slot, createPublicBooking, getPublicPage, publicSlots } from "@/lib/booking-client";
import { browserTimeZone, formatDay, formatTime, zoneLabel } from "@/lib/tz";
import { ApiError } from "@/lib/upload-client";

type Step = "time" | "details" | "done";

const input = "mt-2 block w-full min-h-10 rounded-xl border border-border bg-background px-4 py-2 text-sm shadow-sm placeholder:text-muted focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent-solid/20";

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
      <div role="alert" className="mx-auto max-w-md py-20 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">{loadError.title}</h1>
        <p className="mt-2 text-muted">{loadError.text}</p>
      </div>
    );
  }
  if (!page) return <SkeletonGuest label="Loading booking page" />;

  if (step === "done" && result) {
    return (
      <div className="mx-auto max-w-xl py-10">
        <div className="jb-rise rounded-2xl border border-border bg-background p-5 shadow-lg sm:p-6">
          <BookingSummary booking={result.booking} token={result.token} timeZone={timeZone} />
          <p className="mt-6 border-t border-border pt-4 text-sm"><Link href={`/manage/${result.token}`} className="font-medium text-accent hover:underline">Change or cancel this booking</Link></p>
        </div>
      </div>
    );
  }

  const steps = ["Choose a time", "Your details"] as const;
  const current = step === "details" ? 1 : 0;
  return (
    <div className="mx-auto max-w-5xl py-10">
      <div className="jb-rise grid overflow-hidden rounded-2xl border border-border bg-background shadow-lg md:grid-cols-[19rem_1fr]">
        {/* Left: who and what, and the choices made so far. */}
        <aside className="space-y-5 border-b border-border bg-surface/50 p-5 sm:p-6 md:border-b-0 md:border-r">
          <div className="flex items-center gap-3">
            <span aria-hidden className="grid size-10 place-items-center rounded-full bg-accent-solid text-base font-semibold text-on-accent">{(page.hostName || page.title).trim().charAt(0).toUpperCase()}</span>
            {page.hostName && <p className="text-sm font-medium text-muted">{page.hostName}</p>}
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight">{page.title}</h1>
            {page.description && <p className="whitespace-pre-line text-sm text-muted">{page.description}</p>}
          </div>

          <dl className="space-y-3 text-sm" aria-label="Your selection">
            {type && (
              <div className="flex items-start gap-3">
                <Clock aria-hidden className="mt-0.5 size-4 shrink-0 text-muted" />
                <dd><span className="font-medium">{type.name}</span><span className="block text-muted">{type.durationMin} minutes</span></dd>
              </div>
            )}
            {slot && (
              <div className="flex items-start gap-3">
                <CalendarDays aria-hidden className="mt-0.5 size-4 shrink-0 text-accent" />
                <dd className="font-medium">{formatDay(slot.start, timeZone)}<span className="block font-normal text-muted tabular-nums">{formatTime(slot.start, timeZone)} to {formatTime(slot.end, timeZone)}</span></dd>
              </div>
            )}
            <div className="flex items-start gap-3">
              <Globe aria-hidden className="mt-0.5 size-4 shrink-0 text-muted" />
              <dd className="min-w-0 flex-1">
                <label className="block">
                  <span className="sr-only">Show times in</span>
                  <select value={timeZone} onChange={(e) => { setTimeZone(e.target.value); setSlot(null); setStep("time"); }} className="w-full rounded-lg border border-transparent bg-transparent py-1 pr-2 text-sm font-medium hover:border-border focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent-solid/20">
                    {zones.map((z) => <option key={z} value={z}>{z.replace(/_/g, " ")}</option>)}
                  </select>
                </label>
                <span className="block text-xs text-muted">Times shown in {zoneLabel(timeZone)}</span>
              </dd>
            </div>
          </dl>
        </aside>

        {/* Right: the step. */}
        <div className="min-w-0 space-y-5 p-5 sm:p-6">
          {type && (
            <ol aria-label="Progress" className="flex items-center gap-3 text-sm">
              {steps.map((label, i) => (
                <li key={label} aria-current={i === current ? "step" : undefined} className="flex items-center gap-3">
                  <span className={`grid size-6 place-items-center rounded-full text-xs font-semibold ${i < current ? "bg-success text-white" : i === current ? "bg-accent-solid text-on-accent" : "border border-border text-muted"}`}>{i + 1}</span>
                  <span className={i === current ? "font-medium" : "text-muted"}>{label}</span>
                  {i < steps.length - 1 && <span aria-hidden className="h-px w-8 bg-border" />}
                </li>
              ))}
            </ol>
          )}

          {notice && <p role="status" className="rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">{notice}</p>}

          {!type ? (
            <section aria-labelledby="pick-type">
              <h2 id="pick-type" className="text-lg font-semibold">What would you like to book?</h2>
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {page.meetingTypes.map((t) => (
                  <li key={t.id}>
                    <button type="button" onClick={() => setTypeId(t.id)} className="group h-full w-full rounded-xl border border-border p-4 text-left transition-all hover:-translate-y-px hover:border-accent-solid/50 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
                      <span className="block font-medium">{t.name}</span>
                      <span className="mt-1 flex items-center gap-1.5 text-sm text-muted"><Clock aria-hidden className="size-3.5" />{t.durationMin} minutes</span>
                      {t.description && <span className="mt-2 block text-sm text-muted">{t.description}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : step === "time" ? (
            <section aria-label="Choose a time" className="space-y-4">
              <h2 className="text-lg font-semibold">Select a date and time</h2>
              <SlotPicker load={load} timeZone={timeZone} selected={slot?.start ?? null} onPick={chooseSlot} split />
              {page.meetingTypes.length > 1 && (
                <button type="button" onClick={() => { setTypeId(null); setSlot(null); }} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground"><ArrowLeft aria-hidden className="size-4" /> Choose a different meeting</button>
              )}
            </section>
          ) : (
            <form onSubmit={submit} noValidate aria-label="Your details" className="space-y-5">
              <h2 className="text-lg font-semibold">Your details</h2>
              <label className="block text-sm">
                <span className="font-medium">Name</span>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoComplete="name" maxLength={100} aria-invalid={!!fieldError.name} aria-describedby={fieldError.name ? "err-name" : undefined} className={input} />
                {fieldError.name && <span id="err-name" className="mt-2 block text-danger">{fieldError.name}</span>}
              </label>
              <label className="block text-sm">
                <span className="font-medium">Email</span>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="email" maxLength={254} aria-invalid={!!fieldError.email} aria-describedby={fieldError.email ? "err-email" : undefined} className={input} />
                {fieldError.email && <span id="err-email" className="mt-2 block text-danger">{fieldError.email}</span>}
              </label>
              <label className="block text-sm">
                <span className="font-medium">Anything to share? <span className="font-normal text-muted">(optional)</span></span>
                <textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} maxLength={500} rows={3} className={input} />
              </label>
              {formError && <p role="alert" className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">{formError}</p>}
              <div className="flex flex-wrap items-center gap-3">
                <button type="submit" disabled={submitting} className="inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-accent-solid px-5 text-base font-medium text-on-accent shadow-sm transition-all hover:-translate-y-px hover:shadow-md hover:brightness-95 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50">
                  {submitting && <Loader2 aria-hidden className="size-4 animate-spin" />}
                  {submitting ? "Checking availability…" : "Confirm booking"}
                </button>
                <button type="button" disabled={submitting} onClick={() => setStep("time")} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-muted hover:text-foreground"><ArrowLeft aria-hidden className="size-4" /> Choose another time</button>
              </div>
              <p className="text-xs text-muted">We only use your details to make this booking.</p>
            </form>
          )}
        </div>
      </div>
      <p className="mt-6 text-center text-xs text-muted">Scheduling by Jooba</p>
    </div>
  );
}
