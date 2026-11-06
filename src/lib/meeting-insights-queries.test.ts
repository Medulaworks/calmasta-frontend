import { QueryClient, QueryObserver, MutationObserver } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
import { meetingInsightsQuery, meetingPreferencesQuery, qk } from "./queries";
import { meetingInsightMutationOptions, meetingPreferencesMutationOptions } from "./meeting-insights-queries";
import type { MeetingInsights } from "./meeting-insights-client";
// Enable QueryObserver's client timer path without starting a browser.
vi.hoisted(() => { vi.stubGlobal("window", {}); });
const data: MeetingInsights = {captureId:"m",transcriptVersion:1,transcriptReady:true,enabled:true,liveProcessingEnabled:true,autoRecapEnabled:true,questionsOnDemand:true,recap:null,questions:null};
afterEach(() => vi.unstubAllGlobals());
it("reading insights and preferences never submits generation or email", async () => {
 const fetcher=vi.fn().mockImplementation((url:string)=>Promise.resolve(Response.json(url.includes("preferences")?{recapEmailEnabled:false,emailVerified:true,canReceiveRecapEmail:true}:data)));
 vi.stubGlobal("fetch",fetcher); const qc=new QueryClient();
 await Promise.all([qc.fetchQuery(meetingInsightsQuery("m")),qc.fetchQuery(meetingPreferencesQuery)]);
 expect(fetcher.mock.calls.every(([,init])=>!init.method)).toBe(true); expect(fetcher).toHaveBeenCalledTimes(2); qc.clear();
});
it("unsubscribing aborts an active insight read", async () => {
 let signal:AbortSignal|undefined;
 vi.stubGlobal("fetch",vi.fn((_url,init)=>{signal=init.signal;return new Promise((_resolve,reject)=>signal!.addEventListener("abort",()=>reject(new DOMException("Aborted","AbortError"))));}));
 const qc=new QueryClient(); const observer=new QueryObserver(qc,meetingInsightsQuery("m"));
 const unsubscribe=observer.subscribe(()=>{}); expect(signal?.aborted).toBe(false); unsubscribe(); expect(signal?.aborted).toBe(true); qc.clear();
});
it("explicit POST records actual 202 state, invalidates reads and never retries mutations", async () => {
 const qc=new QueryClient(); qc.setQueryData(qk.meetingInsights("m"),data);
 vi.stubGlobal("fetch",vi.fn().mockResolvedValue(Response.json({id:"a",state:"reconciliation_required",failureReason:null},{status:202})));
 const options=meetingInsightMutationOptions(qc,"m","questions"); expect(options.retry).toBe(0);
 const observer=new MutationObserver(qc,options); await observer.mutate();
 const cached=qc.getQueryData<MeetingInsights>(qk.meetingInsights("m"));
 expect(cached?.questions?.state).toBe("reconciliation_required"); expect(cached?.questions?.result).toBe(null);
 expect(qc.getQueryState(qk.meetingInsights("m"))?.isInvalidated).toBe(true); qc.clear();
});
it("transcript capture invalidation also invalidates insights", async () => {
 const qc=new QueryClient(); qc.setQueryData(qk.meetingInsights("m"),data);
 await qc.invalidateQueries({queryKey:qk.capture("m")});
 expect(qc.getQueryState(qk.meetingInsights("m"))?.isInvalidated).toBe(true); qc.clear();
});
it("a failed preference save preserves last confirmed value", async () => {
 const qc=new QueryClient(); const prefs={recapEmailEnabled:false,emailVerified:true,canReceiveRecapEmail:true};
 qc.setQueryData(qk.meetingPreferences(),prefs);
 vi.stubGlobal("fetch",vi.fn().mockResolvedValue(Response.json({code:"workspace_owner_required"},{status:403})));
 const observer=new MutationObserver(qc,meetingPreferencesMutationOptions(qc));
 await expect(observer.mutate(true)).rejects.toThrow(); expect(qc.getQueryData(qk.meetingPreferences())).toEqual(prefs); qc.clear();
});
it("uses bounded exponential GET retries and never retries session/contract errors", async () => {
 const {ApiError}=await import("./upload-client");
 const options=meetingInsightsQuery("m");
 expect(options.retry).toBeTypeOf("function");
 if(typeof options.retry!=="function" || typeof options.retryDelay!=="function") throw Error("GET retry backoff missing");
 expect(options.retry(0,new TypeError("network"))).toBe(true);
 expect(options.retry(3,new TypeError("network"))).toBe(false);
 for(const status of [401,403,404,409,503])expect(options.retry(0,new ApiError(status,"failure"))).toBe(false);
 expect([0,1,2,8].map(attempt=>typeof options.retryDelay==="function"?options.retryDelay(attempt,new Error()):null)).toEqual([3000,6000,12000,30000]);
});
it("polls queued to ready with real observer backoff, then stops",async()=>{
 vi.useFakeTimers();vi.stubGlobal("window",{});
 const {QueryClient:Client,QueryObserver:Observer}=await import("@tanstack/react-query");
 const {meetingInsightsQuery:options}=await import("./queries");
 const fetcher=vi.fn().mockResolvedValueOnce(Response.json({...data,recap:{id:"a",state:"queued",result:null,isStale:false,transcriptVersion:1,failureReason:null,emailStatus:"not_requested",updatedAt:""}}))
  .mockRejectedValueOnce(new TypeError("network"))
  .mockRejectedValueOnce(new TypeError("network"))
  .mockResolvedValue(Response.json({...data,recap:{id:"a",state:"ready",result:{briefSummary:"Ready",detailedSummary:"Ready",highlights:[],decisions:[],nextSteps:[]},isStale:false,transcriptVersion:1,failureReason:null,emailStatus:"not_requested",updatedAt:""}}));
 vi.stubGlobal("fetch",fetcher);const qc=new Client();const observer=new Observer(qc,options("m"));const unsubscribe=observer.subscribe(()=>{});
 try{
  await vi.advanceTimersByTimeAsync(0);expect(fetcher).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(3000);expect(fetcher).toHaveBeenCalledTimes(2);
  await vi.advanceTimersByTimeAsync(2999);expect(fetcher).toHaveBeenCalledTimes(2);
  await vi.advanceTimersByTimeAsync(1);expect(fetcher).toHaveBeenCalledTimes(3);
  await vi.advanceTimersByTimeAsync(5999);expect(fetcher).toHaveBeenCalledTimes(3);
  await vi.advanceTimersByTimeAsync(1);expect(fetcher).toHaveBeenCalledTimes(4);
  expect(observer.getCurrentResult().data?.recap?.state).toBe("ready");
  await vi.advanceTimersByTimeAsync(60000);expect(fetcher).toHaveBeenCalledTimes(4);
 }finally{unsubscribe();qc.clear();vi.useRealTimers();}
});

it("template receipts update only their own cache and preserve legacy Enhanced",async()=>{
 const qc=new QueryClient(),enhanced={id:"enhanced",state:"ready" as const,transcriptVersion:1,isStale:false,result:null,failureReason:null,emailStatus:"not_requested" as const,updatedAt:""};
 const source={...data,recap:enhanced,summary:{templateId:"sales-bant",templateRevision:1,sourceKind:"recap" as const,artifact:null}};
 qc.setQueryData(qk.meetingInsights("m"),{...data,recap:enhanced});qc.setQueryData(qk.meetingInsights("m","sales-bant"),source);
 vi.stubGlobal("fetch",vi.fn().mockResolvedValue(Response.json({id:"bant",state:"queued",failureReason:null,templateId:"sales-bant",sourceKind:"recap"},{status:202})));
 await new MutationObserver(qc,meetingInsightMutationOptions(qc,"m","recap","sales-bant")).mutate();
 const view=qc.getQueryData<MeetingInsights>(qk.meetingInsights("m","sales-bant"));expect(view?.recap?.id).toBe("enhanced");expect(view?.summary?.artifact?.id).toBe("bant");expect(qc.getQueryData<MeetingInsights>(qk.meetingInsights("m"))?.recap?.id).toBe("enhanced");qc.clear();
});
