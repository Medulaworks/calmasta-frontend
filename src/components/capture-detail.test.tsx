import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
import { CaptureDetail } from "./capture-detail";
import { qk } from "../lib/queries";
const h = vi.hoisted(() => ({ source: "transcript_upload", panel: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), useSearchParams: () => new URLSearchParams("tab=recording") }));
vi.mock("./meeting-insights", () => ({ MeetingInsights: (props: unknown) => { h.panel(props); return createElement("section", null, "AI Notes"); } }));
const clients: QueryClient[]=[];
afterEach(() => { clients.splice(0).forEach(client => client.clear()); h.panel.mockReset(); });
it("the capture route keeps imported text and AI Notes without a recording tab or unavailable media notice", () => {
 const client=new QueryClient();clients.push(client);
 client.setQueryData(qk.capture("text"),{id:"text",source:h.source,title:"Imported note",state:"completed",status:"completed",createdAt:"2026-11-17T00:00:00Z",transcriptVersion:1,transcript:[{id:"line",text:"Review the plan",startMs:0,endMs:0,speakerId:null}],speakerNames:{},documents:[],actions:{state:"none",items:[]},audio:null,audioStatus:"none",events:[]});
 const html=renderToStaticMarkup(createElement(QueryClientProvider,{client},createElement(CaptureDetail,{id:"text"})));
 expect(html).toContain("Review the plan");expect(html).toContain("AI Notes");expect(html).not.toContain("Recording playback");expect(html).not.toContain("still being uploaded");expect(html).not.toContain("Audio no longer available");expect(html).not.toContain('aria-controls="tabpanel-recording"');
 expect(h.panel).toHaveBeenCalledWith(expect.objectContaining({isMeeting:false,hasTimestamps:false,audioAvailable:false}));
});
it("shows roster display names in the details card instead of undefined", () => {
 const client=new QueryClient();clients.push(client);
 client.setQueryData(qk.capture("roster"),{id:"roster",source:"meeting",title:"Team sync",state:"completed",status:"completed",createdAt:"2026-11-16T20:38:40.777Z",platform:"google_meet",botName:"Josiah Bot",transcriptVersion:1,transcript:[],speakerNames:{},documents:[],actions:{state:"none",items:[]},audio:null,audioStatus:"none",events:[],participants:[{id:"100",displayName:"Josiah Arkson",role:"host",joinedAt:null,leftAt:null}]});
 const html=renderToStaticMarkup(createElement(QueryClientProvider,{client},createElement(CaptureDetail,{id:"roster"})));
 expect(html).toContain("Participants · 1");expect(html).toContain("Josiah Arkson");expect(html).toContain("host");expect(html).not.toContain("undefined");
});
