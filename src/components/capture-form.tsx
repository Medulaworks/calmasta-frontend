"use client";
import { CaptureTile, PLATFORM_NAME, PlatformLogo, meetingPlatform, platformKey } from "@/components/ui/platform-logo";
import { useDisplayTitle } from "@/components/shell/use-display-title";
import { RowStatus } from "@/components/dashboard/item-row";
import { defaultBotName } from "@/lib/brand";
import { playSound } from "@/lib/sounds";
import { ToastStack, useToasts } from "@/components/ui/toast";
import { useMeetingToasts } from "@/hooks/use-meeting-toasts";
import { SkeletonRows } from "@/components/ui/skeleton";

import { useQuery } from "@tanstack/react-query";
import { Check, ChevronDown, RefreshCw, Search, ShieldCheck, Square, Video } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { captureStatus, timeAgo } from "@/lib/status";
import { capturesQuery, capturePolicyQuery } from "@/lib/queries";
import { useRequestMeeting, useCancelMeeting } from "@/lib/mutations";
import {
  type CaptureListItem,
  isMeetingActive,
} from "@/lib/upload-client";

const STAGES = ["Joining", "Waiting to be let in", "Recording", "Processing"] as const;
/** How far along a live meeting is: 0 joining, 1 waiting, 2 recording, 3 processing. */
function stageOf(c: { state?: string; status: string }): number {
  const v = c.state || c.status;
  if (v === "waiting_for_admission") return 1;
  if (v === "recording") return 2;
  if (["processing", "processing_audio", "transcribing", "recorded", "media_pending"].includes(v)) return 3;
  return 0;
}

export function CaptureForm() {
  // Arriving from a calendar event: the meeting link is filled in, but consent is still the user's to give.
  const search = useSearchParams();
  const [url, setUrl] = useState(() => search.get("link") ?? "");
  const [consent, setConsent] = useState(false);
  const { data: policy, error: policyErrorRaw } = useQuery(capturePolicyQuery);
  const policyError =
    policyErrorRaw instanceof Error
      ? policyErrorRaw.message
      : policyErrorRaw
        ? String(policyErrorRaw)
        : null;
  const [durationMinutes] = useState(30);
  const [titleMode, setTitleMode] = useState<"auto" | "mine">("auto");
  const [title, setTitle] = useState("");
  const [botName, setBotName] = useState("");
  const [recordVideo, setRecordVideo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const titleOf = useDisplayTitle();
  const requestMutation = useRequestMeeting();
  const cancelMutation = useCancelMeeting();

  const captures = useQuery({
    ...capturesQuery(50, "meetings"),
    refetchInterval: (q) => {
      const data = q.state.data as
        | Array<{ source: string; state: string; status: string }>
        | undefined;
      if (!data) return 8000;
      const hasActive = data.some((c) => {
        if (isMeetingActive(c.status)) return true;
        const st = captureStatus({
          source: c.source ?? "meeting_url",
          state: c.state ?? c.status,
          status: c.status,
        });
        return st.active;
      });
      return hasActive ? 8000 : false;
    },
  });
  const items = captures.data ?? null;
  const toasts = useToasts();
  useMeetingToasts(items, toasts.push);
  const listError = captures.isError
    ? captures.error instanceof Error
      ? captures.error.message
      : "Could not load your captures."
    : null;
  const isLive = (c: CaptureListItem) => isMeetingActive(c.status) || captureStatus({ source: c.source, state: c.state, status: c.status }).active;
  const live = items ? items.filter(isLive) : [];
  const filtered = items
    ? items.filter((c) => !isLive(c)).filter(
        (c) =>
          !q.trim() ||
          (c.title ?? "").toLowerCase().includes(q.trim().toLowerCase()),
      )
    : null;

  const busy = requestMutation.isPending;
  const submitting = useRef(false);
  const detected = platformKey(url.trim() || null, url);
  const assistant = botName.trim() || defaultBotName(policy?.botName) || policy?.botName || "Recording assistant";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if(submitting.current)return;
    submitting.current=true;
    setError(null);
    setNotice(null);
    try {
      const result=await requestMutation.mutateAsync({
        url,
        consent,
        title: titleMode === "mine" ? title : undefined,
        video: recordVideo,
        botName: botName.trim() || defaultBotName(policy?.botName) || undefined,
        seconds: Math.min(
          Math.round(durationMinutes * 60),
          policy?.maxMeetingDurationSeconds === null ? Infinity : policy?.maxMeetingDurationSeconds ?? 0,
        ),
      });
      setNotice(
        result.duplicate ? "An assistant is already set up for this meeting. No second one was sent." : `Request queued for ${botName.trim() || defaultBotName(policy?.botName) || policy?.botName || "the recording assistant"}. ${policy?.liveProcessingEnabled ? "It may need to be admitted by the host." : "Recording will start when processing becomes available."}`,
      );
      playSound("sent");
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
    } finally {submitting.current=false;}
  }

  async function cancel(id: string) {
    setError(null);
    try {
      await cancelMutation.mutateAsync(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not cancel.");
    }
  }

  const field = "w-full rounded-xl border border-border bg-background px-4 text-sm shadow-sm placeholder:text-muted focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent-solid/20";
  const past = filtered;
  // With a meeting live and nothing in the past, the empty "past meetings" card is just noise.
  const showPast = past === null || past.length > 0 || !!q.trim() || live.length === 0;
  const blocker = !policy?.meetingEnabled ? null : !url.trim() ? "Add a meeting link to continue." : !consent ? "Confirm you have the right to record to continue." : null;
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <ToastStack items={toasts.items} onDismiss={toasts.dismiss} />

      {/* Left: the one task. The two halves are the same width and the same height. */}
      <div className="min-w-0">
        <Card className="h-full">
          <CardHeader title="Send an assistant" />
          <form onSubmit={submit} className="space-y-5 p-5" noValidate={false}>
            <div>
              <label htmlFor="meeting-link" className="text-sm font-medium">Meeting link <span aria-hidden className="text-danger">*</span></label>
              <div className="relative mt-2">
                {detected && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"><PlatformLogo platform={detected} size={28} /></span>}
                <input
                  id="meeting-link"
                  type="url"
                  required
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="Paste your meeting link"
                  autoComplete="off"
                  spellCheck={false}
                  autoFocus={search.get("focus") === "link"}
                  aria-describedby="meeting-link-help"
                  className={`${field} min-h-11 ${detected ? "pl-14" : ""}`}
                />
              </div>
              <p id="meeting-link-help" className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-muted">
                {detected ? (
                  <span className="font-medium text-success">{PLATFORM_NAME[detected]} link detected</span>
                ) : url.trim().length > 8 ? (
                  <span>We could not tell which app this link is for. Use a Meet, Teams or Zoom link.</span>
                ) : (
                  <>
                    <span>Works with</span>
                    {(["google_meet", "microsoft_teams", "zoom"] as const).map((p) => (
                      <span key={p} className="inline-flex items-center gap-1.5"><PlatformLogo platform={p} size={20} />{PLATFORM_NAME[p]}</span>
                    ))}
                  </>
                )}
              </p>
            </div>

            <details className="group rounded-xl border border-border">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors hover:bg-surface [&::-webkit-details-marker]:hidden">
                More options
                <ChevronDown aria-hidden className="size-4 text-muted transition-transform duration-200 group-open:rotate-180" />
              </summary>
              <div className="space-y-4 border-t border-border p-4">
                <div>
                  <label htmlFor="bot-name" className="text-sm font-medium">Assistant name</label>
                  <input id="bot-name" type="text" value={botName} onChange={(e) => setBotName(e.target.value)} maxLength={100} placeholder={defaultBotName(policy?.botName) ?? policy?.botName ?? "Jooba Notetaker"} autoComplete="off" aria-describedby="meeting-bot-name-help" className={`${field} mt-2 min-h-10`} />
                  <p id="meeting-bot-name-help" className="mt-2 text-xs text-muted">The name people see when it joins. Leave blank to use {defaultBotName(policy?.botName) ?? policy?.botName ?? "the default"}.</p>
                </div>
                <div>
                  <label htmlFor="title-mode" className="text-sm font-medium">Meeting title</label>
                  <div className="mt-2 flex flex-wrap items-start gap-3">
                    <select id="title-mode" value={titleMode} onChange={(e) => setTitleMode(e.target.value as "auto" | "mine")} className={`${field} min-h-10 w-auto`}>
                      <option value="auto">Auto-generated</option>
                      <option value="mine">Choose a title</option>
                    </select>
                    {titleMode === "mine" && <input aria-label="Meeting title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder="Quarterly planning" className={`${field} min-h-10 min-w-40 flex-1`} />}
                  </div>
                </div>
                {policy?.meetingEnabled && policy.maxMeetingDurationSeconds !== null && (
                  <div>
                    <label htmlFor="max-minutes" className="text-sm font-medium">Maximum recording minutes</label>
                    <input id="max-minutes" type="number" disabled value={30} aria-disabled="true" className={`${field} mt-2 min-h-10 disabled:cursor-not-allowed disabled:opacity-60`} />
                  </div>
                )}
                <label className={`flex items-start gap-3 text-sm ${!policy?.videoEnabled ? "opacity-60" : ""}`}>
                  <input type="checkbox" checked={recordVideo} onChange={(e) => setRecordVideo(e.target.checked)} disabled={!policy?.videoEnabled} title={!policy?.videoEnabled ? "Video recording is not enabled for this account yet — see backend doc" : undefined} className="mt-1 size-4 shrink-0 accent-[var(--accent-solid)] disabled:cursor-not-allowed" />
                  <span>
                    <span className="font-medium">Also record the video</span>
                    <span className="mt-1 block text-xs text-muted">{policy?.videoEnabled ? "Off unless you choose it. Private to you, and removed on the same schedule as audio." : "Video recording is not enabled for this account yet."}</span>
                  </span>
                </label>
              </div>
            </details>

            <label className="flex items-start gap-3 rounded-xl bg-surface p-4 text-sm">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 size-4 shrink-0 accent-[var(--accent-solid)]" />
              <span>I have the right to record this meeting{recordVideo ? ", including its video," : ""} and I will tell its participants. A visible assistant named “{assistant}” will join and may need to be admitted by the host.</span>
            </label>

            {error && <p role="alert" className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>}
            {notice && <p role="status" className="rounded-xl border border-border bg-surface px-4 py-3 text-sm">{notice}</p>}

            <div className="space-y-3">
              <Button type="submit" variant="primary" size="lg" className="w-full" disabled={busy || !consent || !url.trim() || !policy?.meetingEnabled}>
                <Video aria-hidden className="size-5" /> {busy ? "Sending…" : "Send assistant"}
              </Button>
              <p aria-live="polite" className="min-h-4 text-center text-xs text-muted">{blocker}</p>
            </div>

            <p className="flex items-start gap-2 border-t border-border pt-4 text-xs text-muted">
              <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0" />
              <span>
                Jooba never bypasses waiting rooms or host controls.
                {policy?.meetingEnabled && policy.maxMeetingDurationSeconds === null && " There is no recording time limit, and you can stop the assistant from this page."}
                {(!policy || !policy.meetingEnabled) && ` ${policyError ?? (policy ? "Meeting capture is not enabled for this account yet." : "Checking what is available…")}`}
              </span>
            </p>
          </form>
        </Card>
      </div>

      {/* Right: what is happening now, then everything before it. */}
      <div className="flex min-w-0 flex-col gap-5">
        {listError && <p role="alert" className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">{listError}</p>}

        {live.length > 0 && (
          <section aria-label="Live now" className="space-y-3">
            {live.map((c) => {
              const st = captureStatus({ source: c.source, state: c.state, status: c.status });
              const recording = st.indicator === "recording";
              const stage = stageOf(c);
              return (
                <article key={c.id} className={`jb-rise rounded-2xl border bg-background p-5 shadow-sm ${recording ? "border-danger/40" : "border-accent-solid/40"}`}>
                  <div className="flex items-center gap-4">
                    <Link href={`/dashboard/captures/${c.id}`} className="flex min-w-0 flex-1 items-center gap-4">
                      <CaptureTile kind="meeting" platform={c.platform} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{titleOf({ title: c.title, kind: "meeting", at: c.createdAt })}</span>
                        <span className="block truncate text-xs text-muted">{PLATFORM_NAME[meetingPlatform(c.platform)]} · started {timeAgo(c.createdAt)}</span>
                      </span>
                    </Link>
                    <RowStatus status={st} />
                    <Button size="sm" onClick={() => void cancel(c.id)} disabled={cancelMutation.isPending}>
                      <Square aria-hidden className="size-3.5 fill-current" /> {recording ? "Stop" : "Cancel"}
                    </Button>
                  </div>
                  <ol aria-label="Progress" className="mt-6 grid grid-cols-4 gap-2">
                    {STAGES.map((label, i) => {
                      const done = i < stage, current = i === stage;
                      const tone = recording ? "bg-danger-solid" : "bg-accent-solid";
                      return (
                        <li key={label} aria-current={current ? "step" : undefined}>
                          <span className="block h-1.5 overflow-hidden rounded-full bg-border">
                            <span className={`block h-full rounded-full ${done ? `${tone} w-full` : current ? `${tone} w-full animate-pulse motion-reduce:animate-none` : "w-0"}`} />
                          </span>
                          <span className={`mt-2 flex items-center gap-1 text-xs ${current ? "font-medium text-foreground" : "text-muted"}`}>
                            {done && <Check aria-hidden className="size-3 text-success" strokeWidth={3} />}{label}
                          </span>
                        </li>
                      );
                    })}
                  </ol>
                </article>
              );
            })}
          </section>
        )}

        {showPast && (
          <Card className="flex-1">
            <CardHeader
              title="Your meetings"
              id="history-heading"
              action={
                <span className="flex items-center gap-3">
                  {past && past.length > 0 && <span className="text-xs font-medium tabular-nums text-muted">{past.length}</span>}
                  <button type="button" onClick={() => void captures.refetch()} disabled={captures.isFetching} aria-label="Refresh meetings" title="Refresh" className="grid size-9 place-items-center rounded-lg border border-border text-muted transition-colors hover:bg-surface hover:text-foreground disabled:opacity-50">
                    <RefreshCw aria-hidden className={`size-4 ${captures.isFetching ? "animate-spin motion-reduce:animate-none" : ""}`} />
                  </button>
                </span>
              }
            />
            {items && items.length > 3 && (
              <div className="border-b border-border px-5 py-3">
                <label className="relative block">
                  <span className="sr-only">Search meetings</span>
                  <Search aria-hidden className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted" />
                  <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by title" className={`${field} min-h-10 pl-11`} />
                </label>
              </div>
            )}
            {past === null ? (
              <SkeletonRows count={3} label="Loading your meetings" />
            ) : past.length === 0 ? (
              <EmptyState
                icon={<Video />}
                title={q.trim() ? "No matches" : "No meetings yet"}
                body={q.trim() ? `No meeting titles match “${q.trim()}”.` : "Paste a meeting link and the assistant will join, record and write it up. Finished meetings are listed here."}
              />
            ) : (
              <ul aria-labelledby="history-heading" className="divide-y divide-border">
                {past.map((c: CaptureListItem) => {
                  const st = captureStatus({ source: c.source, state: c.state, status: c.status });
                  return (
                    <li key={c.id} className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-surface">
                      <Link href={`/dashboard/captures/${c.id}`} className="flex min-w-0 flex-1 items-center gap-4">
                        <CaptureTile kind="meeting" platform={c.platform} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{titleOf({ title: c.title, kind: "meeting", at: c.createdAt })}</span>
                          <span className="block truncate text-xs text-muted">{PLATFORM_NAME[meetingPlatform(c.platform)]} · {timeAgo(c.createdAt)}</span>
                          {c.status === "failed" && c.failureReason && <span className="mt-1 block text-xs text-danger">{c.failureReason}</span>}
                        </span>
                      </Link>
                      <RowStatus status={st} />
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
