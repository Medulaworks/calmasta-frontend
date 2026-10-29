"use client";
import Link from "next/link";
import { useRouter,useSearchParams } from "next/navigation";
import { useEffect,useRef,useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Highlight } from "@/components/ui/highlight";
import { type LibraryQuery,type LibraryResult,searchLibraryPage } from "@/lib/library-client";
import { timeAgo } from "@/lib/status";
export function TranscriptLibrary(){
 const params=useSearchParams(),router=useRouter();
 const filters:LibraryQuery={q:params.get("q")??"",type:params.get("type")??"all",status:params.get("status")??"all",from:params.get("from")??"",to:params.get("to")??""};
 const key=JSON.stringify(filters);
 const [view,setView]=useState<{key:string;results:LibraryResult[];nextCursor:string|null;error:string|null}|null>(null);
 const [loadingMore,setLoadingMore]=useState<string|null>(null);
 const more=useRef<AbortController|null>(null);
 useEffect(()=>{
  const ctrl=new AbortController();
  const query=JSON.parse(key) as LibraryQuery;
  searchLibraryPage(query,ctrl.signal).then(page=>{if(!ctrl.signal.aborted)setView({key,...page,error:null});},error=>{if(!ctrl.signal.aborted)setView({key,results:[],nextCursor:null,error:error instanceof Error?error.message:"Could not load your library."});});
  return()=>{ctrl.abort();more.current?.abort();};
 },[key]);
 const current=view?.key===key?view:null;
 async function loadMore(){
  if(!current?.nextCursor||loadingMore===key)return;
  more.current?.abort();const ctrl=new AbortController();more.current=ctrl;setLoadingMore(key);
  try{const page=await searchLibraryPage(filters,ctrl.signal,current.nextCursor);if(!ctrl.signal.aborted)setView(prev=>prev?.key===key?{key,results:[...prev.results,...page.results.filter(r=>!prev.results.some(old=>old.id===r.id))],nextCursor:page.nextCursor,error:null}:prev);}
  catch(error){if(!ctrl.signal.aborted)setView(prev=>prev?.key===key?{...prev,error:error instanceof Error?error.message:"Could not load more recordings."}:prev);}
  finally{setLoadingMore(v=>v===key?null:v);}
 }
 const control="rounded-lg border border-border bg-background px-3 py-2 text-sm";
 return <div className="space-y-4">
  <form key={key} role="search" aria-label="Search recordings" className="flex flex-wrap items-end gap-3" onSubmit={e=>{e.preventDefault();const data=new FormData(e.currentTarget),p=new URLSearchParams();for(const name of ["q","type","status","from","to"]){const value=String(data.get(name)??"").trim();if(value&&value!=="all")p.set(name,value);}router.replace(`/dashboard/library${p.size?`?${p}`:""}`);}}>
   <label className="min-w-48 flex-1 text-sm">Search titles and transcripts<input name="q" type="search" maxLength={200} defaultValue={filters.q} className={`${control} mt-1 block w-full`} /></label>
   <label className="text-sm">Type<select name="type" defaultValue={filters.type} className={`${control} mt-1 block`}><option value="all">All recordings</option><option value="recording">Uploads</option><option value="meeting">Meetings</option></select></label>
   <label className="text-sm">Status<select name="status" defaultValue={filters.status} className={`${control} mt-1 block`}><option value="all">Any status</option><option value="ready">Ready</option><option value="in_progress">In progress</option><option value="attention">Needs attention</option></select></label>
   <label className="text-sm">From<input name="from" type="date" defaultValue={filters.from} className={`${control} mt-1 block`} /></label><label className="text-sm">To<input name="to" type="date" defaultValue={filters.to} className={`${control} mt-1 block`} /></label>
   <Button type="submit" variant="primary">Search</Button><Link href="/dashboard/library" className="px-2 py-2 text-sm text-muted">Clear</Link>
  </form>
  {current?.error&&<p role="alert" className="text-sm text-danger">{current.error}</p>}
  <Card>{!current?<p role="status" className="p-5 text-muted">Loading recordings…</p>:current.results.length===0?<p className="p-5 text-muted">{current.error?"Recordings could not be loaded.":"No recordings match these filters."}</p>:<ul className="divide-y divide-border">{current.results.map(r=><li key={r.id}><Link href={`/dashboard/library/recordings/${r.id}`} className="block px-5 py-4 hover:bg-surface"><span className="block font-medium"><Highlight text={r.title} query={filters.q}/></span><span className="text-xs text-muted">{r.kind==="meeting"?"Meeting":"Recording"} · {timeAgo(r.at)} · {r.state==="completed"?"Ready":r.state?.replaceAll("_"," ")}</span>{r.snippet&&<p className="mt-1 text-sm text-muted"><Highlight text={r.snippet} query={filters.q}/></p>}</Link></li>)}</ul>}</Card>
  {current?.nextCursor&&<Button variant="secondary" disabled={loadingMore===key} onClick={()=>void loadMore()}>{loadingMore===key?"Loading…":"Load more"}</Button>}
 </div>;
}
