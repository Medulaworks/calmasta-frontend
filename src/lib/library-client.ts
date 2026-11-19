import { ApiError,getCapture,saveTranscript,type CaptureView,type TranscriptEditInput } from "./upload-client";

export interface LibraryResult {
  kind: "document" | "recording" | "meeting";
  id: string;
  title: string;
  href: string;
  source?: string;
  state?: string;
  status: string;
  failureReason: string | null;
  editedByUser?: boolean;
  template?: string;
  at: string;
  snippet: string | null;
  /** Meeting app when the server says which one; absent until the list endpoint includes it. */
  platform?: string | null;
}

export interface LibraryQuery {
  q: string;
  type: string;
  status: string;
  from: string;
  to: string;
}

export const EMPTY_QUERY: LibraryQuery = { q: "", type: "all", status: "all", from: "", to: "" };

/** True when the user is searching or filtering (rather than just browsing the two lists). */
export const isSearching = (f: LibraryQuery) => f.q.trim().length > 0 || f.type !== "all" || f.status !== "all" || !!f.from || !!f.to;

export async function searchLibrary(f:LibraryQuery,signal?:AbortSignal,limit?:number):Promise<LibraryResult[]> {return (await searchLibraryPage(f,signal,undefined,limit)).results;}
export interface LibraryPage { results:LibraryResult[];nextCursor:string|null; }
async function request<T>(url:string,init?:RequestInit):Promise<T>{
 const res=await fetch(url,{cache:"no-store",...init});const body=await res.json().catch(()=>({}));
 if(!res.ok){const code=body.code as string|undefined;const message=res.status===401?"Your session ended. Please sign in again.":code==="version_conflict"?"This transcript was changed elsewhere. Your changes are still here.":res.status===413?"These edits are too large. Save fewer lines at a time.":body.error??"We couldn’t load or save this recording. Please try again.";throw new ApiError(res.status,message,code);}return body as T;
}
export async function searchLibraryPage(f:LibraryQuery,signal?:AbortSignal,cursor?:string,limit=25):Promise<LibraryPage>{
 const p=new URLSearchParams();if(f.q.trim())p.set("q",f.q.trim());
 const type=({documents:"document",recordings:"recording",meetings:"meeting"} as Record<string,string>)[f.type]??f.type;
 if(type!=="all")p.set("type",type);if(f.status!=="all")p.set("status",f.status);if(f.from)p.set("from",f.from);if(f.to)p.set("to",f.to);if(cursor)p.set("cursor",cursor);p.set("limit",String(limit));
 return request<LibraryPage>(`/api/library/search?${p}`,{signal});
}
export const getLibraryCapture=(id:string,signal?:AbortSignal):Promise<CaptureView>=>getCapture(id,signal);
export const saveLibraryTranscript=(id:string,edit:TranscriptEditInput)=>saveTranscript(id,edit);
