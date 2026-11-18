"use client";

import { defaultBotName } from "@/lib/brand";
import {
  CalendarPlus,
  CalendarDays,
  Check,
  ChevronDown,
  Link2,
  Mail,
  Mic,
  ShieldCheck,
  SlidersHorizontal,
  Upload,
  Video,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import {
  PLATFORM_NAME,
  PlatformLogo,
  platformKey,
} from "@/components/ui/platform-logo";
import { useDismiss } from "@/components/ui/use-dismiss";
import { capturePolicyQuery } from "@/lib/queries";
import { requestMeetingCapture } from "@/lib/upload-client";

// Where each calendar opens its "new event" page. Joobah doesn't write to either calendar: the person schedules the
// meeting there as usual, and it then shows up under Calendar once their calendar is connected.
const GOOGLE_NEW_EVENT = "https://calendar.google.com/calendar/r/eventedit";
const OUTLOOK_NEW_EVENT =
  "https://outlook.office.com/calendar/0/deeplink/compose?path=%2Fcalendar%2Faction%2Fcompose&rru=addevent";

/** "Join a meeting": paste a link, say you may record, and a visible assistant joins. Mirrors the Meet page. */
function LiveMeetingDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const qc = useQueryClient();
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [botName, setBotName] = useState("");
  const [video, setVideo] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ duplicate: boolean; name: string } | null>(
    null,
  );
  const { data: policy } = useQuery(capturePolicyQuery);
  const detected = platformKey(url.trim() || null, url);
  const assistant =
    botName.trim() ||
    defaultBotName(policy?.botName) ||
    policy?.botName ||
    "Recording assistant";
  const blocker = !url.trim()
    ? "Add a meeting link to continue."
    : !consent
      ? "Confirm you have permission to record to continue."
      : null;
  const field =
    "w-full rounded-xl border border-border bg-background px-4 text-sm shadow-sm placeholder:text-muted focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent-solid/20";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError(null);
    try {
      const r = await requestMeetingCapture(
        url,
        consent,
        title.trim() || undefined,
        video,
        {
          botName:
            botName.trim() || defaultBotName(policy?.botName) || undefined,
          maxDurationSeconds: Math.min(
            30 * 60,
            policy?.maxMeetingDurationSeconds ?? 1800,
          ),
        },
      );
      qc.invalidateQueries({ queryKey: ["captures"] });
      setDone({ duplicate: r.duplicate, name: assistant });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return (
    <Dialog title="Join a meeting" onClose={onClose}>
      {done ? (
        <div className="space-y-5 text-center" role="status">
          <span
            aria-hidden
            className="jb-popin mx-auto grid size-14 place-items-center rounded-full bg-success text-white">
            <Check className="size-7" strokeWidth={3} />
          </span>
          <div>
            <p className="text-lg font-semibold">
              {done.duplicate
                ? "An assistant is already set up"
                : "Assistant on its way"}
            </p>
            <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
              {done.duplicate
                ? "No second one was sent for this meeting."
                : `${done.name} joins as a visible participant. The host may need to let it in, and nothing is recorded until they do.`}
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            <Button
              variant="primary"
              onClick={() => {
                onClose();
                router.push("/dashboard/capture");
              }}>
              See it under Meet
            </Button>
            <Button variant="ghost" onClick={onClose}>
              Done
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label htmlFor="join-link" className="text-sm font-medium">
              Meeting link
            </label>
            <div className="relative mt-2">
              <span
                aria-hidden
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2">
                {detected ? (
                  <PlatformLogo platform={detected} size={28} />
                ) : (
                  <Link2 className="ml-1 size-4 text-muted" />
                )}
              </span>
              <input
                id="join-link"
                type="url"
                required
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Paste your meeting link"
                autoComplete="off"
                spellCheck={false}
                aria-describedby="join-link-help"
                className={`${field} min-h-12 pl-14`}
              />
            </div>
            <p
              id="join-link-help"
              className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-muted">
              {detected ? (
                <span className="font-medium text-success">
                  {PLATFORM_NAME[detected]} link detected
                </span>
              ) : url.trim().length > 8 ? (
                <span>
                  We could not tell which app this link is for. Use a Meet,
                  Teams or Zoom link.
                </span>
              ) : (
                <>
                  <span>Works with</span>
                  {(["google_meet", "microsoft_teams", "zoom"] as const).map(
                    (p) => (
                      <span
                        key={p}
                        className="inline-flex items-center gap-1.5">
                        <PlatformLogo platform={p} size={20} />
                        {PLATFORM_NAME[p]}
                      </span>
                    ),
                  )}
                </>
              )}
            </p>
          </div>

          {optionsOpen && (
            <div
              id="join-options"
              className="jb-pop-soft grid gap-4 rounded-xl border border-border p-4 sm:grid-cols-2">
              <div>
                <label htmlFor="join-bot" className="text-sm font-medium">
                  Assistant name
                </label>
                <input
                  id="join-bot"
                  value={botName}
                  onChange={(e) => setBotName(e.target.value)}
                  maxLength={100}
                  placeholder={
                    defaultBotName(policy?.botName) ??
                    policy?.botName ??
                    "Joobah Notetaker"
                  }
                  autoComplete="off"
                  className={`${field} mt-2 min-h-10`}
                />
              </div>
              <div>
                <label htmlFor="join-title" className="text-sm font-medium">
                  Meeting title
                </label>
                <input
                  id="join-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={120}
                  placeholder="Auto-generated"
                  autoComplete="off"
                  className={`${field} mt-2 min-h-10`}
                />
              </div>
              <label
                className={`flex items-start gap-3 text-sm sm:col-span-2 ${!policy?.videoEnabled ? "opacity-60" : ""}`}>
                <input
                  type="checkbox"
                  checked={video}
                  onChange={(e) => setVideo(e.target.checked)}
                  disabled={!policy?.videoEnabled}
                  className="mt-0.5 size-4 shrink-0 accent-[var(--accent-solid)] disabled:cursor-not-allowed"
                />
                <span>
                  <span className="font-medium">Also record the video</span>{" "}
                  <span className="text-muted">
                    {policy?.videoEnabled
                      ? "· private to you, removed on the same schedule as audio"
                      : "· not enabled for this account yet"}
                  </span>
                </span>
              </label>
            </div>
          )}

          <label className="flex items-start gap-3 rounded-xl bg-surface p-4 text-sm">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-1 size-4 shrink-0 accent-[var(--accent-solid)]"
            />
            <span>
              I have permission to record this meeting{video ? ", including its video," : ""} and I will tell the participants. A visible assistant named “{assistant}” will join, and the host may need to let it in.
            </span>
          </label>

          {error && (
            <p
              role="alert"
              className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
              {error}
            </p>
          )}

          <div className="space-y-3">
            <div className="flex gap-3">
              <Button
                type="button"
                variant="secondary"
                size="lg"
                aria-expanded={optionsOpen}
                aria-controls="join-options"
                onClick={() => setOptionsOpen((v) => !v)}>
                <SlidersHorizontal aria-hidden className="size-4" /> Options
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="flex-1"
                disabled={busy || !consent || !url.trim()}>
                <Video aria-hidden className="size-5" />{" "}
                {busy ? "Sending…" : "Join meeting"}
              </Button>
            </div>
            <p
              aria-live="polite"
              className="min-h-4 text-center text-xs text-muted">
              {blocker}
            </p>
          </div>

          <p className="flex items-center gap-2 text-xs text-muted">
            <ShieldCheck aria-hidden className="size-4 shrink-0" /> Never
            bypasses waiting rooms or host controls.
          </p>
        </form>
      )}
    </Dialog>
  );
}

/** "Schedule new meeting": choose where to schedule it. Joobah never edits the calendar itself. */
function ScheduleDialog({ onClose }: { onClose: () => void }) {
  const opt =
    "flex w-full items-center justify-center gap-3 rounded-xl border border-border bg-surface/50 px-4 py-4 text-base font-medium transition-colors hover:bg-surface";
  return (
    <Dialog title="Schedule a meeting" onClose={onClose} width="max-w-xl">
      <div className="space-y-5 text-sm">
        <p className="text-muted">
          Schedule the meeting in your calendar as usual. When it appears under
          Calendar, open it and choose{" "}
          <span className="font-medium text-foreground">
            Send the meeting assistant
          </span>{" "}
          to have it recorded, transcribed and written up. Nothing is recorded
          automatically.
        </p>
        <div className="space-y-3">
          <a
            href={GOOGLE_NEW_EVENT}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onClose}
            className={opt}>
            <CalendarDays aria-hidden className="h-5 w-5 text-accent" /> Google
            Calendar
          </a>
          <a
            href={OUTLOOK_NEW_EVENT}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onClose}
            className={opt}>
            <Mail aria-hidden className="h-5 w-5 text-accent" /> Microsoft
            Outlook
          </a>
        </div>
        <p className="text-xs text-muted">
          Google Calendar events show up under Calendar once you connect it.
          Outlook isn&rsquo;t connected to Joobah yet, so for an Outlook meeting
          paste its link into{" "}
          <span className="font-medium">Join a meeting</span> when it starts.
        </p>
      </div>
    </Dialog>
  );
}

/** The Capture split button in the top bar: the main part adds a live meeting, the arrow opens the other ways in. */
export function CaptureMenu() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [dialog, setDialog] = useState<null | "live" | "schedule">(null);
  const panel = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setOpen(false), []);
  const closeDialog = useCallback(() => setDialog(null), []);
  useDismiss(open, close, panel, trigger);
  useEffect(() => {
    if (open)
      panel.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
  }, [open]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const items = [
      ...(panel.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ??
        []),
    ];
    if (!items.length) return;
    e.preventDefault();
    const i = items.indexOf(document.activeElement as HTMLElement);
    items[
      (i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length
    ].focus();
  }
  const item =
    "flex min-h-10 w-full items-center gap-3 rounded-lg px-4 text-left text-sm transition-colors hover:bg-surface focus-visible:bg-surface";
  const choose = (what: "live" | "schedule" | "upload") => {
    setOpen(false);
    if (what === "upload") router.push("/dashboard/voice");
    else setDialog(what);
  };

  return (
    <>
      <div className="relative flex">
        <button
          type="button"
          onClick={() => setDialog("live")}
          className="flex h-10 items-center gap-2 rounded-l-xl bg-accent-solid px-4 text-sm font-medium text-on-accent shadow-sm transition-all hover:brightness-95 active:brightness-90">
          <Video aria-hidden className="h-5 w-5" />{" "}
          <span className="hidden sm:inline">Join a meeting</span>
          <span className="sr-only sm:hidden">Join a meeting</span>
        </button>
        <button
          ref={trigger}
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label="More ways to start"
          className="grid h-10 w-10 place-items-center rounded-r-xl border-l border-on-accent/20 bg-accent-solid text-on-accent shadow-sm transition-all hover:brightness-95">
          <ChevronDown
            aria-hidden
            className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>
        {open && (
          <div
            ref={panel}
            role="menu"
            aria-label="Start something"
            onKeyDown={onKeyDown}
            className="absolute right-0 top-full z-40 mt-2 w-64 rounded-2xl border border-border bg-background p-2 text-foreground shadow-xl">
            <button
              type="button"
              role="menuitem"
              onClick={() => choose("live")}
              className={item}>
              <Video aria-hidden className="h-5 w-5 text-muted" /> Join a
              meeting
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => choose("schedule")}
              className={item}>
              <CalendarPlus aria-hidden className="h-5 w-5 text-muted" />{" "}
              Schedule a meeting
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => choose("upload")}
              className={item}>
              <Mic aria-hidden className="h-5 w-5 text-muted" /> Record your
              voice
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => choose("upload")}
              className={item}>
              <Upload aria-hidden className="h-5 w-5 text-muted" /> Upload audio
            </button>
            <div role="separator" className="my-1 border-t border-border" />
            <Link
              href="/dashboard/capture"
              role="menuitem"
              onClick={close}
              className={`${item} text-muted`}>
              See your meetings
            </Link>
          </div>
        )}
      </div>
      {dialog === "live" && <LiveMeetingDialog onClose={closeDialog} />}
      {dialog === "schedule" && <ScheduleDialog onClose={closeDialog} />}
    </>
  );
}
