"use client";
import {Check, Copy, Download} from "lucide-react";
import {useState} from "react";
import {Button} from "../ui/button";
import {copyInsight,downloadInsight,formatInsightExport,insightFilename} from "../../lib/insight-export";
import type {RecapResult,MeetingMetadata,QuestionsResult} from "../../lib/meeting-insights-client";
export function SummaryToolbar({result,meeting,questions=null,templateId="enhanced",disabled=false,questionsOnly=false}:{result:RecapResult|null;meeting?:MeetingMetadata;questions?:QuestionsResult|null;templateId?:string;disabled?:boolean;questionsOnly?:boolean}){
 const [copied,setCopied]=useState(false),[error,setError]=useState<string|null>(null);
 const text=(format:"txt"|"markdown")=>formatInsightExport(questionsOnly?null:result,meeting,questions,format,typeof window!=="undefined"?window.location?.origin??"":"");
 async function copy(){setError(null);try{await copyInsight(text("txt"));setCopied(true);setTimeout(()=>setCopied(false),2000);}catch{setError("Could not copy. Download the notes instead.");}}
 return <div className="space-y-2"><div className="flex flex-wrap items-center gap-2">
 <Button size="sm" variant="secondary" disabled={disabled} onClick={()=>void copy()} className="gap-1.5">{copied?<Check aria-hidden className="h-3.5 w-3.5"/>:<Copy aria-hidden className="h-3.5 w-3.5"/>}{copied?"Copied":questionsOnly?"Copy questions":"Copy summary"}</Button>
 <details className="relative"><summary aria-disabled={disabled} className={`inline-flex cursor-pointer list-none items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm ${disabled?"pointer-events-none opacity-50":"hover:bg-surface"}`}><Download aria-hidden className="h-3.5 w-3.5"/>Download ▾</summary><div className="absolute right-0 z-20 min-w-40 rounded-lg border border-border bg-background p-1 shadow-lg">{([['TXT','txt'],['Markdown','md']] as const).map(([label,ext])=><button key={ext} type="button" disabled={disabled} className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm hover:bg-surface focus-visible:outline-accent-solid" onClick={()=>downloadInsight(text(ext==="md"?"markdown":"txt"),insightFilename(meeting?.title??"meeting",templateId,ext),ext==="md"?"text/markdown;charset=utf-8":"text/plain;charset=utf-8")}><Download aria-hidden className="h-3.5 w-3.5 text-muted"/>{label}</button>)}</div></details>
 </div>{error&&<p role="alert" className="text-xs text-danger">{error}</p>}</div>;
}
