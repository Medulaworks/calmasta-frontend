"use client";
import Link from "next/link";
import {useRouter} from "next/navigation";
import {Button} from "@/components/ui/button";
import { SkeletonDetail } from "@/components/ui/skeleton";
import {PrivateAudio} from "@/components/private-audio";
import { useCallback,useEffect,useState } from "react";
import { TranscriptEditor } from "@/components/transcript-editor";
import { getLibraryCapture,saveLibraryTranscript } from "@/lib/library-client";
import { type CaptureView,ApiError,cancelMeetingCapture,retryMeeting,isMeetingActive } from "@/lib/upload-client";
import { captureStatus } from "@/lib/status";
export function LibraryRecording({id}:{id:string}){
 const router=useRouter();const [consent,setConsent]=useState(false),[busy,setBusy]=useState(false);
 const [capture,setCapture]=useState<CaptureView|null>(null),[error,setError]=useState<string|null>(null),[revision,setRevision]=useState(0);
 const refresh=useCallback(()=>setRevision(v=>v+1),[]);
 useEffect(()=>{const ctrl=new AbortController();getLibraryCapture(id,ctrl.signal).then(c=>{if(!ctrl.signal.aborted){setCapture(c);setError(null);}},e=>{if(!ctrl.signal.aborted)setError(e instanceof ApiError&&e.status===404?"This recording is unavailable.":e instanceof Error?e.message:"Could not load recording.");});return()=>ctrl.abort();},[id,revision]);
 const status=capture?captureStatus(capture):null;
 const active=!!capture&&["requested","queued","joining","waiting_for_admission","recording","processing","media_pending","recorded"].includes(capture.state);
 useEffect(()=>{if(!active)return;const timer=setInterval(refresh,3000);return()=>clearInterval(timer);},[active,refresh]);
 async function act(retry:boolean){setBusy(true);setError(null);try{if(retry){const next=await retryMeeting(id,consent);router.push(`/dashboard/library/recordings/${next.captureId}`);}else{await cancelMeetingCapture(id);refresh();}}catch(e){setError(e instanceof Error?e.message:"Could not update capture.");}finally{setBusy(false);}}
 return <div className="space-y-5"><Link href="/dashboard/library" className="text-sm text-muted">Back to library</Link>{error&&<p role="alert" className="text-danger">{error}</p>}{capture?<><h1 className="text-2xl font-semibold">{capture.title||"Recording"}</h1><p role="status" className="text-sm text-muted">{status?.label}</p>
 {capture.source==="meeting_url"&&<section className="space-y-3" aria-label="Meeting controls">{isMeetingActive(capture.status)&&<Button disabled={busy||!!capture.cancelRequestedAt} onClick={()=>void act(false)}>{capture.cancelRequestedAt?"Cancellation requested":"Cancel capture"}</Button>}{["host_denied","admission_timeout","cancelled","failed"].includes(capture.state)&&<><label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/>I have the right to record this meeting again and will tell its participants.</label><Button disabled={busy||!consent} onClick={()=>void act(true)}>{busy?"Sending…":"Send assistant again"}</Button></>}</section>}
 <PrivateAudio key={capture.id} id={capture.id}/><TranscriptEditor key={capture.id} cap={capture} statusLabel={status?.label??"Processing"} active={active} onChanged={refresh} loadCapture={getLibraryCapture} saveChanges={saveLibraryTranscript}/></>:!error&&<SkeletonDetail label="Loading recording"/>}</div>;
}
