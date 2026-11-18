import {expect,it} from "vitest";
import {formatInsightExport,insightFilename} from "./insight-export";
it("exports selected structured sections and evidence without internal accounting",()=>{
 const doc={formatVersion:3 as const,templateId:"sales-bant",templateRevision:1,sections:[{id:"budget",title:"Budget",paragraphs:["Not discussed."],points:[{text:"A point",details:["Nested detail"]}]}],decisions:[],actionItems:[{owner:"Alex",task:"Review",due:null}]};
 const text=formatInsightExport(doc,{title:"Planning",recordedAt:"2026-11-06T10:00:00Z",recordingPath:"/dashboard/captures/m#recording-audio"},null,"markdown","https://app.example");
 expect(text).toContain("## Budget");expect(text).toContain("Nested detail");expect(text).toContain("Alex: Review");expect(text).toContain("https://app.example/dashboard/captures/m#recording-audio");expect(text).not.toContain("reservedCost");
 expect(insightFilename("../Planning:/","sales-bant","txt")).not.toMatch(/[/:]/);
});

it("exports imported AI Notes and Q&A without invented timestamps or speakers",()=>{
 const questions={coverage:"ai_extraction_not_guaranteed_exhaustive" as const,formatVersion:2 as const,questions:[{text:"What next?",sources:[{segmentId:"text",startMs:0,endMs:0,speakerId:null}],answers:[{text:"Review the draft",sources:[{segmentId:"text",startMs:0,endMs:0,speakerId:null}]}]}]};
 const text=formatInsightExport(null,undefined,questions,"txt","",{hasTimestamps:false,isMeeting:false});
 expect(text).toContain("What next?");expect(text).toContain("Review the draft");expect(text).not.toContain("0:00");expect(text).not.toContain("Speaker:");
});
