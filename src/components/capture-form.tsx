"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  type CaptureListItem,
  PLATFORM_LABELS,
  cancelMeetingCapture,
  isMeetingActive,
  listCaptures,
  requestMeetingCapture,
  statusLabel,
} from "@/lib/upload-client";

export function CaptureForm() {
  // Arriving from a calendar event: the meeting link is filled in, but consent is still the user's to give.
  const search = useSearchParams();
  const [url, setUrl] = useState(() => search.get("link") ?? "");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [items, setItems] = useState<CaptureListItem[] | null>(null);

  // Bumping `tick` re-fetches the list; polling and user actions both just bump it.
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    listCaptures().then(
      (all) => {
        if (!cancelled) setItems(all.filter((c) => c.source === "meeting_url"));
      },
      (err) => {
        if (cancelled) return;
        setItems((prev) => prev ?? []);
        setError(err instanceof Error ? err.message : "Could not load your captures.");
      },
    );
    return () => {
      cancelled = true;
    };
  }, [tick]);

  // Keep status fresh while any meeting is still in flight.
  const anyActive = items?.some((c) => isMeetingActive(c.status)) ?? false;
  useEffect(() => {
    if (!anyActive) return;
    const id = setInterval(refresh, 3000);
    return () => clearInterval(id);
  }, [anyActive, refresh]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const result = await requestMeetingCapture(url, consent);
      setNotice(
        result.duplicate
          ? "A CalMasta assistant is already set up for this meeting, so no second one was sent."
          : "Request sent. The assistant will join as “CalMasta Assistant”.",
      );
      setUrl("");
      setConsent(false);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function cancel(id: string) {
    setError(null);
    try {
      await cancelMeetingCapture(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not cancel.");
    }
    refresh();
  }

  return (
    <div className="max-w-2xl space-y-6">
      <form onSubmit={submit} className="space-y-4 rounded-lg border border-border p-5">
        <h2 className="font-medium">Capture a meeting</h2>
        <label className="block text-sm">
          <span className="font-medium">Meeting link</span>
          <input
            type="url"
            required
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://meet.google.com/…  ·  Teams  ·  Zoom"
            autoComplete="off"
            spellCheck={false}
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2"
          />
        </label>
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-1 h-4 w-4"
          />
          <span>
            I have the right to record this meeting, and I will tell its participants. A visible assistant named
            “CalMasta Assistant” will join and may need to be admitted by the host.
          </span>
        </label>
        <button
          type="submit"
          disabled={busy || !consent || !url.trim()}
          className="rounded-md bg-accent-solid px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Sending…" : "Send assistant"}
        </button>
        <p className="text-xs text-muted">
          Supports Google Meet, Microsoft Teams and Zoom links. CalMasta never bypasses waiting rooms or host
          controls.
        </p>
      </form>

      {notice && (
        <p role="status" className="rounded-md border border-border bg-surface px-3 py-2 text-sm">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {error}
        </p>
      )}

      <section aria-labelledby="history-heading" className="space-y-2">
        <h2 id="history-heading" className="font-medium">
          Your meeting captures
        </h2>
        {items === null && <p className="text-sm text-muted">Loading…</p>}
        {items?.length === 0 && <p className="text-sm text-muted">Nothing yet. Paste a meeting link above to start.</p>}
        <ul className="space-y-2">
          {items?.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 rounded-lg border border-border px-4 py-3 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium">{c.title ?? "Meeting"}</p>
                <p className="text-xs text-muted">
                  {c.platform ? PLATFORM_LABELS[c.platform] : "Meeting"} · {statusLabel(c.status)}
                </p>
                {c.status === "failed" && c.failureReason && (
                  <p className="mt-1 text-xs text-red-700 dark:text-red-300">{c.failureReason}</p>
                )}
              </div>
              {isMeetingActive(c.status) && (
                <button
                  type="button"
                  onClick={() => void cancel(c.id)}
                  className="shrink-0 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-surface"
                >
                  Cancel
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
