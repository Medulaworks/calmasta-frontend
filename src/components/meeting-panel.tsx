"use client";

import { Clock, TriangleAlert, Video } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import {
  MEETING_OUTCOMES,
  MEETING_STEPS,
  RETRYABLE,
} from "@/lib/meeting-status";
import { timeAgo } from "@/lib/status";
import {
  type CaptureView,
  retryMeeting,
  simulateMeetingStatus,
  simulateVideoReady,
} from "@/lib/upload-client";

const label = (status: string) =>
  MEETING_STEPS.find((s) => s.status === status)?.label ??
  MEETING_OUTCOMES[status]?.title ??
  status;
const time = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

/** What the recording assistant is doing in this meeting, in plain words. Waiting is never shown as recording. */
export function MeetingPanel({
  cap,
  devTools,
  onChanged,
}: {
  cap: CaptureView;
  devTools: boolean;
  onChanged: () => void;
}) {
  const router = useRouter();
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const step = MEETING_STEPS.find((s) => s.status === cap.status);
  const outcome = MEETING_OUTCOMES[cap.status];
  const recording = cap.status === "recording";
  const canRetry = RETRYABLE.includes(cap.status);
  const next = step
    ? MEETING_STEPS[
        MEETING_STEPS.findIndex((s) => s.status === step.status) + 1
      ]
    : undefined;

  async function sendAgain() {
    setBusy(true);
    setError(null);
    try {
      const { captureId } = await retryMeeting(cap.id, consent);
      router.push(`/dashboard/captures/${captureId}`);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not send the assistant again.",
      );
      setBusy(false);
    }
  }
  async function simulateVideo() {
    setError(null);
    try {
      await simulateVideoReady(cap.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not simulate that.");
    }
    onChanged();
  }
  async function simulate(status: string) {
    setError(null);
    try {
      await simulateMeetingStatus(cap.id, status);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not simulate that.");
    }
    onChanged();
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title="Meeting" />
        <div className="space-y-5 p-5 text-sm">
          <div className="flex items-start gap-3">
            <span
              aria-hidden
              className="grid size-10 shrink-0 place-items-center rounded-lg bg-surface text-muted">
              <Video className="h-4 w-4" />
            </span>
            <div>
              <p className="font-medium">Recording assistant</p>
              <p className="text-muted">
                Joins as a visible participant, named so everyone can see it. It
                cannot get in unless the host lets it.
              </p>
            </div>
          </div>

          {recording && (
            <div
              role="status"
              className="flex items-center gap-3 rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-danger">
              <span
                aria-hidden
                className="h-3 w-3 shrink-0 animate-pulse rounded-full bg-danger-solid"
              />
              <p>
                <span className="font-semibold">Recording in progress.</span>{" "}
                {step?.text}
              </p>
            </div>
          )}
          {step && !recording && (
            <div
              role="status"
              className={`flex items-start gap-3 rounded-lg border px-4 py-3 ${cap.status === "waiting_for_admission" ? "border-warning/30 bg-warning/10 text-warning" : "border-border bg-surface"}`}>
              <Clock aria-hidden className="mt-1 h-4 w-4 shrink-0" />
              <p>
                <span className="font-semibold">{step.label}.</span> {step.text}
              </p>
            </div>
          )}
          {outcome && (
            <div
              role="status"
              className={`flex items-start gap-3 rounded-lg border px-4 py-3 ${cap.status === "cancelled" ? "border-border bg-surface" : "border-warning/30 bg-warning/10 text-warning"}`}>
              <TriangleAlert aria-hidden className="mt-1 h-4 w-4 shrink-0" />
              <div>
                <p className="font-semibold">{outcome.title}</p>
                <p className="mt-1">
                  {cap.status === "failed" && cap.failureReason
                    ? cap.failureReason
                    : outcome.text}
                </p>
              </div>
            </div>
          )}

          {cap.events.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
                What happened
              </h3>
              <ol className="mt-3 space-y-3 border-l border-border pl-5">
                {cap.events.map((e, i) => (
                  <li key={`${e.status}-${i}`} className="relative">
                    <span
                      aria-hidden
                      className={`absolute -left-[26px] top-2 h-2 w-2 rounded-full ${e.status === "recording" ? "bg-danger-solid" : "bg-muted"}`}
                    />
                    <p className="font-medium">
                      {label(e.status)}{" "}
                      <span className="ml-1 font-normal text-muted">
                        {time(e.at)} · {timeAgo(e.at)}
                      </span>
                    </p>
                    {e.detail && (
                      <p className="text-xs text-muted">{e.detail}</p>
                    )}
                  </li>
                ))}
                {next && (
                  <li className="relative text-muted">
                    <span
                      aria-hidden
                      className="absolute -left-[26px] top-2 h-2 w-2 rounded-full border border-border bg-background"
                    />
                    <p>Next: {next.label}</p>
                  </li>
                )}
              </ol>
            </div>
          )}

          {canRetry && (
            <div className="space-y-3 rounded-lg border border-border bg-surface p-4">
              <p className="font-medium">Send the assistant again?</p>
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="mt-1 h-4 w-4"
                />
                <span className="text-muted">
                  i have the permission torecord this meeting and will tell its
                  participants. The recording assistant may need the host to
                  admit it again.
                </span>
              </label>
              <Button
                variant="primary"
                disabled={!consent || busy}
                onClick={() => void sendAgain()}>
                {busy ? "Sending…" : "Send assistant again"}
              </Button>
            </div>
          )}
          {error && (
            <p role="alert" className="text-danger">
              {error}
            </p>
          )}
        </div>
      </Card>

      {devTools && (!outcome || cap.recordVideo) && (
        <Card>
          <CardHeader title="Development only" />
          <div className="space-y-3 p-5 text-sm">
            <p className="text-muted">
              No real assistant joins in development. Pretend the meeting
              provider reported a status:
            </p>
            <div className="flex flex-wrap gap-2">
              {[
                "waiting_for_admission",
                "recording",
                "processing",
                "denied",
                "timed_out",
                "failed",
              ].map((s) => (
                <Button
                  key={s}
                  variant="secondary"
                  onClick={() => void simulate(s)}>
                  {label(s)}
                </Button>
              ))}
            </div>
            {cap.recordVideo && (
              <div className="space-y-2 border-t border-border pt-3">
                <p className="text-muted">
                  This meeting asked for video. Pretend the provider says it is
                  ready (the worker, <code>npm run worker</code>, then fetches
                  the sample recording):
                </p>
                <Button
                  variant="secondary"
                  onClick={() => void simulateVideo()}>
                  Video is ready
                </Button>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
