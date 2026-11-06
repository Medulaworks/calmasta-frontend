import type {RecapResult,MeetingMetadata,QuestionsResult} from "./meeting-insights-client";
const clock=(ms:number)=>`${Math.floor(ms/60000)}:${String(Math.floor(ms/1000)%60).padStart(2,"0")}`;
export function questionExportLines(result:QuestionsResult,markdown=false):string[]{
 const lines=[markdown?"## Q&A":"Q&A",""];
 for(const q of result.questions){lines.push(markdown?`### ${q.text}`:q.text);if(q.sources[0])lines.push(`Speaker: ${q.askerSpeakerId??q.sources[0].speakerId??"Not identified"} · ${clock(q.sources[0].startMs)}`);
  if(q.answers?.length)for(const answer of q.answers)lines.push(`  - ${answer.text}${answer.sources[0]?` (${clock(answer.sources[0].startMs)})`:""}`);
  else lines.push(result.formatVersion===2?"  - Not answered in this meeting.":"  - Answers have not been extracted.");lines.push("");
 }if(!result.questions.length)lines.push("No questions identified.");return lines;
}
export function formatInsightExport(result:RecapResult|null,meeting:MeetingMetadata|undefined,questions:QuestionsResult|null,format:"txt"|"markdown",origin=""):string{
 const md=format==="markdown",lines:string[]=[];
 if(meeting){const date=new Date(meeting.recordedAt),label=Number.isFinite(date.getTime())?date.toLocaleDateString("en",{year:"numeric",month:"long",day:"numeric",timeZone:"UTC"}):"";lines.push(`${md?"# ":""}${meeting.title}${label?` — ${label}`:""}`);
  if(/^\/dashboard\/captures\/[^/?#]+#recording-audio$/.test(meeting.recordingPath))lines.push(`View recording: ${origin}${meeting.recordingPath}`);lines.push("");}
 const heading=(title:string)=>lines.push(`${md?"## ":""}${title}`,"");
 const list=(items:string[])=>{for(const item of items)lines.push(`- ${item}`);lines.push("");};
 if(result){
  if(result.formatVersion===3){for(const s of result.sections){heading(s.title);lines.push(...s.paragraphs,"");for(const p of s.points){lines.push(`- ${p.text}`);for(const detail of p.details)lines.push(`  - ${detail}`);}lines.push("");}}
  else if(result.formatVersion===2){heading("Meeting Purpose");lines.push(result.meetingPurpose,"");heading("Key Takeaways");list(result.highlights);heading("Topics");for(const topic of result.topics){lines.push(`${md?"### ":""}${topic.title}`);for(const point of topic.points){lines.push(`- ${point.text}`);for(const detail of point.details)lines.push(`  - ${detail}`);}lines.push("");}if(result.technicalNotes.length){heading("Technical & Admin Notes");list(result.technicalNotes);}}
  else{heading("Meeting Purpose");lines.push(result.briefSummary,"");heading("Discussion");lines.push(result.detailedSummary,"");heading("Key Takeaways");list(result.highlights);}
  if(result.decisions.length){heading("Decisions");list(result.decisions);}heading("Next Steps");
  if(result.formatVersion===2||result.formatVersion===3)list(result.actionItems.map(a=>`${a.owner?`${a.owner}: `:""}${a.task}${a.due?` (${a.due})`:""}`));else list(result.nextSteps);
 }if(questions)lines.push(...questionExportLines(questions,md));return lines.join("\n").trim()+"\n";
}
export function insightFilename(title:string,templateId:string,format:"txt"|"md"){const safe=(title.replace(/[<>:"/\\|?*\u0000-\u001f]/g,"").replace(/^\.+/,"").trim()||"meeting").slice(0,120);return `${safe}-${templateId.replace(/[^a-z0-9-]/gi,"")}.${format}`;}
export async function copyInsight(text:string){
 if(!navigator.clipboard)throw Error("Copy is unavailable. Download the notes instead.");
 const escape=(v:string)=>v.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
 if(typeof ClipboardItem!=="undefined"&&navigator.clipboard.write){try{await navigator.clipboard.write([new ClipboardItem({"text/plain":new Blob([text],{type:"text/plain"}),"text/html":new Blob([`<div style="white-space:pre-wrap">${escape(text)}</div>`],{type:"text/html"})})]);return;}catch{ /* Plain text may be supported when rich text is not. */ }}
 await navigator.clipboard.writeText(text);
}
export function downloadInsight(text:string,name:string,type:string){const url=URL.createObjectURL(new Blob([text],{type})),a=document.createElement("a");a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),0);}
