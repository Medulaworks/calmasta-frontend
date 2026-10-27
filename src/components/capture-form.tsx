"use client";

import {useCapturePolicy} from "@/hooks/use-capture-policy";
import { Video } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { captureStatus, timeAgo } from "@/lib/status";
import {
  type CaptureListItem,
  PLATFORM_LABELS,
  cancelMeetingCapture,
  isMeetingActive,
  listCaptures,
  requestMeetingCapture,
} from "@/lib/upload-client";

export function CaptureForm() {
  // Arriving from a calendar event: the meeting link is filled in, but consent is still the user's to give.
  const search = useSearchParams();
  const [url, setUrl] = useState(() => search.get("link") ?? "");
  const [consent, setConsent] = useState(false);
  const {policy,policyError}=useCapturePolicy();
  const [durationMinutes,setDurationMinutes]=useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [items, setItems] = useState<CaptureListItem[] | null>(null);

  // Bumping `tick` re-fetches the list; polling and user actions both just bump it.
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    listCaptures(50, "meetings").then(
      (all) => {
        if (!cancelled) setItems(all);
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
      await requestMeetingCapture(url, consent, undefined, false, {maxDurationSeconds:Math.min(Math.round(durationMinutes*60),policy?.maxMeetingDurationSeconds??0)});
      setNotice(`Request queued for ${policy?.botName??"the recording assistant"}. ${policy?.liveProcessingEnabled?"It may need to be admitted by the host.":"Recording will start when processing becomes available."}`);
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
    <div className="grid items-start gap-6 lg:grid-cols-5">
      <div className="space-y-4 lg:col-span-2">
        <Card>
          <CardHeader title="Capture a meeting" />
          <form onSubmit={submit} className="space-y-4 p-5">
            <label className="block text-sm">
              <span className="font-medium">Meeting link</span>
              <input
                type="url"
                required
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://meet.google.com/abc-defg-hij"
                autoComplete="off"
                spellCheck={false}
                className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2"
              />
              <span className="mt-1.5 block text-xs text-muted">Google Meet, Microsoft Teams or Zoom.</span>
            </label>
            {policy?.meetingEnabled&&<label className="block text-sm">Maximum recording minutes<input type="number" min={0.5} step={0.5} max={policy.maxMeetingDurationSeconds/60} required value={Math.min(durationMinutes,policy.maxMeetingDurationSeconds/60)} onChange={e=>setDurationMinutes(Number(e.target.value))} className="mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2"/></label>}
            <p className="text-xs text-muted">This capture records audio. Video recording is not available.</p>
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                I have the right to record this meeting and I will tell its participants. A visible assistant named
                “{policy?.botName??"Recording assistant"}” will join and may need to be admitted by the host.
              </span>
            </label>
            <Button type="submit" variant="primary" className="w-full" disabled={busy || !consent || !url.trim() || !policy?.meetingEnabled}>
              <Video aria-hidden className="h-4 w-4" /> {busy ? "Sending…" : "Send assistant"}
            </Button>
            <p className="text-xs text-muted">Mojooba never bypasses waiting rooms or host controls.</p>
            {(!policy||!policy.meetingEnabled)&&<p role="status" className="text-xs text-muted">{policyError??(policy?"Meeting capture is not enabled for this account yet.":"Loading capture limits…")}</p>}
          </form>
        </Card>

        {notice && (
          <p role="status" className="rounded-lg border border-border bg-surface px-4 py-3 text-sm">
            {notice}
          </p>
        )}
        {error && (
          <p role="alert" className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
            {error}
          </p>
        )}
      </div>

      <Card className="lg:col-span-3">
        <CardHeader title="Your meeting captures" id="history-heading" action={items && items.length > 0 ? <span className="text-xs tabular-nums text-muted">{items.length}</span> : undefined} />
        {items === null ? (
          <ul aria-hidden className="divide-y divide-border">
            {[0, 1, 2].map((i) => (
              <li key={i} className="flex items-center gap-3 px-5 py-3">
                <span className="h-9 w-9 animate-pulse rounded-lg bg-border" />
                <span className="h-3 w-1/3 animate-pulse rounded bg-border" />
              </li>
            ))}
          </ul>
        ) : items.length === 0 ? (
          <EmptyState icon={<Video />} title="No meetings yet" body="Paste a meeting link and the assistant will join, record and write it up. Your captured meetings are listed here." />
        ) : (
          <ul aria-labelledby="history-heading" className="divide-y divide-border">
            {items.map((c) => {
              const st = captureStatus({ source: c.source, state: c.state, status: c.status });
              return (
                <li key={c.id} className="flex items-center gap-2 pr-5 transition-colors hover:bg-surface">
                  <Link href={`/captures/${c.id}`} className="flex min-w-0 flex-1 items-start gap-3 py-3 pl-5">
                    <span aria-hidden className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-surface text-muted">
                      <Video className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{c.title ?? "Meeting"}</span>
                      <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                        <Badge tone={st.tone} active={st.active}>
                          {st.label}
                        </Badge>
                        <span>{c.platform ? PLATFORM_LABELS[c.platform] : "Meeting"} · {timeAgo(c.createdAt)}</span>
                      </span>
                      {c.status === "failed" && c.failureReason && <span className="mt-1 block text-xs text-danger">{c.failureReason}</span>}
                    </span>
                  </Link>
                  {isMeetingActive(c.status) && (
                    <Button size="sm" onClick={() => void cancel(c.id)}>
                      Cancel
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
