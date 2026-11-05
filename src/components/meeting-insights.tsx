"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "./ui/button";
import { Card, CardHeader } from "./ui/card";
import { ApiError } from "../lib/upload-client";
import { formatDuration } from "../lib/audio";
import { meetingInsightsQuery, meetingPreferencesQuery, qk } from "../lib/queries";
import { meetingInsightMutationOptions, meetingPreferencesMutationOptions } from "../lib/meeting-insights-queries";
import { canRequestInsight, emailStatusMessage, insightErrorMessage, insightMessage, questionStartMs } from "../lib/meeting-insights";
import type { InsightArtifact, InsightKind, MeetingInsights as Insights, QuestionsResult, RecapResult, StructuredRecapResult, MeetingMetadata } from "../lib/meeting-insights-client";

function InsightError({ error }: { error: unknown }) {
  if (!error) return null;
  return <p role="alert" className="text-sm text-danger">
    {insightErrorMessage(error)} {error instanceof ApiError && error.status === 401 && <Link href="/auth/login" className="underline">Sign in</Link>}
  </p>;
}
function SummaryList({title,items}:{title:string;items:string[]}) {
  return <section className="space-y-2">
    <h4 className="font-semibold">{title}</h4>
    {items.length?<ul className="list-disc space-y-2 pl-5">{items.map((item,index)=><li key={index} className="whitespace-pre-wrap break-words">{item}</li>)}</ul>:<p className="text-muted">None identified.</p>}
  </section>;
}
function StructuredRecap({result,meeting}:{result:StructuredRecapResult;meeting?:MeetingMetadata}) {
  const owners=Array.from(new Set(result.actionItems.map(action=>action.owner)));
  const recorded=meeting?new Date(meeting.recordedAt):null;
  return <article className="space-y-6">
    {meeting&&<header className="space-y-2 border-b border-border pb-4">
      <h4 className="text-lg font-semibold">{meeting.title}{recorded&&Number.isFinite(recorded.getTime())&&<> — <time dateTime={meeting.recordedAt}>{recorded.toLocaleDateString("en",{month:"long",day:"numeric",year:"numeric",timeZone:"UTC"})}</time></>}</h4>
      <Link href={meeting.recordingPath} className="text-accent underline underline-offset-4">View recording</Link>
    </header>}
    <section className="space-y-2"><h4 className="font-semibold">Meeting Purpose</h4><p className="whitespace-pre-wrap break-words">{result.meetingPurpose}</p></section>
    <SummaryList title="Key Takeaways" items={result.highlights}/>
    <section className="space-y-4">
      <h4 className="font-semibold">Topics</h4>
      {result.topics.length?result.topics.map((topic,index)=><section className="space-y-2" key={index}>
        <h5 className="font-medium">{topic.title}</h5>
        <ul className="list-disc space-y-2 pl-5">{topic.points.map((point,i)=><li className="whitespace-pre-wrap break-words" key={i}>{point.text}{point.details.length>0&&<ul className="mt-2 list-[circle] space-y-1 pl-5">{point.details.map((detail,j)=><li key={j}>{detail}</li>)}</ul>}</li>)}</ul>
      </section>):<p className="text-muted">No distinct topics identified.</p>}
    </section>
    {result.technicalNotes.length>0&&<SummaryList title="Technical & Admin Notes" items={result.technicalNotes}/>}
    {result.decisions.length>0&&<SummaryList title="Decisions" items={result.decisions}/>}
    <section className="space-y-4">
      <h4 className="font-semibold">Next Steps</h4>
      {owners.length?owners.map(owner=><section className="space-y-2" key={owner??"unassigned"}>
        <h5 className="font-medium">{owner??"Owner not specified"}</h5>
        <ul className="list-disc space-y-2 pl-5">{result.actionItems.filter(action=>action.owner===owner).map((action,index)=><li className="whitespace-pre-wrap break-words" key={index}>{action.task}{action.due&&<span className="text-muted"> — {action.due}</span>}</li>)}</ul>
      </section>):<p className="text-muted">No next steps identified.</p>}
    </section>
  </article>;
}
function Recap({ result,meeting }: { result: RecapResult;meeting?:MeetingMetadata }) {
  if(result.formatVersion===2)return <StructuredRecap result={result} meeting={meeting}/>;
  return <div className="space-y-4">
    <p className="whitespace-pre-wrap break-words">{result.briefSummary}</p>
    <details className="rounded-lg border border-border p-3">
      <summary className="cursor-pointer font-medium">Detailed recap</summary>
      <p className="mt-3 whitespace-pre-wrap break-words">{result.detailedSummary}</p>
    </details>
    {([ ["Highlights", result.highlights], ["Decisions", result.decisions], ["Next steps", result.nextSteps] ] as const).map(([label, items]) => <div key={label}>
      <h4 className="font-medium">{label}</h4>
      {items.length ? <ul className="mt-1 list-disc space-y-1 pl-5">{items.map((text, i) => <li className="whitespace-pre-wrap break-words" key={i}>{text}</li>)}</ul> : <p className="mt-1 text-muted">None identified.</p>}
    </div>)}
  </div>;
}
function Questions({ result, audioAvailable, onSeek }: { result: QuestionsResult; audioAvailable: boolean; onSeek: (ms: number) => void }) {
  return <div className="space-y-3">
    <p className="text-xs text-muted">Questions are quoted from the redacted transcript. AI extraction is not guaranteed to find every question.</p>
    {result.questions.length ? <ul className="space-y-3">{result.questions.map((question, i) => {
      const startMs = questionStartMs(question);
      return <li className="rounded-lg border border-border p-3" key={i}>
        <p className="whitespace-pre-wrap break-words">{question.text}</p>
        {audioAvailable && startMs !== null && <Button size="sm" variant="ghost" className="mt-2" aria-label={`Seek audio to ${formatDuration(startMs / 1000)}`} onClick={() => onSeek(startMs)}>{formatDuration(startMs / 1000)} · Listen</Button>}
      </li>;
    })}</ul> : <p className="text-muted">No questions were found in this extraction.</p>}
  </div>;
}
function InsightSection({ id, kind, data, readFailed, audioAvailable, onSeek }: {
  id: string; kind: InsightKind; data: Insights; readFailed: boolean; audioAvailable: boolean; onSeek: (ms: number) => void;
}) {
  const qc = useQueryClient();
  const request = useMutation(meetingInsightMutationOptions(qc, id, kind));
  const artifact = data[kind];
  const canRequest = !readFailed && canRequestInsight(data, kind);
  const label = kind === "recap"
    ? artifact?.isStale ? "Generate current recap" : artifact?.state === "blocked" ? "Retry recap admission" : "Generate recap"
    : artifact?.isStale ? "Extract questions from current transcript" : artifact?.state === "blocked" ? "Retry question admission" : "Extract meeting questions";
  return <section className="space-y-3" aria-label={kind === "recap" ? "Meeting recap" : "Meeting questions"}>
    <h3 className="font-medium">{kind === "recap" ? "Meeting recap" : "Meeting questions"}</h3>
    {artifact?.isStale && <p className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm">Based on an older transcript or summary format. Review this content against the current transcript.</p>}
    {artifact ? <>
      <p role="status" className="text-muted">{insightMessage(artifact)}</p>
      {artifact.state === "ready" && artifact.result && (kind === "recap"
        ? <Recap result={(artifact as InsightArtifact<RecapResult>).result!} meeting={data.meeting} />
        : <Questions result={(artifact as InsightArtifact<QuestionsResult>).result!} audioAvailable={audioAvailable} onSeek={onSeek} />)}
      {artifact.state === "ready" && !artifact.result && <p className="text-muted">Refresh insights to load the result.</p>}
      {kind === "recap" && emailStatusMessage[artifact.emailStatus] && <p className="text-xs text-muted">{emailStatusMessage[artifact.emailStatus]}</p>}
    </> : <p className="text-muted">{kind === "recap" ? "No recap has been requested for this meeting." : "Extract questions when you need them."}</p>}
    <InsightError error={request.error} />
    {canRequest && <Button disabled={request.isPending} onClick={() => request.mutate()}>{request.isPending ? "Requesting…" : label}</Button>}
  </section>;
}
function EmailPreference() {
  const qc = useQueryClient();
  const query = useQuery(meetingPreferencesQuery);
  const save = useMutation(meetingPreferencesMutationOptions(qc));
  const prefs = query.data;
  const eligible = prefs?.emailVerified && prefs.canReceiveRecapEmail;
  return <section className="space-y-2 border-t border-border pt-4" aria-label="Recap email preference">
    <h3 className="font-medium">Recap completion email</h3>
    {query.isPending && <p role="status" className="text-muted">Loading email preference…</p>}
    <InsightError error={query.error ?? save.error} />
    {query.isError && <Button size="sm" onClick={() => void query.refetch()}>Retry email preference</Button>}
    {eligible && <label className="flex items-center gap-3">
      <input type="checkbox" role="switch" checked={prefs.recapEmailEnabled} disabled={save.isPending || query.isError} onChange={event => save.mutate(event.currentTarget.checked)} className="h-4 w-4 accent-accent" />
      Email me when a new meeting recap is complete
    </label>}
    {prefs && !eligible && <p className="text-muted">Only the verified workspace owner can opt in to recap emails.</p>}
    {save.isPending && <p role="status" className="text-muted">Saving email preference…</p>}
    <p className="text-xs text-muted">Opt-in applies to future recap completions across your meetings. Email contains a private app link, with no meeting content or attachments, and goes only to the verified owner. Enabling it does not resend previous recaps.</p>
  </section>;
}
export function MeetingInsights({ id, transcriptVersion, audioAvailable, onSeek }: {
  id: string; transcriptVersion: number | null; audioAvailable: boolean; onSeek: (ms: number) => void;
}) {
  const qc = useQueryClient();
  const query = useQuery(meetingInsightsQuery(id));
  // A newly available or edited transcript can queue an automatic recap on the backend.
  // This is a read invalidation only; question extraction is always a button mutation.
  useEffect(() => { void qc.invalidateQueries({ queryKey: qk.meetingInsights(id) }); }, [id, transcriptVersion, qc]);
  const raw = query.data;
  const currentVersion = Math.max(raw?.transcriptVersion ?? 0, transcriptVersion ?? 0);
  const data = raw ? {
    ...raw,
    transcriptReady: raw.transcriptReady && raw.transcriptVersion === currentVersion,
    recap: raw.recap ? { ...raw.recap, isStale: raw.recap.isStale || raw.recap.transcriptVersion < currentVersion } : null,
    questions: raw.questions ? { ...raw.questions, isStale: raw.questions.isStale || raw.questions.transcriptVersion < currentVersion } : null,
  } : undefined;
  return <Card>
    <CardHeader title="Meeting insights" action={<Button size="sm" variant="ghost" disabled={query.isFetching} onClick={() => void query.refetch()}>Refresh insights</Button>} />
    <div className="space-y-6 p-5 text-sm">
      {query.isPending && <p role="status" className="text-muted">Loading meeting insights…</p>}
      <InsightError error={query.error} />
      {data && !data.enabled && <p role="status" className="text-muted">Meeting insights are currently unavailable. Your recording and transcript remain usable.</p>}
      {data?.enabled && !data.liveProcessingEnabled && <p role="status" className="text-muted">Insight processing is paused. Queued work cannot run until the service owner enables processing.</p>}
      {data?.enabled && !data.transcriptReady && <p className="text-muted">Waiting for the current transcript before requesting insights.</p>}
      {data && <>
        <p className="text-xs text-muted">AI-generated insights may contain mistakes. Review them against the transcript before using them. Next steps are not added to your actions automatically.</p>
        <InsightSection key={`recap:${currentVersion}`} id={id} kind="recap" data={data} readFailed={query.isError} audioAvailable={audioAvailable} onSeek={onSeek} />
        <InsightSection key={`questions:${currentVersion}`} id={id} kind="questions" data={data} readFailed={query.isError} audioAvailable={audioAvailable} onSeek={onSeek} />
      </>}
      <EmailPreference />
    </div>
  </Card>;
}
