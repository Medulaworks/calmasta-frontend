"use client";
import { ToastStack, useToasts } from "@/components/ui/toast";
import { useMeetingToasts } from "@/hooks/use-meeting-toasts";
import { SkeletonRows } from "@/components/ui/skeleton";

import { useQuery } from "@tanstack/react-query";
import { RefreshCw, Video } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { captureStatus, timeAgo } from "@/lib/status";
import { capturesQuery, capturePolicyQuery } from "@/lib/queries";
import { useRequestMeeting, useCancelMeeting } from "@/lib/mutations";
import {
  type CaptureListItem,
  PLATFORM_LABELS,
  isMeetingActive,
} from "@/lib/upload-client";

export function CaptureForm() {
  // Arriving from a calendar event: the meeting link is filled in, but consent is still the user's to give.
  const search = useSearchParams();
  const [url, setUrl] = useState(() => search.get("link") ?? "");
  const [consent, setConsent] = useState(false);
  const { data: policy, error: policyErrorRaw } = useQuery(capturePolicyQuery);
  const policyError = policyErrorRaw instanceof Error ? policyErrorRaw.message : policyErrorRaw ? String(policyErrorRaw) : null;
  const [durationMinutes] = useState(30);
  const [titleMode, setTitleMode] = useState<"auto" | "mine">("auto");
  const [title, setTitle] = useState("");
  const [botName, setBotName] = useState("");
  const [recordVideo, setRecordVideo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const requestMutation = useRequestMeeting();
  const cancelMutation = useCancelMeeting();

  const captures = useQuery({
    ...capturesQuery(50, "meetings"),
    refetchInterval: (q) => {
      const data = q.state.data as Array<{ source: string; state: string; status: string }> | undefined;
      if (!data) return 8000;
      const hasActive = data.some((c) => {
        if (isMeetingActive(c.status)) return true;
        const st = captureStatus({ source: c.source ?? "meeting_url", state: c.state ?? c.status, status: c.status });
        return st.active;
      });
      return hasActive ? 8000 : false;
    },
  });
  const items = captures.data ?? null;
  const toasts = useToasts();
  useMeetingToasts(items, toasts.push);
  const listError = captures.isError ? (captures.error instanceof Error ? captures.error.message : "Could not load your captures.") : null;
  const filtered = items ? items.filter((c) => !q.trim() || (c.title ?? "").toLowerCase().includes(q.trim().toLowerCase())) : null;

  const busy = requestMutation.isPending;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    try {
      await requestMutation.mutateAsync({
        url,
        consent,
        title: titleMode === "mine" ? title : undefined,
        video: recordVideo,
        botName,
        seconds: Math.min(
          Math.round(durationMinutes * 60),
          policy?.maxMeetingDurationSeconds ?? 0,
        ),
      });
      setNotice(
        `Request queued for ${botName.trim() || policy?.botName || "the recording assistant"}. ${policy?.liveProcessingEnabled ? "It may need to be admitted by the host." : "Recording will start when processing becomes available."}`,
      );
      setUrl("");
      setConsent(false);
      setTitle("");
      setTitleMode("auto");
      setRecordVideo(false);
      setBotName("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again.",
      );
    }
  }

  async function cancel(id: string) {
    setError(null);
    try {
      await cancelMutation.mutateAsync(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not cancel.");
    }
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-5">
      <ToastStack items={toasts.items} onDismiss={toasts.dismiss} />
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
              <span className="mt-1.5 block text-xs text-muted">
                Google Meet, Microsoft Teams or Zoom.
              </span>
            </label>
            <label className="block text-sm">
              <span className="font-medium">Assistant name in the meeting</span>
              <input
                type="text"
                value={botName}
                onChange={(e) => setBotName(e.target.value)}
                maxLength={100}
                placeholder={policy?.botName ?? "CalMasta Notetaker"}
                autoComplete="off"
                aria-describedby="meeting-bot-name-help"
                className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2"
              />
              <span id="meeting-bot-name-help" className="mt-1.5 block text-xs text-muted">
                Leave blank to use {policy?.botName ?? "the default assistant name"}. This is separate from your meeting title.
              </span>
            </label>
            {policy?.meetingEnabled && (
              <label className="block text-sm">
                Maximum recording minutes
                <input
                  type="number"
                  disabled
                  value={30}
                  className="mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2 disabled:cursor-not-allowed disabled:opacity-60"
                  aria-disabled="true"
                />
              </label>
            )}
            <div className="flex flex-wrap items-start gap-3">
              <label className="text-sm">
                <span className="sr-only">Title</span>
                <select
                  value={titleMode}
                  onChange={(e) => setTitleMode(e.target.value as "auto" | "mine")}
                  className="rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                >
                  <option value="auto">Auto-generated title</option>
                  <option value="mine">Choose a title</option>
                </select>
              </label>
              {titleMode === "mine" && (
                <label className="min-w-[12rem] flex-1 text-sm">
                  <span className="sr-only">Meeting title</span>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    maxLength={200}
                    placeholder="Quarterly planning"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2"
                  />
                </label>
              )}
            </div>
            <label className={`flex items-start gap-3 text-sm ${!policy?.videoEnabled ? "opacity-60" : ""}`}>
              <input
                type="checkbox"
                checked={recordVideo}
                onChange={(e) => setRecordVideo(e.target.checked)}
                disabled={!policy?.videoEnabled}
                title={!policy?.videoEnabled ? "Video recording is not enabled for this account yet — see backend doc" : undefined}
                className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent-solid)] disabled:cursor-not-allowed"
              />
              <span>
                <span className="font-medium">Also record the video</span>
                <span className="mt-0.5 block text-xs text-muted">
                  {policy?.videoEnabled ? "Off unless you choose it. Private to you, and removed on the same schedule as audio." : "Video recording is not enabled for this account yet."}
                </span>
              </span>
            </label>
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0"
              />
              <span>
                I have the right to record this meeting{recordVideo ? ", including its video," : ""} and I will tell its
                participants. A visible assistant named “{policy?.botName ?? "Recording assistant"}” will join and may
                need to be admitted by the host.
              </span>
            </label>
            {error && (
              <p
                role="alert"
                className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
                {error}
              </p>
            )}
            <Button
              type="submit"
              variant="primary"
              className="w-full"
              disabled={
                busy || !consent || !url.trim() || !policy?.meetingEnabled
              }>
              <Video aria-hidden className="h-4 w-4" />{" "}
              {busy ? "Sending…" : "Send assistant"}
            </Button>
            <p className="text-xs text-muted">
              MyJooba never bypasses waiting rooms or host controls.
            </p>
            {(!policy || !policy.meetingEnabled) && (
              <p role="status" className="text-xs text-muted">
                {policyError ??
                  (policy
                    ? "Meeting capture is not enabled for this account yet."
                    : "Loading capture limits…")}
              </p>
            )}
          </form>
        </Card>

        {notice && (
          <p
            role="status"
            className="rounded-lg border border-border bg-surface px-4 py-3 text-sm">
            {notice}
          </p>
        )}
        {listError && (
          <p
            role="alert"
            className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
            {listError}
          </p>
        )}
      </div>

      <Card className="lg:col-span-3">
        <CardHeader
          title="Your meeting captures"
          id="history-heading"
          action={
            <span className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void captures.refetch()}
                disabled={captures.isFetching}
                aria-label="Refresh captures"
                title="Refresh"
                className="grid h-7 w-7 place-items-center rounded-md border border-border text-muted transition-colors hover:bg-surface hover:text-foreground disabled:opacity-50">
                <RefreshCw aria-hidden className={`h-3.5 w-3.5 ${captures.isFetching ? "animate-spin" : ""}`} />
              </button>
              {items && items.length > 0 && (
                <span className="text-xs tabular-nums text-muted">{items.length}</span>
              )}
            </span>
          }
        />
        <div className="border-b border-border px-5 py-3">
          <label className="block">
            <span className="sr-only">Search meetings</span>
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by meeting title…"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted"
            />
          </label>
        </div>
        {filtered === null ? (
          <SkeletonRows count={3} label="Loading your meeting captures" />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Video />}
            title={q.trim() ? "No matches" : "No meetings yet"}
            body={q.trim() ? `No meeting titles match “${q.trim()}”.` : "Paste a meeting link and the assistant will join, record and write it up. Your captured meetings are listed here."}
          />
        ) : (
          <ul
            aria-labelledby="history-heading"
            className="divide-y divide-border">
            {filtered.map((c: CaptureListItem) => {
              const st = captureStatus({
                source: c.source,
                state: c.state,
                status: c.status,
              });
              return (
                <li
                  key={c.id}
                  className="flex items-center gap-2 pr-5 transition-colors hover:bg-surface">
                  <Link
                    href={`/dashboard/captures/${c.id}`}
                    className="flex min-w-0 flex-1 items-start gap-3 py-3 pl-5">
                    <span
                      aria-hidden
                      className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-surface text-muted">
                      <Video className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {c.title ?? "Meeting"}
                      </span>
                      <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                        <Badge tone={st.tone} active={st.active} indicator={st.indicator}>
                          {st.label}
                        </Badge>
                        <span className="inline-flex items-center gap-1.5">
                          {c.platform ? (
                            <>
                              <Image src={c.platform === "microsoft_teams" ? "/icons/icons8-teams-96.png" : c.platform === "zoom" ? "/icons/icons8-zoom-96.png" : "/icons/icons8-google-meet-96.png"} alt={PLATFORM_LABELS[c.platform] ?? c.platform} width={16} height={16} className="h-4 w-4 shrink-0" />
                              {PLATFORM_LABELS[c.platform] ?? c.platform}
                            </>
                          ) : c.source === "meeting_url" ? (
                            <>
                              <Image src="/icons/icons8-google-meet-96.png" alt="Meet" width={16} height={16} className="h-4 w-4 shrink-0" />
                              Meet
                            </>
                          ) : (
                            "Meeting"
                          )}{" "}
                          · {timeAgo(c.createdAt)}
                        </span>
                      </span>
                      {c.status === "failed" && c.failureReason && (
                        <span className="mt-1 block text-xs text-danger">
                          {c.failureReason}
                        </span>
                      )}
                    </span>
                  </Link>
                  {isMeetingActive(c.status) && (
                    <Button size="sm" onClick={() => void cancel(c.id)} disabled={cancelMutation.isPending}>
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
