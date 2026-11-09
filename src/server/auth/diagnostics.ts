import {AsyncLocalStorage} from "node:async_hooks";
import {randomBytes,randomUUID} from "node:crypto";
export type BffStage="session_lookup"|"session_refresh"|"api_request"|"api_response";
export const bffContext=new AsyncLocalStorage<{correlationId:string;traceparent:string;stage:BffStage;endpoint:string;method:string}>();
export function requestIdentity(){return {correlationId:randomUUID(),traceparent:`00-${randomBytes(16).toString("hex")}-${randomBytes(8).toString("hex")}-01`};}
export function proxyEndpoint(segments:string[]){
 const fixed=new Set(["uploads","jobs","usage","account","dashboard","captures","documents","library","calendar","booking","plan","admin","notifications","public","audio","video","meetings","recap","questions","summary","cancel","retry","transcript","search","complete"]);
 return "/"+segments.map(s=>fixed.has(s)?s:":id").join("/");
}
export function reportBffFailure(error:unknown,status:number,upstreamStatus?:number,upstreamCorrelationId?:unknown){
 const ctx=bffContext.getStore();if(!ctx)return;
 const e=error as {cause?:{code?:unknown};name?:unknown;message?:unknown;upstreamStatus?:number;upstreamCorrelationId?:unknown};
 const storeStatus=typeof e?.message==="string"?/^Auth store request failed \(([1-5][0-9]{2})\)$/.exec(e.message):null;
 const code=e?.cause?.code;
 const diagnosticCode=typeof code==="string"&&["ECONNREFUSED","ECONNRESET","ETIMEDOUT","ENOTFOUND","EAI_AGAIN","UND_ERR_CONNECT_TIMEOUT"].includes(code)?code:e?.name==="TimeoutError"||e?.name==="AbortError"?"upstream_timeout":e?.message==="Session refresh busy"?"session_refresh_busy":storeStatus?"auth_store_unavailable":"upstream_failure";
 const ref=upstreamCorrelationId??e?.upstreamCorrelationId;
 const upstreamReference=typeof ref==="string"&&/^[a-f0-9-]{36}$/i.test(ref)?{upstreamCorrelationId:ref}:{};
 const knownStatus=upstreamStatus??e?.upstreamStatus??(storeStatus?Number(storeStatus[1]):undefined);
 console.error(JSON.stringify({event:"bff_request_failed",correlationId:ctx.correlationId,...upstreamReference,traceId:ctx.traceparent.split("-")[1],stage:ctx.stage,endpoint:ctx.endpoint,method:ctx.method,status,diagnosticCode,...(typeof knownStatus==="number"&&Number.isInteger(knownStatus)&&knownStatus>=100&&knownStatus<=599?{upstreamStatus:knownStatus}:{})}));
}
