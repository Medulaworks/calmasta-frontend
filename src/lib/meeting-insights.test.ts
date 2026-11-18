import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "./upload-client";
import { getMeetingInsights, requestMeetingInsight, getMeetingPreferences, saveMeetingPreferences, type MeetingInsights, type InsightArtifact, type RecapResult } from "./meeting-insights-client";
import { canRequestInsight, insightMessage, insightsPollInterval, insightErrorMessage, questionStartMs, seekInsightAudio } from "./meeting-insights";

export const artifact = (state: InsightArtifact<RecapResult>["state"], isStale = false): InsightArtifact<RecapResult> => ({
  id: "artifact", state, isStale, transcriptVersion: 1, failureReason: null, result: null,
  emailStatus: "not_requested", updatedAt: "2026-11-03T00:00:00Z",
});
export const insights = (recap: MeetingInsights["recap"] = null): MeetingInsights => ({ captureId: "meeting", transcriptVersion: 1, transcriptReady: true, enabled: true, liveProcessingEnabled: true, autoRecapEnabled: true, questionsOnDemand: true, recap, questions: null });
afterEach(() => vi.unstubAllGlobals());

describe("meeting insights contracts", () => {
  it("reads only through same-origin BFF, forwards cancellation and never generates on GET", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json(insights())); vi.stubGlobal("fetch", fetcher);
    const signal = new AbortController().signal;
    await getMeetingInsights("meeting/id", signal);
    expect(fetcher).toHaveBeenCalledOnce();
    expect(fetcher).toHaveBeenCalledWith("/api/captures/meeting%2Fid/insights", expect.objectContaining({ signal }));
  });
  it.each(["recap", "questions"] as const)("%s request sends no body and preserves blocked 202", async kind => {
    const result = { id: "a", state: "blocked", failureReason: "quota_exceeded" };
    const fetcher = vi.fn().mockResolvedValue(Response.json(result, { status: 202 })); vi.stubGlobal("fetch", fetcher);
    expect(await requestMeetingInsight("meeting", kind)).toEqual(result);
    expect(fetcher).toHaveBeenCalledWith(`/api/captures/meeting/${kind}`, expect.objectContaining({ method: "POST" }));
    expect(fetcher.mock.calls[0][1].body).toBeUndefined();
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it("saves only email opt-in and keeps eligibility in the response", async () => {
    const prefs = { recapEmailEnabled: true, emailVerified: true, canReceiveRecapEmail: true };
    const fetcher = vi.fn().mockImplementation(() => Promise.resolve(Response.json(prefs))); vi.stubGlobal("fetch", fetcher);
    await getMeetingPreferences(); expect(await saveMeetingPreferences(true)).toEqual(prefs);
    expect(fetcher.mock.calls[1]).toEqual(["/api/account/me/meeting-preferences", expect.objectContaining({method:"PATCH", body:JSON.stringify({recapEmailEnabled:true})})]);
  });
  it.each([401,403,404,409,503])("retains HTTP %s errors with safe wording", async status => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({code:"provider_secret_should_never_render"}, {status})));
    await expect(getMeetingInsights("m")).rejects.toBeInstanceOf(ApiError);
    expect(insightErrorMessage(new ApiError(status,"provider_secret_should_never_render"))).not.toContain("provider_secret");
  });
});

describe("meeting insights lifecycle", () => {
  it.each(["pending","queued","running"] as const)("polls %s with bounded backoff", state => {
    expect(insightsPollInterval(insights(artifact(state)),0)).toBe(3000);
    expect(insightsPollInterval(insights(artifact(state)),1)).toBe(6000);
    expect(insightsPollInterval(insights(artifact(state)),9)).toBe(30000);
    expect(canRequestInsight(insights(artifact(state)), "recap")).toBe(false);
  });
  it.each(["ready","blocked","failed","reconciliation_required"] as const)("stops generation polling for %s", state => {
    expect(insightsPollInterval(insights(artifact(state)),0)).toBe(false);
    expect(canRequestInsight(insights(artifact(state)),"recap")).toBe(state === "blocked");
  });
  it("never offers requests when disabled or paused; paused work stops polling", () => {
    const disabled = {...insights(), enabled:false};
    expect(canRequestInsight(disabled,"recap")).toBe(false);
    expect(insightsPollInterval({...disabled,recap:artifact("queued")},0)).toBe(false);
    expect(canRequestInsight({...insights(),liveProcessingEnabled:false},"questions")).toBe(false);
    expect(insightsPollInterval({...insights(artifact("queued")),liveProcessingEnabled:false},0)).toBe(false);
  });
  it("requires transcript readiness and honors questions capability", () => {
    expect(canRequestInsight({...insights(),transcriptReady:false},"recap")).toBe(false);
    expect(canRequestInsight({...insights(),questionsOnDemand:false},"questions")).toBe(false);
    expect(canRequestInsight(insights(),"questions")).toBe(true);
  });
  it("permits current-version requests for stale failures without retrying same-version failure", () => {
    expect(canRequestInsight(insights(artifact("failed",true)),"recap")).toBe(true);
    expect(canRequestInsight(insights(artifact("failed")),"recap")).toBe(false);
    expect(insightMessage(artifact("reconciliation_required"))).toContain("looking into");
    expect(insightMessage({...artifact("blocked"),failureReason:"insight_provider_not_configured"})).not.toContain("insight_provider");
  });
  it("selects a valid timestamp including zero, without guessing when sources are absent", () => {
    expect(questionStartMs({text:"Q?",sources:[]})).toBe(null);
    expect(questionStartMs({text:"Q?",sources:[{segmentId:"s",startMs:0,endMs:20,speakerId:null}]})).toBe(0);
    expect(questionStartMs({text:"Q?",sources:[{segmentId:"s",startMs:-1,endMs:20,speakerId:null}]})).toBe(null);
    const audio = {readyState:1,duration:10,currentTime:0,focus:vi.fn()};
    seekInsightAudio(audio,12000); expect(audio.currentTime).toBe(10); expect(audio.focus).toHaveBeenCalledOnce();
    audio.readyState=0; audio.currentTime=0; seekInsightAudio(audio,5000); expect(audio.currentTime).toBe(0);
  });
});
it("reports a completed seek so the caller can consume it instead of reapplying on metadata reload",()=>{
 const audio={readyState:0,duration:20,currentTime:0,focus:vi.fn()};
 expect(seekInsightAudio(audio,12000)).toBe(false);
 audio.readyState=1;expect(seekInsightAudio(audio,12000)).toBe(true);
});

it("permits explicit retry only for a safe pre-dispatch failure label",()=>{
 const retry={...artifact("failed"),result:null,failureReason:"insight_dispatch_blocked"};
 expect(canRequestInsight({...insights(),questions:retry},"questions")).toBe(true);
 expect(insightMessage(retry)).toContain("try again");
 expect(canRequestInsight({...insights(),questions:{...retry,state:"reconciliation_required"}},"questions")).toBe(false);
});

it("polls a selected template while Enhanced and questions are already ready",()=>{
 const selected={...artifact("queued"),result:null};
 const data={...insights(artifact("ready")),summary:{templateId:"sales-bant",templateRevision:1,sourceKind:"recap" as const,artifact:selected}};
 expect(insightsPollInterval(data,0)).toBe(3000);expect(insightsPollInterval({...data,summary:{...data.summary,artifact:{...selected,state:"ready"}}},0)).toBe(false);
});
