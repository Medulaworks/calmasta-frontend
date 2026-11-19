import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MeetingInsights } from "./meeting-insights";
import { qk } from "../lib/queries";
import type { MeetingInsights as Insights, InsightArtifact, RecapResult, QuestionsResult } from "../lib/meeting-insights-client";
const { buttons, inputs } = vi.hoisted(()=>({buttons:[] as ComponentProps<"button">[],inputs:[] as ComponentProps<"input">[]}));
vi.mock("./ui/button",()=>({Button:(props:ComponentProps<"button">)=>{buttons.push(props);return createElement("button",props);}}));
const recap: RecapResult={briefSummary:"<script>quoted overview</script>",detailedSummary:"Detailed recap",highlights:["Highlight"],decisions:["Decision"],nextSteps:["Follow-up"]};
const artifact=<T,>(result:T,state:InsightArtifact<T>["state"]="ready",isStale=false):InsightArtifact<T>=>({id:"a",state,isStale,result,transcriptVersion:1,failureReason:null,emailStatus:"unknown",updatedAt:"2026-11-03T00:00:00Z"});
const base: Insights={captureId:"m",transcriptVersion:1,transcriptReady:true,enabled:true,liveProcessingEnabled:true,autoRecapEnabled:true,questionsOnDemand:true,recap:null,questions:null};
const clients:QueryClient[]=[];
function render(data:Insights=base, prefs={recapEmailEnabled:false,emailVerified:true,canReceiveRecapEmail:true}, onSeek=vi.fn()){
 const qc=new QueryClient();clients.push(qc);qc.setQueryData(qk.meetingInsights("m"),data);qc.setQueryData(qk.meetingPreferences(),prefs);
 const html=renderToStaticMarkup(createElement(QueryClientProvider,{client:qc},createElement(MeetingInsights,{id:"m",transcriptVersion:1,audioAvailable:true,onSeek})));
 return {html,qc,onSeek};
}
beforeEach(()=>{buttons.length=0;inputs.length=0;vi.stubGlobal("fetch",vi.fn());});
afterEach(()=>{clients.forEach(q=>q.clear());clients.length=0;vi.unstubAllGlobals();});
it("renders absent artifacts without automatically generating questions or recap",()=>{
 const {html}=render();expect(html).toContain("Generate recap");expect(html).toContain("Extract meeting questions");expect(fetch).not.toHaveBeenCalled();
});
it("renders escaped brief first, longer recap and independent lists with an AI review note",()=>{
 const {html}=render({...base,recap:artifact(recap)});
 expect(html).toContain("&lt;script&gt;");expect(html).not.toContain("<script>");expect(html).toContain("Detailed recap");expect(html.indexOf("quoted overview")).toBeLessThan(html.indexOf("Detailed recap"));
 for(const text of ["Highlight","Decision","Follow-up","Review","not sure"])expect(html).toContain(text);
});
it("handles a valid empty question result and states extraction is not exhaustive",()=>{
 const {html}=render({...base,questions:artifact<QuestionsResult>({coverage:"ai_extraction_not_guaranteed_exhaustive",questions:[]})});
 expect(html).toContain("No questions were found");expect(html).toContain("not guaranteed");
});
it("marks old content stale and offers the current version",()=>{
 const {html}=render({...base,recap:artifact(recap,"ready",true)});expect(html).toContain("older transcript");expect(html).toContain("Generate current recap");
});
it.each(["blocked","failed","reconciliation_required"] as const)("renders %s honestly without automatic generation",state=>{
 const {html}=render({...base,recap:artifact(recap,state)});expect(fetch).not.toHaveBeenCalled();expect(html).not.toContain("quoted overview");
 expect(html.includes("Retry recap admission")).toBe(state==="blocked");
});
it("suppresses requests when the feature is disabled",()=>{
 const {html}=render({...base,enabled:false});expect(html).toContain("unavailable");expect(html).not.toContain("Generate recap");expect(html).not.toContain("Extract meeting questions");
});
it("shows paused processing without offering generation",()=>{
 const {html}=render({...base,liveProcessingEnabled:false,recap:artifact(recap,"queued")});expect(html).toContain("paused");expect(html).not.toContain("Generate recap");
});
it("offers email opt-in only to eligible verified owners",()=>{
 expect(render().html).toContain('role="switch"');
 expect(render(base,{recapEmailEnabled:false,emailVerified:true,canReceiveRecapEmail:false}).html).not.toContain('role="switch"');
 expect(render(base,{recapEmailEnabled:false,emailVerified:false,canReceiveRecapEmail:true}).html).not.toContain('role="switch"');
});
it("extracts questions only after the explicit button handler runs",async()=>{
 vi.stubGlobal("fetch",vi.fn().mockResolvedValue(Response.json({id:"a",state:"queued",failureReason:null},{status:202})));
 render();expect(fetch).not.toHaveBeenCalled();
 const button=buttons.find(b=>b.children==="Extract meeting questions")!;expect(button).toBeDefined();
 button.onClick?.({} as never);await vi.waitFor(()=>expect(fetch).toHaveBeenCalledOnce());
 expect(fetch).toHaveBeenCalledWith("/api/captures/m/questions",expect.objectContaining({method:"POST"}));
});
it("question timestamp invokes the audio seek handler; missing timestamps have no seek button",()=>{
 const {onSeek}=render({...base,questions:artifact<QuestionsResult>({coverage:"ai_extraction_not_guaranteed_exhaustive",questions:[{text:"When?",sources:[{segmentId:"s",startMs:12000,endMs:15000,speakerId:null}]},{text:"Who?",sources:[]}]})});
 const links=buttons.filter(b=>b["aria-label"]?.startsWith("Seek audio"));expect(links).toHaveLength(1);links[0].onClick?.({} as never);expect(onSeek).toHaveBeenCalledWith(12000);
});
it("uses newer insights as authoritative when the completed capture cache is older",()=>{
 const {html}=render({...base,transcriptVersion:2,recap:{...artifact(recap),transcriptVersion:2}});
 expect(html).not.toContain("older transcript");expect(html).not.toContain("Waiting for the current transcript");expect(html).toContain("Extract meeting questions");
});
it("shows finished empty state when transcript is completed with no speech",()=>{
 const {html}=render({...base,transcriptVersion:1,transcriptReady:false});
 expect(html).toContain("No speech was detected in this recording.");
 expect(html).not.toContain("Waiting for the current transcript");
 expect(html).not.toContain("Generate recap");
});
it("shows waiting message when transcript is pending and has no transcript version",()=>{
 const qc=new QueryClient();clients.push(qc);qc.setQueryData(qk.meetingInsights("m"),{...base,transcriptVersion:null,transcriptReady:false});qc.setQueryData(qk.meetingPreferences(),{recapEmailEnabled:false,emailVerified:true,canReceiveRecapEmail:true});
 const html=renderToStaticMarkup(createElement(QueryClientProvider,{client:qc},createElement(MeetingInsights,{id:"m",transcriptVersion:null,audioAvailable:true,onSeek:vi.fn()})));
 expect(html).toContain("Waiting for the current transcript before requesting insights.");
 expect(html).not.toContain("No speech was detected in this recording.");
});

it("renders structured meeting notes with trusted metadata, nested topics and owner-grouped actions",()=>{
 const summary={...recap,formatVersion:2 as const,meetingPurpose:"Review launch blockers.",topics:[{title:"Quota issue",points:[{text:"Demo blocked <script>",details:["Fix individual quotas."]}]}],technicalNotes:["Configure telemetry."],actionItems:[{owner:"Josiah",task:"Fix the quota.",due:"tomorrow"},{owner:"Josiah",task:"Review the fix.",due:null},{owner:null,task:"Investigate deployment.",due:null}]};
 const {html}=render({...base,meeting:{title:"Team Stand-Up",recordedAt:"2026-11-05T09:00:00Z",recordingPath:"/dashboard/captures/m#recording-audio"},recap:artifact(summary)});
 for(const value of ["Team Stand-Up","View recording","Meeting purpose","Key takeaways","Topics","Quota issue","Fix individual quotas.","Technical and admin notes","Next steps","Josiah","tomorrow","Owner not specified"])expect(html).toContain(value);
 expect(html).toContain('href="/dashboard/captures/m#recording-audio"');expect(html).toContain("&lt;script&gt;");expect(html).not.toContain("<script>");expect(html).not.toContain("Detailed recap");
 expect((html.match(/<h5[^>]*>Josiah<\/h5>/g)??[])).toHaveLength(1);expect(fetch).not.toHaveBeenCalled();
});

it("non-meeting entries offer explicit AI Notes generation and omit meeting email preferences", async () => {
 const qc=new QueryClient();clients.push(qc);qc.setQueryData(qk.meetingInsights("m"),base);
 vi.mocked(fetch).mockResolvedValue(Response.json({id:"a",state:"queued"},{status:202}));
 const html=renderToStaticMarkup(createElement(QueryClientProvider,{client:qc},createElement(MeetingInsights,{id:"m",transcriptVersion:1,audioAvailable:false,onSeek:vi.fn(),isMeeting:false})));
 expect(html).toContain("AI Notes"); expect(html).toContain("Generate AI Notes"); expect(html).not.toContain("Meeting insights"); expect(html).not.toContain("Recap completion email"); expect(fetch).not.toHaveBeenCalled();
 buttons.find(b=>b.children==="Generate AI Notes")!.onClick?.({} as never);
 await vi.waitFor(()=>expect(fetch).toHaveBeenCalled()); expect(fetch).toHaveBeenCalledWith("/api/captures/m/recap",expect.objectContaining({method:"POST"}));
});

it("shows independent ready artifacts beside a summary that needs attention without dispatching",()=>{
 const held={...artifact<RecapResult|null>(null,"reconciliation_required"),failureReason:"insight_provider_http_429"};
 const {html}=render({...base,recap:held,questions:artifact<QuestionsResult>({coverage:"ai_extraction_not_guaranteed_exhaustive",questions:[{text:"When can we launch?",sources:[]}]})});
 expect(html).toContain('aria-label="Artifact status"');
 expect(html).toContain("Transcript: Ready");expect(html).toContain("Meeting Summary: Needs attention");expect(html).toContain("Questions: Ready");
 expect(html).toContain("When can we launch?");expect(html).toContain("rate limit");expect(html).toContain("Contact support");
 expect(html).not.toContain("looking into");expect(fetch).not.toHaveBeenCalled();
 expect(buttons.some(b=>b.children==="Generate recap"||b.children==="Retry recap admission")).toBe(false);
});
