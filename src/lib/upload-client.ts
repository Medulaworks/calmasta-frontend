import {blobSha256} from "./blob-sha256";
// Browser side of the upload flow: ask the API for a signed URL, PUT the file
// with progress, tell the API it finished, then poll processing status.

export interface TranscriptSegmentView {
  id: string;
  startMs: number;
  endMs: number;
  text: string;
  speakerId: string | null;
  editedByUser: boolean;
}

export type ActionStatus = "suggested" | "confirmed" | "dismissed" | "done";
export interface ActionItemView {
  id: string;
  text: string;
  status: ActionStatus;
  createdBy: "ai" | "user";
  /** The transcript line it came from, if that line still exists. */
  sourceSegmentId: string | null;
  sourceStartMs: number | null;
}
export interface ActionsView {
  state: "none" | "extracting" | "ready" | "failed";
  error: string | null;
  items: ActionItemView[];
}

export interface CaptureView {
  id: string;
  title: string | null;
  filename: string | null;
  createdAt: string;
  documents: Array<{ id: string; title: string; template: string; status: string; editedByUser: boolean; updatedAt: string }>;
  source: string;
  platform: string | null;
  meetingUrl?: string | null;
  botName?: string | null;
  durationSeconds?: number | null;
  status: string;
  provider: string | null;
  state: string;
  failureReason: string | null;
  transcript: TranscriptSegmentView[];
  /** Action items found in the conversation, for the Actions tab. */
  actions: ActionsView;
  /** The meeting assistant's timeline (meeting captures only). */
  events: Array<{ status: string; detail: string | null; at: string }>;
  /** Counter used to detect that someone else edited the transcript first; null until there is a transcript. */
  transcriptVersion: number | null;
  /** The user's names for the provider's speaker labels, e.g. { S1: "Maya" }. */
  speakerNames: Record<string, string>;
  /** Signed URL valid ~5 minutes; refetch detail to renew. */
  audio: { url: string; expiresAt?: string; contentType: string; sizeBytes: number } | null;
  /** "unavailable" = the file is gone (removed or expired); the transcript and documents remain. */
  audioStatus: "available" | "unavailable" | "none";
  /** Whether video was asked for on this meeting. */
  recordVideo: boolean;
  /** Signed URL valid ~5 minutes; refetch detail to renew. */
  video: { url: string; expiresAt?: string; contentType: string; sizeBytes: number } | null;
  /** none: not asked for. requested/processing: on its way. ready. failed (see videoFailure). unavailable: removed, as the privacy settings say. */
  videoStatus: "none" | "requested" | "processing" | "ready" | "failed" | "unavailable";
  videoFailure: string | null;
  cancelRequestedAt?:string|null;
  maxDurationSeconds?:number|null;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    /** A machine-readable reason from the server, e.g. "version_conflict". */
    readonly code?: string,
    readonly correlationId?: string,
  ) {
    super(message);
  }
}

const messages:Record<string,string>={meeting_already_active:"An assistant is already active for this meeting. Open the existing capture before trying again.",quota_not_configured:"Capture is not enabled for this account yet.",quota_exceeded:"Your recording allowance is used up.",spend_guard_exceeded:"Processing is temporarily unavailable. Try again later.",usage_reconciliation_required:"Processing needs attention before more work can start.",invalid_audio:"The recording could not be validated. Check its format and file contents.",audio_too_long:"The recording exceeds the configured duration limit.",upload_too_large:"The file exceeds the upload size limit.",upload_expired:"This upload expired. Choose the file again.",audio_unavailable:"The audio has expired or was removed. Your transcript remains available.",storage_unavailable:"Storage is temporarily unavailable. Please try again.",meeting_cost_not_configured:"Meeting capture is not available yet.",capture_not_retryable:"This meeting cannot be retried yet.",provider_outcome_unknown:"Processing needs attention. A second request will not be sent automatically.",version_conflict:"This transcript was changed elsewhere. Your changes are still here.",invalid_avatar:"Use a PNG, JPG or WebP picture under 1 MB.",invalid_image:"That picture couldn't be validated. Choose a non-animated PNG, JPG or WebP image.",avatar_version_conflict:"Your profile photo was changed in another tab. We refreshed your profile.",avatar_superseded:"A newer profile photo has already been saved.",avatar_upload_expired:"This photo upload expired. Please try again.",avatar_upload_incomplete:"The photo upload didn't finish. Please try again."};
export async function api<T>(url:string,init?:RequestInit):Promise<T>{
 const res=await fetch(url,{cache:"no-store",...init});if(res.status===204)return undefined as T;const body=await res.json().catch(()=>({}));
 if(!res.ok){
  const reference=typeof body.correlationId==="string"&&/^[a-f0-9-]{36}$/i.test(body.correlationId)?body.correlationId:undefined;
  const message=res.status===401?"Your session ended. Please sign in again.":messages[body.code]??body.error??"Something went wrong. Please try again.";
  throw new ApiError(res.status,message+(res.status>=500&&reference?` Reference: ${reference}`:""),body.code,reference);
 }return body as T;
}
export interface CapturePolicy {maxUploadBytes:number|null;maxVideoBytes?:number|null;maxUploadDurationSeconds:number|null;maxMeetingDurationSeconds:number|null;recordingLimitsOverride?:boolean;supportedAudioTypes:string[];uploadEnabled:boolean;meetingEnabled:boolean;videoEnabled:boolean;liveProcessingEnabled:boolean;botName:string;}
export const getCapturePolicy=(signal?:AbortSignal)=>api<CapturePolicy>("/api/uploads/policy",{signal});
export interface PrivateAudio {url:string;expiresAt:string;contentType:string;sizeBytes:number;}
export const getPrivateAudio=(id:string)=>api<PrivateAudio>(`/api/captures/${encodeURIComponent(id)}/audio`);
function putWithProgress(url:string,blob:Blob,headers:Record<string,string>,onProgress:(fraction:number)=>void){return new Promise<void>((resolve,reject)=>{
 const xhr=new XMLHttpRequest();xhr.open("PUT",url);xhr.timeout=120000;
 // Browsers set Content-Length from the Blob; JavaScript is forbidden to set it.
 for(const [name,value] of Object.entries(headers)){if(name.toLowerCase()==="content-length"){if(Number(value)!==blob.size){reject(new Error("Upload size mismatch."));return;}}else xhr.setRequestHeader(name,value);}
 xhr.upload.onprogress=e=>{if(e.lengthComputable)onProgress(e.loaded/e.total);};
 xhr.onload=()=>xhr.status>=200&&xhr.status<300||xhr.status===412?resolve():reject(new ApiError(xhr.status,"The upload failed. Please try again."));
 xhr.onerror=xhr.ontimeout=xhr.onabort=()=>reject(new ApiError(0,"The upload was interrupted. Check your connection and try again."));xhr.send(blob);
});}
export function audioContentType(type:string,filename:string){const base=type.split(";")[0].trim().toLowerCase();const aliases:Record<string,string>={"audio/mp3":"audio/mpeg","audio/x-wav":"audio/wav","audio/x-m4a":"audio/mp4","audio/m4a":"audio/mp4"};if(base)return aliases[base]??base;return ({mp3:"audio/mpeg",wav:"audio/wav",m4a:"audio/mp4",mp4:"audio/mp4",webm:"audio/webm",ogg:"audio/ogg"} as Record<string,string>)[filename.split(".").pop()?.toLowerCase()??""]??"";}
type UploadIntent={id:string;captureId:string;state:string;upload?:{url:string;headers:Record<string,string>}};
type Attempt={key:string;completeKey:string;title:string;intent?:UploadIntent;uploaded:boolean;pending?:Promise<string>};
const uploads=new WeakMap<Blob,Attempt>();
export async function uploadAudio(input:{blob:Blob;filename:string;title:string;source:"voice_recording"|"audio_upload";consent:boolean},onProgress:(fraction:number)=>void):Promise<string>{
 if(input.consent!==true)throw new Error("Confirm that you have the right to upload and transcribe this recording.");
 let attempt=uploads.get(input.blob);const title=input.title.trim();if(attempt&&attempt.title!==title)throw new Error("Keep the same title when retrying this upload, or choose the file again.");
 if(!attempt){attempt={key:crypto.randomUUID(),completeKey:crypto.randomUUID(),title,uploaded:false};uploads.set(input.blob,attempt);}if(attempt.pending)return attempt.pending;
 const current=attempt;
 current.pending=(async()=>{
  const policy=await getCapturePolicy();const contentType=audioContentType(input.blob.type,input.filename);
  if(!policy.uploadEnabled)throw new Error("Uploading is not enabled for this account yet.");
  if(!input.blob.size||(policy.maxUploadBytes!==null&&input.blob.size>policy.maxUploadBytes))throw new Error("The recording is empty or exceeds the upload size limit.");
  if(!policy.supportedAudioTypes.includes(contentType))throw new Error("Use MP3, M4A, PCM WAV, WebM or Ogg audio.");
  if(!current.intent){const sha256=await blobSha256(input.blob);current.intent=await api<UploadIntent>("/api/uploads",{method:"POST",headers:{"Content-Type":"application/json","Idempotency-Key":current.key},body:JSON.stringify({contentType,sizeBytes:input.blob.size,sha256,consent:true,...(title?{title}:{})})});}
  if(current.intent.state==="completed")return current.intent.captureId;
  if(!current.uploaded){if(!current.intent.upload)throw new Error("Upload link unavailable.");await putWithProgress(current.intent.upload.url,input.blob,current.intent.upload.headers,onProgress);current.uploaded=true;}
  await api(`/api/uploads/${current.intent.id}/complete`,{method:"POST",headers:{"Content-Type":"application/json","Idempotency-Key":current.completeKey},body:"{}"});return current.intent.captureId;
 })();try{return await current.pending;}finally{current.pending=undefined;}
}

export interface CaptureListItem {
  id: string;
  source: string;
  title: string | null;
  platform: string | null;
  status: string;
  state: string;
  failureReason: string | null;
  createdAt: string;
}

export const listCaptures=async(limit=25,kind?:"meetings"|"recordings",signal?:AbortSignal)=>{
 const p=new URLSearchParams({limit:String(limit)});if(kind)p.set("type",kind==="meetings"?"meeting":"recording");
 const page=await api<{results:Array<{id:string;source:string;title:string;state:string;failureReason:string|null;createdAt:string;platform?:string|null;durationSeconds?:number|null}>}>(`/api/library/search?${p}`,{signal});
 return page.results.map(c=>({...c,source:c.source==="meeting"?"meeting_url":"audio_upload",status:c.state,platform:(c as unknown as {platform?:string|null}).platform ?? (c.source==="meeting"?"google_meet":null)}));
};
const meetingKeys=new Map<string,string>(),retryKeys=new Map<string,string>();
export async function requestMeetingCapture(meetingUrl:string,consentConfirmed:boolean,title?:string,recordVideo=false,options?:{maxDurationSeconds:number;idempotencyKey?:string;botName?:string}){
 if(consentConfirmed!==true)throw new Error("Confirm that you have the right to record this meeting.");
 const policy=await getCapturePolicy();if(!policy.meetingEnabled)throw new Error("Meeting capture is not available yet.");
 if(recordVideo && !policy.videoEnabled) throw new Error("Video recording is not enabled for this account yet.");
 const seconds=options?.maxDurationSeconds??policy.maxMeetingDurationSeconds??1800;if(!Number.isSafeInteger(seconds)||seconds<30||(policy.maxMeetingDurationSeconds!==null&&seconds>policy.maxMeetingDurationSeconds))throw new Error("Choose a duration within the meeting limit.");
 const botName=options?.botName?.trim();if(botName&&(botName.length>100||/[\u0000-\u001f\u007f]/.test(botName)))throw new Error("Choose an assistant name of up to 100 characters without control characters.");
 const body={meetingUrl:meetingUrl.trim(),maxDurationSeconds:seconds,consent:true,...(title?.trim()?{title:title.trim()}:{}),...(recordVideo?{recordVideo:true}:{}),...(botName?{botName}:{})} as Record<string, unknown>;const fingerprint=JSON.stringify(body);let key=options?.idempotencyKey??meetingKeys.get(fingerprint);if(!key){key=crypto.randomUUID();meetingKeys.set(fingerprint,key);}
 const r=await api<{id:string;duplicate?:boolean}>("/api/captures/meetings",{method:"POST",headers:{"Content-Type":"application/json","Idempotency-Key":key},body:JSON.stringify(body)});if(meetingKeys.get(fingerprint)===key)meetingKeys.delete(fingerprint);return {captureId:r.id,duplicate:r.duplicate===true};
}
export const cancelMeetingCapture=(id:string)=>api<{state:string}>(`/api/captures/${encodeURIComponent(id)}/cancel`,{method:"POST",headers:{"Content-Type":"application/json"},body:"{}"});
export async function getCapture(id:string,signal?:AbortSignal):Promise<CaptureView>{
 const c=await api<{id:string;title:string|null;source:string;state:string;createdAt:string;transcript:TranscriptSegmentView[];transcriptVersion:number|null;speakerNames:Record<string,string>;cancelRequestedAt?:string|null;failureReason?:string|null;maxDurationSeconds?:number|null;platform?:string|null;provider?:string|null;durationSeconds?:number|null;botName?:string|null;meetingUrl?:string|null;meeting_url?:string|null;recordVideo?:boolean;videoStatus?:string;videoFailure?:string|null;video?:{url:string;expiresAt:string;contentType:string;sizeBytes:number}|null;audio?:{url:string;expiresAt:string;contentType:string;sizeBytes:number}|null;audioStatus?:string;events?:Array<{status:string;detail:string|null;at:string}>;documents?:CaptureView["documents"];actions?:CaptureView["actions"];participants?:Array<{name:string;role?:string}>;metadata?:Record<string,unknown>;}>(`/api/library/captures/${encodeURIComponent(id)}`,{signal});
 return {...c,title:c.title,source:c.source==="meeting"?"meeting_url":"audio_upload",status:c.state as string,failureReason:c.failureReason?messages[c.failureReason as string]??"Processing needs attention.":null,filename:null,platform:(c as unknown as {platform?:string|null}).platform ?? (c.source==="meeting"?"google_meet":null),provider:(c as unknown as {provider?:string|null}).provider ?? null,documents:(c as unknown as {documents?:CaptureView["documents"]}).documents ?? [],events:(c as unknown as {events?:CaptureView["events"]}).events ?? [],actions:(c as unknown as {actions?:CaptureView["actions"]}).actions ?? {state:"none",error:null,items:[]},audio:(c as unknown as {audio?:CaptureView["audio"]}).audio ?? null,audioStatus:((c as unknown as {audioStatus?:string}).audioStatus as CaptureView["audioStatus"]) ?? "none",recordVideo:!!(c as unknown as {recordVideo?:boolean}).recordVideo,video:(c as unknown as {video?:CaptureView["video"]}).video ?? null,videoStatus:((c as unknown as {videoStatus?:string}).videoStatus as CaptureView["videoStatus"]) ?? "none",videoFailure:(c as unknown as {videoFailure?:string|null}).videoFailure ?? null,maxDurationSeconds:(c as unknown as {maxDurationSeconds?:number|null}).maxDurationSeconds ?? null,meetingUrl:(c as unknown as {meetingUrl?:string|null;meeting_url?:string|null}).meetingUrl ?? (c as unknown as {meeting_url?:string|null}).meeting_url ?? null,botName:(c as unknown as {botName?:string|null}).botName ?? null,durationSeconds:(c as unknown as {durationSeconds?:number|null;duration_seconds?:number|null}).durationSeconds ?? (c as unknown as {duration_seconds?:number|null}).duration_seconds ?? null} as CaptureView;
}
export const deleteCapture = (id: string) => api<void>(`/api/captures/${id}`, { method: "DELETE" });

const STATE_LABELS: Record<string, string> = {
  uploading: "Uploading",
  uploaded: "Uploaded",
  queued: "Queued",
  processing_audio: "Processing audio",
  transcribing: "Transcribing",
  generating_output: "Generating output",
  ready_to_review: "Ready to review",
  completed: "Completed",
  failed: "Failed",
  cancelled: "Cancelled",
};

const STATUS_LABELS: Record<string, string> = {
  requested: "Requested",
  scheduled: "Scheduled",
  joining: "Joining the meeting",
  waiting_for_admission: "Waiting to be let in",
  recording: "Recording",
  processing: "Processing",
  completed: "Completed",
  failed: "Failed",
  cancelled: "Cancelled",
};

export const statusLabel = (status: string) => STATUS_LABELS[status] ?? status;
const MEETING_ACTIVE = new Set(["requested", "queued", "scheduled", "joining", "waiting_for_admission", "recording", "processing"]);
export const isMeetingActive = (status: string) => MEETING_ACTIVE.has(status);

export const PLATFORM_LABELS: Record<string, string> = {
  google_meet: "Google Meet",
  microsoft_teams: "Microsoft Teams",
  zoom: "Zoom",
};

export const stateLabel = (state: string) => STATE_LABELS[state] ?? state;
export const isTerminal = (state: string) => state === "ready_to_review" || state === "completed" || state === "failed" || state === "cancelled" || state === "reconciliation_required" || state === "transcription_failed" || state === "host_denied" || state === "admission_timeout";

export interface TranscriptEditInput {
  baseVersion: number;
  /** Only the lines that changed. */
  segments?: Array<{ id: string; text: string }>;
  /** Provider label -> display name; an empty name removes it. */
  speakers?: Record<string, string>;
}

/** Saves corrections. Throws ApiError with code "version_conflict" (409) if someone else edited first. */
export const saveTranscript=(id:string,edit:TranscriptEditInput)=>api<{version:number;speakerNames:Record<string,string>}>(`/api/library/captures/${encodeURIComponent(id)}/transcript`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({expectedVersion:edit.baseVersion,segments:edit.segments,speakers:edit.speakers})});
export async function retryMeeting(id:string,consentConfirmed:boolean){
 if(consentConfirmed!==true)throw new Error("Confirm that you have the right to record this meeting again.");let key=retryKeys.get(id);if(!key){key=crypto.randomUUID();retryKeys.set(id,key);}
 const r=await api<{id:string}>(`/api/captures/${encodeURIComponent(id)}/retry`,{method:"POST",headers:{"Content-Type":"application/json","Idempotency-Key":key},body:JSON.stringify({consent:true})});return {captureId:r.id,duplicate:false};
}

/** Development only: pretend the meeting provider reported this status. */
/** Development only: pretend the meeting provider says the video is ready (the worker then fetches it). */
export const simulateVideoReady = (id: string) =>
  api<{ queued: boolean }>(`/api/dev/captures/${id}/simulate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ media: "video" }) });

export const simulateMeetingStatus = (id: string, status: string) =>
  api<{ applied: boolean }>(`/api/dev/captures/${id}/simulate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });

/** Starts looking through the conversation for action items (runs in the background). */
export const findActions = (id: string) => api<{ state: string; alreadyRunning: boolean }>(`/api/captures/${id}/actions`, { method: "POST" });

export const setActionStatus = (id: string, status: ActionStatus) =>
  api<{ id: string; status: ActionStatus }>(`/api/actions/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
