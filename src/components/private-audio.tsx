"use client";
import {useEffect,useRef,useState} from "react";
import {Button} from "@/components/ui/button";
import {ApiError,getPrivateAudio,type PrivateAudio as AudioLink} from "@/lib/upload-client";
export function PrivateAudio({id,onAudioChange}:{id:string;onAudioChange?:(audio:HTMLAudioElement|null)=>void}){
 const [link,setLink]=useState<AudioLink|null>(null),[message,setMessage]=useState<string|null>(null),[busy,setBusy]=useState(false),[gone,setGone]=useState(false);const generation=useRef(0);
 useEffect(()=>{const mounted=++generation.current;return()=>{generation.current=mounted+1;};},[]);
 useEffect(()=>{if(!link)return;const timer=setTimeout(()=>{setLink(null);setMessage("This playback link expired. Get a new link to continue.");},Math.max(0,Date.parse(link.expiresAt)-Date.now()));return()=>clearTimeout(timer);},[link]);
 async function load(){const current=generation.current;setBusy(true);setMessage(null);try{const value=await getPrivateAudio(id);if(current===generation.current)setLink(value);}catch(error){if(current!==generation.current)return;setGone(error instanceof ApiError&&error.status===410);setMessage(error instanceof ApiError&&error.status===404?"Audio is not available yet.":error instanceof Error?error.message:"Could not load audio.");}finally{if(current===generation.current)setBusy(false);}}
 return <section className="space-y-3 rounded-xl border border-border p-5" aria-label="Private audio"><h2 className="font-medium">Recording</h2>{link&&<audio ref={onAudioChange} onLoadedMetadata={(event)=>onAudioChange?.(event.currentTarget)} onEmptied={()=>onAudioChange?.(null)} controls preload="metadata" src={link.url} className="w-full" onError={()=>{onAudioChange?.(null);setLink(null);setMessage("Playback could not continue. Get a new link to try again.");}}/>}{message&&<p role="status" className="text-sm text-muted">{message}</p>}{!gone&&<Button variant="secondary" disabled={busy} onClick={()=>void load()}>{busy?"Loading…":link?"Refresh playback link":"Play private audio"}</Button>}<p className="text-xs text-muted">Playback links expire. Audio is retained for up to 14 days; your transcript remains available.</p></section>;
}
