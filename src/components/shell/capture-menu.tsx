"use client";

import {
  CalendarPlus,
  CalendarDays,
  ChevronDown,
  Link2,
  Mail,
  Upload,
  Video,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { useDismiss } from "@/components/ui/use-dismiss";
import { requestMeetingCapture } from "@/lib/upload-client";

// Where each calendar opens its "new event" page. MyJooba doesn't write to either calendar: the person schedules the
// meeting there as usual, and it then shows up under Calendar once their calendar is connected.
const GOOGLE_NEW_EVENT = "https://calendar.google.com/calendar/r/eventedit";
const OUTLOOK_NEW_EVENT =
  "https://outlook.office.com/calendar/0/deeplink/compose?path=%2Fcalendar%2Faction%2Fcompose&rru=addevent";

const PLATFORMS = ["Google Meet", "Zoom", "Microsoft Teams"];

/** "Add to live meeting": paste a link, say you may record, and a visible assistant joins. */
function LiveMeetingDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [namedByMe, setNamedByMe] = useState(false);
  const [title, setTitle] = useState("");
  const [consent, setConsent] = useState(false);
  const [video, setVideo] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ duplicate: boolean } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await requestMeetingCapture(
        url,
        consent,
        namedByMe ? title : undefined,
        video,
      );
      setDone({ duplicate: r.duplicate });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog title="Add to live meeting" onClose={onClose}>
      {done ? (
        <div className="space-y-4 text-sm" role="status">
          <p className="text-base font-medium">
            {done.duplicate
              ? "An assistant is already set up for this meeting."
              : "Request sent."}
          </p>
          <p className="text-muted">
            {done.duplicate
              ? "No second one was sent."
              : "The assistant will join as “MyJooba Assistant”. The host may need to let it in, and nothing is recorded until they do."}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                router.push("/dashboard/capture");
              }}
              className="rounded-lg bg-accent-solid px-4 py-2 font-medium text-on-accent hover:opacity-90">
              See it under Capture
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-border px-4 py-2 font-medium hover:bg-surface">
              Done
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-5">
          <label className="block text-sm">
            <span className="font-medium">Meeting link</span>
            <span className="relative mt-2 block">
              <Link2
                aria-hidden
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
              />
              <input
                type="url"
                required
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Paste a meeting URL to record"
                autoComplete="off"
                spellCheck={false}
                className="h-11 w-full rounded-lg border border-border bg-background pl-10 pr-3 text-base"
              />
            </span>
          </label>

          <div className="flex flex-wrap items-start gap-3">
            <label className="text-sm">
              <span className="sr-only">Title</span>
              <select
                value={namedByMe ? "mine" : "auto"}
                onChange={(e) => setNamedByMe(e.target.value === "mine")}
                className="rounded-lg border border-border bg-surface px-3 py-2 text-sm">
                <option value="auto">Auto-generated title</option>
                <option value="mine">Choose a title</option>
              </select>
            </label>
            {namedByMe && (
              <label className="min-w-[12rem] flex-1 text-sm">
                <span className="sr-only">Meeting title</span>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={120}
                  placeholder="Quarterly planning"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2"
                />
              </label>
            )}
          </div>

          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={video}
              onChange={(e) => setVideo(e.target.checked)}
              className="mt-1 h-4 w-4 accent-[var(--accent-solid)]"
            />
            <span>
              <span className="font-medium">Also record the video</span>
              <span className="mt-0.5 block text-xs text-muted">
                Off unless you choose it. Private to you, and removed on the
                same schedule as audio.
              </span>
            </span>
          </label>

          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-1 h-4 w-4 accent-[var(--accent-solid)]"
            />
            <span>
              I have the right to record this meeting
              {video ? ", including its video," : ""}, and I will tell its
              participants. A visible assistant named “MyJooba Assistant” will
              join and may need to be admitted by the host.
            </span>
          </label>

          {error && (
            <p
              role="alert"
              className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="text-sm">
              <p className="flex flex-wrap items-center gap-1.5 text-muted">
                Works with{" "}
                {PLATFORMS.map((p) => (
                  <span
                    key={p}
                    className="rounded-full bg-surface px-2 py-0.5 text-xs ring-1 ring-inset ring-border">
                    {p}
                  </span>
                ))}
              </p>
              <p className="mt-1.5 text-xs text-muted">
                It never bypasses waiting rooms or host controls.
              </p>
            </div>
            <button
              type="submit"
              disabled={busy || !consent || !url.trim()}
              className="inline-flex min-h-10 items-center justify-center rounded-lg bg-accent-solid px-6 text-sm font-medium text-on-accent transition-colors hover:brightness-95 disabled:pointer-events-none disabled:opacity-50">
              {busy ? "Sending…" : "Start capture"}
            </button>
          </div>
        </form>
      )}
    </Dialog>
  );
}

/** "Schedule new meeting": choose where to schedule it. MyJooba never edits the calendar itself. */
function ScheduleDialog({ onClose }: { onClose: () => void }) {
  const opt =
    "flex w-full items-center justify-center gap-3 rounded-xl border border-border bg-surface/50 px-4 py-4 text-base font-medium transition-colors hover:bg-surface";
  return (
    <Dialog title="Schedule meeting" onClose={onClose} width="max-w-xl">
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
          Outlook isn&rsquo;t connected to Jooba yet, so for an Outlook
          meeting paste its link into{" "}
          <span className="font-medium">Add to live meeting</span> when it
          starts.
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
    "flex min-h-9 w-full items-center gap-3 rounded-lg px-3 text-left text-sm transition-colors hover:bg-surface focus-visible:bg-surface";
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
          className="flex h-9 items-center gap-2 rounded-l-lg bg-accent-solid px-3.5 text-sm font-medium text-on-accent transition-colors hover:brightness-95 sm:px-4">
          <Video aria-hidden className="h-[18px] w-[18px]" />{" "}
          <span className="hidden sm:inline">Capture</span>
          <span className="sr-only sm:hidden">Capture a live meeting</span>
        </button>
        <button
          ref={trigger}
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label="More ways to capture"
          className="grid h-9 w-9 place-items-center rounded-r-lg border-l border-on-accent/20 bg-accent-solid text-on-accent transition-colors hover:brightness-95">
          <ChevronDown
            aria-hidden
            className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>
        {open && (
          <div
            ref={panel}
            role="menu"
            aria-label="Capture"
            onKeyDown={onKeyDown}
            className="absolute right-0 top-full z-40 mt-2 w-60 rounded-xl border border-border bg-background p-1 text-foreground shadow-xl">
            <button
              type="button"
              role="menuitem"
              onClick={() => choose("live")}
              className={item}>
              <Video aria-hidden className="h-4 w-4 text-muted" /> Add to live
              meeting
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => choose("schedule")}
              className={item}>
              <CalendarPlus aria-hidden className="h-4 w-4 text-muted" />{" "}
              Schedule new meeting
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => choose("upload")}
              className={item}>
              <Upload aria-hidden className="h-4 w-4 text-muted" /> Upload audio
            </button>
            <div role="separator" className="my-1 border-t border-border" />
            <Link
              href="/dashboard/capture"
              role="menuitem"
              onClick={close}
              className={`${item} text-muted`}>
              See your captures
            </Link>
          </div>
        )}
      </div>
      {dialog === "live" && <LiveMeetingDialog onClose={closeDialog} />}
      {dialog === "schedule" && <ScheduleDialog onClose={closeDialog} />}
    </>
  );
}
