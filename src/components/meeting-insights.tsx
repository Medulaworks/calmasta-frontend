"use client";
import {SummaryToolbar} from "./insights/summary-toolbar";
import {SummaryTemplatePicker} from "./insights/summary-template-picker";
import {TemplateSummaryContent} from "./insights/summary-content";
import {MeetingQuestions} from "./insights/meeting-questions";
import {insightSearch,listenInsightNavigation,readSummaryTemplate,updateInsightUrl} from "../lib/insight-navigation";
import {getMeetingQuestions,requestMeetingInsight,saveInsightViewPreferences,type InsightViewPreferences,type MeetingQuestionsView,type SummaryTemplate} from "../lib/meeting-insights-client";

import {useEffect,useState} from "react";
import { Info, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "./ui/button";
import { Loading, Skeleton, SkeletonLines } from "./ui/skeleton";
import { ApiError } from "../lib/upload-client";
import { meetingInsightsQuery, meetingPreferencesQuery, qk } from "../lib/queries";
import { meetingInsightMutationOptions, meetingPreferencesMutationOptions } from "../lib/meeting-insights-queries";
import { canRequestInsight, emailStatusMessage, insightErrorMessage, insightMessage } from "../lib/meeting-insights";
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
  return <article className="space-y-5">
    {meeting&&<header className="space-y-2 border-b border-border pb-4">
      <h4 className="text-base font-semibold">{meeting.title}{recorded&&Number.isFinite(recorded.getTime())&&<> — <time dateTime={meeting.recordedAt}>{recorded.toLocaleDateString("en",{month:"long",day:"numeric",year:"numeric",timeZone:"UTC"})}</time></>}</h4>
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
  if(result.formatVersion===3)return <TemplateSummaryContent result={result} meeting={meeting}/>;
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
function Questions({result,audioAvailable,onSeek,preferences,expanded=false}:{result:QuestionsResult;audioAvailable:boolean;onSeek:(ms:number)=>void;preferences?:InsightViewPreferences;expanded?:boolean}){
 return <MeetingQuestions result={result} audioAvailable={audioAvailable} onSeek={onSeek} selfSpeakerIds={preferences?.selfSpeakerIds} speakerOptions={preferences?.speakerOptions} expanded={expanded}/>;
}
function InsightSection({ id, kind, data, readFailed, audioAvailable, onSeek,templateId="enhanced",templateName,showToolbar=false,summaryLoading=false }: {
  id: string; kind: InsightKind; data: Insights; readFailed: boolean; audioAvailable: boolean; onSeek: (ms: number) => void;templateId?:string;templateName?:string;showToolbar?:boolean;summaryLoading?:boolean;
}) {
  const qc = useQueryClient();
  const request = useMutation(meetingInsightMutationOptions(qc, id, kind,templateId));
  const artifact = data[kind];
  const canRequest = !readFailed && !summaryLoading && (kind!=="recap"||templateId==="enhanced"||data.summaryTemplatesEnabled) && canRequestInsight(data, kind);
  const label = kind === "questions"&&data.autoQuestionsEnabled&&artifact?.state==="ready"&&artifact.transcriptVersion===data.transcriptVersion&&!(artifact.result as QuestionsResult)?.formatVersion?"Add answers":kind === "recap"
    ? artifact?.isStale ? "Generate current recap" : (artifact?.state === "blocked" || (artifact?.state === "failed" && artifact.failureReason === "insight_dispatch_blocked")) ? "Retry recap admission" : templateId!=="enhanced"?`Generate ${templateName??"summary"}`:"Generate recap"
    : artifact?.isStale ? "Extract questions from current transcript" : (artifact?.state === "blocked" || (artifact?.state === "failed" && artifact.failureReason === "insight_dispatch_blocked")) ? "Retry question admission" : "Extract meeting questions";
  return <section className="space-y-3" aria-label={kind === "recap" ? "Meeting recap" : "Meeting questions"}>
    <h3 className="text-base font-semibold">{kind === "recap" ? "Meeting recap" : "Meeting questions"}</h3>
    {showToolbar&&<SummaryToolbar result={kind==="recap"?(artifact?.result as RecapResult|null)??null:null} meeting={data.meeting} questions={kind==="questions"?(artifact?.result as QuestionsResult|null)??null:data.templates?.find(t=>t.id===templateId)?.appendQuestionAnswers&&data.questions?.state==="ready"&&!data.questions.isStale?data.questions.result:null} templateId={kind==="questions"?"q-and-a":templateId} questionsOnly={kind==="questions"} disabled={readFailed||summaryLoading||artifact?.state!=="ready"||!!artifact?.isStale}/>}
    {(summaryLoading||artifact?.state==="queued"||artifact?.state==="running")&&<div role="status" aria-label={`Generating ${templateName??"insights"}`} className="space-y-3 rounded-lg bg-surface p-4"><p className="text-sm text-muted">Generating {templateName??"meeting insights"}…</p>{[100,85,92].map((width,i)=><div key={i} aria-hidden className="h-3 rounded bg-border motion-safe:animate-pulse" style={{width:`${width}%`}}/>)}</div>}
    {artifact?.isStale && <p className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm">Based on an older transcript or summary format. Review this content against the current transcript.</p>}
    {artifact ? <>
      <p role="status" className="text-muted">{insightMessage(artifact)}</p>
      {artifact.state === "ready" && artifact.result && (kind === "recap"
        ? <Recap result={(artifact as InsightArtifact<RecapResult>).result!} meeting={data.meeting} />
        : <Questions result={(artifact as InsightArtifact<QuestionsResult>).result!} audioAvailable={audioAvailable} onSeek={onSeek} preferences={data.viewPreferences} expanded={showToolbar} />)}
      {artifact.state === "ready" && !artifact.result && <p className="text-muted">Refresh insights to load the result.</p>}
      {kind === "recap" && emailStatusMessage[artifact.emailStatus] && <p className="text-xs text-muted">{emailStatusMessage[artifact.emailStatus]}</p>}
    </> : <p className="text-muted">{kind === "recap" ? "No recap has been requested for this meeting." : "Extract questions when you need them."}</p>}
    {kind==="recap"&&artifact?.state==="ready"&&data.templates?.find(t=>t.id===templateId)?.appendQuestionAnswers&&<section className="space-y-3 border-t border-border pt-5"><h4 className="font-semibold">Q&A</h4>{data.questions?.state==="ready"&&data.questions.result&&!data.questions.isStale?<Questions result={data.questions.result} audioAvailable={audioAvailable} onSeek={onSeek} preferences={data.viewPreferences} expanded/>:<p className="text-muted">{data.questions?.state==="queued"||data.questions?.state==="running"?"Questions and answers are generating…":"Use the questions panel to extract current questions and answers."}</p>}</section>}
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
    {query.isPending && <Loading label="Loading email preference"><SkeletonLines lines={1} /></Loading>}
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
export function MeetingInsights({id,transcriptVersion,audioAvailable,onSeek}:{id:string;transcriptVersion:number|null;audioAvailable:boolean;onSeek:(ms:number)=>void}){
 const qc=useQueryClient();
 const [selection,setSelection]=useState({captureId:id,templateId:"enhanced"});
 const [busy,setBusy]=useState<Record<string,boolean>>({}),[failures,setFailures]=useState<Record<string,string>>({});
 const templateId=selection.captureId===id?selection.templateId:"enhanced",token=`${id}:${templateId}`;
 useEffect(()=>{const sync=()=>setSelection({captureId:id,templateId:readSummaryTemplate(insightSearch())??"enhanced"});sync();return listenInsightNavigation(sync);},[id]);
 const query=useQuery(meetingInsightsQuery(id,templateId)),raw=query.data;
 useEffect(()=>{if(!readSummaryTemplate(insightSearch())&&raw?.viewPreferences?.selectedTemplateId)setSelection({captureId:id,templateId:raw.viewPreferences.selectedTemplateId});},[id,raw?.viewPreferences?.selectedTemplateId]);
 const questionQuery=useQuery({queryKey:qk.meetingQuestions(id),queryFn:({signal})=>getMeetingQuestions(id,signal),enabled:!!raw?.summaryTemplatesEnabled,staleTime:0,retry:0,refetchInterval:q=>q.state.data?.artifact&&["pending","queued","running"].includes(q.state.data.artifact.state)?3000:false,refetchIntervalInBackground:false});
 const saveView=useMutation({mutationFn:(value:Partial<Pick<InsightViewPreferences,"selectedTemplateId"|"selfSpeakerIds">>)=>saveInsightViewPreferences(id,value),scope:{id:`insight-view:${id}`},retry:0,onSuccess:prefs=>{
  qc.setQueriesData<Insights>({queryKey:qk.meetingInsights(id)},value=>value?{...value,viewPreferences:prefs}:value);
  qc.setQueryData<MeetingQuestionsView>(qk.meetingQuestions(id),value=>value?{...value,selfSpeakerIds:prefs.selfSpeakerIds,speakerOptions:prefs.speakerOptions}:value);
 }});
 useEffect(()=>{void qc.invalidateQueries({queryKey:qk.meetingInsights(id)});void qc.invalidateQueries({queryKey:qk.meetingQuestions(id)});},[id,transcriptVersion,qc]);
 const currentVersion=Math.max(raw?.transcriptVersion??0,transcriptVersion??0,questionQuery.data?.transcriptVersion??0),currentQuestions=questionQuery.data?.artifact??raw?.questions;
 const data=raw?{...raw,transcriptReady:raw.transcriptReady&&raw.transcriptVersion===currentVersion,recap:raw.recap?{...raw.recap,isStale:raw.recap.isStale||raw.recap.transcriptVersion<currentVersion}:null,questions:currentQuestions?{...currentQuestions,isStale:currentQuestions.isStale||currentQuestions.transcriptVersion<currentVersion}:null,viewPreferences:raw.viewPreferences?{...raw.viewPreferences,selfSpeakerIds:questionQuery.data?.selfSpeakerIds??raw.viewPreferences.selfSpeakerIds,speakerOptions:questionQuery.data?.speakerOptions??raw.viewPreferences.speakerOptions}:undefined}:undefined;
 const selected=raw?.summary?.templateId===templateId?raw.summary:null;
 const selectedArtifact=selected?.sourceKind==="recap"?selected.artifact:templateId==="enhanced"?data?.recap:null;
 const leftData=data?{...data,recap:selectedArtifact?{...selectedArtifact,isStale:selectedArtifact.isStale||selectedArtifact.transcriptVersion<currentVersion}:null}:undefined;
 const catalogue:SummaryTemplate[]=data?.templates??[{id:"enhanced",revision:1,label:"Enhanced",description:"Purpose, takeaways and next steps.",group:"General",sourceKind:"recap",appendQuestionAnswers:false,enabled:true}];
 const chosen=catalogue.find(t=>t.id===templateId),questionsOnly=chosen?.sourceKind==="questions"||templateId==="q-and-a";
 async function selectTemplate(next:string){
  setSelection({captureId:id,templateId:next});updateInsightUrl({tab:"insights",template:next});if(data?.summaryTemplatesEnabled)saveView.mutate({selectedTemplateId:next});
  const key=`${id}:${next}`;setBusy(state=>({...state,[key]:true}));setFailures(state=>({...state,[key]:""}));
  try{
   const view=await qc.fetchQuery(meetingInsightsQuery(id,next)),artifact=view.summary?.templateId===next?view.summary.artifact:next==="enhanced"?view.recap:null;
   const retry=artifact?.state==="failed"&&artifact.failureReason==="insight_dispatch_blocked";
   if(view.enabled&&view.liveProcessingEnabled&&view.transcriptReady&&(!artifact||artifact.isStale||artifact.state==="blocked"||retry)&&!artifact?.state?.includes("reconciliation")){
    if(artifact&&["queued","running"].includes(artifact.state))return;
    await requestMeetingInsight(id,"recap",next);await Promise.all([qc.invalidateQueries({queryKey:qk.meetingInsights(id)}),qc.invalidateQueries({queryKey:qk.meetingQuestions(id)})]);
   }
  }catch(error){setFailures(state=>({...state,[key]:insightErrorMessage(error)}));}finally{setBusy(state=>({...state,[key]:false}));}
 }
 return <section aria-label="Meeting insights" className="space-y-5 text-sm">
 <div className="flex flex-wrap items-start justify-between gap-3">
 <p className="flex max-w-2xl items-start gap-2 text-xs leading-relaxed text-muted">{data&&<><Info aria-hidden className="mt-0.5 size-3.5 shrink-0"/>AI-generated insights may contain mistakes. Review them against the transcript before using them. Next steps are not added to your actions automatically.</>}</p>
 <Button size="sm" variant="secondary" disabled={query.isFetching} onClick={()=>{void query.refetch();if(data?.summaryTemplatesEnabled)void questionQuery.refetch();}}><RefreshCw aria-hidden className={`size-4 ${query.isFetching?"animate-spin motion-reduce:animate-none":""}`}/>Refresh insights</Button>
 </div>
 {query.isPending&&<Loading label="Loading meeting insights" className="space-y-4"><div className="grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]"><div className="space-y-4 rounded-2xl border border-border p-5"><div className="flex items-center gap-2"><Skeleton className="h-5 w-5 rounded-md" /><Skeleton className="h-5 w-28" /></div><SkeletonLines lines={2} /><Skeleton className="h-24 w-full rounded-lg" /><SkeletonLines lines={3} /></div><div className="space-y-4 rounded-2xl border border-border bg-surface/40 p-5"><Skeleton className="h-5 w-24" /><SkeletonLines lines={3} /><Skeleton className="h-20 w-full rounded-lg" /></div></div></Loading>}<InsightError error={query.error}/>
 {data&&!data.enabled&&<p role="status" className="text-muted">Meeting insights are currently unavailable. Your recording and transcript remain usable.</p>}
 {data?.enabled&&!data.liveProcessingEnabled&&<p role="status" className="text-muted">Insight processing is paused. Queued work cannot run until the service owner enables processing.</p>}
 {data?.enabled&&!data.transcriptReady&&((data.transcriptVersion ?? transcriptVersion) !== null ? <p role="status" className="text-muted">No speech was detected in this recording.</p> : <p className="text-muted">Waiting for the current transcript before requesting insights.</p>)}
 {data&&<>
 <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)] xl:items-start">
 <div className="min-w-0 space-y-5">
 <div className="flex flex-wrap items-center justify-between gap-3"><SummaryTemplatePicker templates={catalogue} value={templateId} onSelect={next=>void selectTemplate(next)}/>{data.activeRecap&&data.activeRecap.templateId!==templateId&&<p role="status" className="text-xs text-muted">{catalogue.find(t=>t.id===data.activeRecap?.templateId)?.label??"Another summary"} is processing.</p>}</div>
 {failures[token]&&<p role="alert" className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{failures[token]}</p>}
 {leftData&&<InsightSection key={`summary:${id}:${templateId}:${currentVersion}`} id={id} kind={questionsOnly?"questions":"recap"} data={leftData} readFailed={query.isError} audioAvailable={audioAvailable} onSeek={onSeek} templateId={templateId} templateName={chosen?.label} showToolbar summaryLoading={!!busy[token]}/>}
 </div>
 <aside className="min-w-0 space-y-4 border-t border-border pt-5 xl:border-l xl:border-t-0 xl:pl-6 xl:pt-0" aria-label="Detected questions">
 <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-base font-semibold">Questions</h3><SummaryToolbar result={null} meeting={data.meeting} questions={data.questions?.result??null} templateId="questions" questionsOnly disabled={questionQuery.isError||data.questions?.state!=="ready"||!!data.questions?.isStale}/></div>
 {data.viewPreferences?.enabled&&data.viewPreferences.speakerOptions.length>0&&<details className="rounded-md border border-border p-3"><summary className="cursor-pointer text-xs font-medium">Mark my speaker(s)</summary><p className="mt-2 text-xs text-muted">Choose your speaker labels to group your questions separately. This does not edit the transcript.</p><div className="mt-2 space-y-2">{data.viewPreferences.speakerOptions.map(s=><label key={s.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={data.viewPreferences!.selfSpeakerIds.includes(s.id)} disabled={saveView.isPending} onChange={e=>saveView.mutate({selfSpeakerIds:e.target.checked?[...data.viewPreferences!.selfSpeakerIds,s.id]:data.viewPreferences!.selfSpeakerIds.filter(id=>id!==s.id)})}/>{s.label}</label>)}</div></details>}
 <InsightError error={questionQuery.error??saveView.error}/><InsightSection key={`questions:${id}:${currentVersion}`} id={id} kind="questions" data={data} readFailed={questionQuery.isError||query.isError} audioAvailable={audioAvailable} onSeek={onSeek}/>
 </aside></div></>}
 <EmailPreference/></section>;
}
