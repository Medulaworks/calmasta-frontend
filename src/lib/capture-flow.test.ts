import {afterEach,expect,it,vi} from "vitest";
import {createHash} from "node:crypto";
import {uploadAudio,requestMeetingCapture,retryMeeting,getPrivateAudio,cancelMeetingCapture} from "./upload-client";
const fetcher=vi.fn();
const policy={maxUploadBytes:1000000,maxUploadDurationSeconds:120,maxMeetingDurationSeconds:120,supportedAudioTypes:["audio/wav","audio/webm","audio/mpeg","audio/mp4","audio/ogg"],uploadEnabled:true,meetingEnabled:true,videoEnabled:false,liveProcessingEnabled:false,botName:"CalMasta Notetaker"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status});
class UploadXHR{
 static calls:Array<{url:string;headers:Record<string,string>}>=[];static status=200;
 headers:Record<string,string>={};url="";status=UploadXHR.status;timeout=0;upload={onprogress:null};onload?:()=>void;onerror?:()=>void;ontimeout?:()=>void;onabort?:()=>void;
 open(_method:string,url:string){this.url=url;}setRequestHeader(k:string,v:string){this.headers[k]=v;}send(){UploadXHR.calls.push({url:this.url,headers:this.headers});this.onload?.();}
}
afterEach(()=>{vi.unstubAllGlobals();fetcher.mockReset();UploadXHR.calls=[];UploadXHR.status=200;});
function setup(){vi.stubGlobal("fetch",fetcher);vi.stubGlobal("XMLHttpRequest",UploadXHR);}
it("uploads hashed bytes with signed headers and uses upload ID for idempotent completion",async()=>{
 setup();let intents=0,completes=0;const input={blob:new Blob(["hello"],{type:"audio/webm;codecs=opus"}),filename:"recording.webm",title:"Review",source:"voice_recording" as const,consent:true};
 fetcher.mockImplementation(async(url:string,init?:RequestInit)=>{if(url==="/api/uploads/policy")return json(policy);if(url==="/api/uploads"){intents++;const body=JSON.parse(init!.body as string);expect(body).toEqual({contentType:"audio/webm",sizeBytes:5,sha256:createHash("sha256").update("hello").digest("hex"),consent:true,title:"Review"});expect(new Headers(init?.headers).get("Idempotency-Key")).toBeTruthy();return json({id:"upload-id",captureId:"capture-id",state:"awaiting_upload",upload:{url:"https://r2.invalid/put",headers:{"Content-Type":"audio/webm","Content-Length":"5","If-None-Match":"*","x-amz-checksum-sha256":"signed-checksum"}}});}expect(url).toBe("/api/uploads/upload-id/complete");completes++;expect(new Headers(init?.headers).get("Idempotency-Key")).toBeTruthy();if(completes===1)throw new TypeError("connection lost");return json({captureId:"capture-id"});});
 await expect(uploadAudio(input,()=>{})).rejects.toThrow();await expect(uploadAudio(input,()=>{})).resolves.toBe("capture-id");expect(intents).toBe(1);expect(UploadXHR.calls).toHaveLength(1);expect(UploadXHR.calls[0].headers["Content-Length"]).toBeUndefined();expect(UploadXHR.calls[0].headers["If-None-Match"]).toBe("*");expect(UploadXHR.calls[0].headers["x-amz-checksum-sha256"]).toBe("signed-checksum");
 const keys=fetcher.mock.calls.filter(([url])=>url.includes("/complete")).map(([,init])=>new Headers(init.headers).get("Idempotency-Key"));expect(keys[0]).toBe(keys[1]);
});
it("immutable PUT conflict is completed through server verification",async()=>{
 setup();UploadXHR.status=412;fetcher.mockImplementation(async(url:string)=>url.endsWith("policy")?json(policy):url==="/api/uploads"?json({id:"upload",captureId:"capture",state:"awaiting_upload",upload:{url:"https://r2.invalid/put",headers:{"Content-Type":"audio/mpeg","Content-Length":"1","If-None-Match":"*","x-amz-checksum-sha256":"fixture"}}}):json({captureId:"capture"}));
 await expect(uploadAudio({blob:new Blob(["x"],{type:"audio/mpeg"}),filename:"a.mp3",title:"",source:"audio_upload",consent:true},()=>{})).resolves.toBe("capture");expect(fetcher.mock.calls.at(-1)?.[0]).toBe("/api/uploads/upload/complete");
});
it("requires consent and rejects unsupported or oversized audio before sending bytes",async()=>{
 setup();fetcher.mockResolvedValue(json(policy));await expect(uploadAudio({blob:new Blob(["x"],{type:"audio/webm"}),filename:"x.webm",title:"",source:"audio_upload",consent:false},()=>{})).rejects.toThrow();expect(fetcher).not.toHaveBeenCalled();
 for(const blob of [new Blob(["x"],{type:"audio/flac"}),new Blob([new Uint8Array(1000001)],{type:"audio/mpeg"})])await expect(uploadAudio({blob,filename:"x.flac",title:"",source:"audio_upload",consent:true},()=>{})).rejects.toThrow();expect(UploadXHR.calls).toHaveLength(0);
});
it("meeting requests and retries bind renewed consent, duration and stable operation keys",async()=>{
 setup();fetcher.mockImplementation(async(url:string)=>url.endsWith("policy")?json(policy):json({id:"meeting",state:"queued"}));
 await expect(requestMeetingCapture("https://meet.google.com/abc-defg-hij",false)).rejects.toThrow();expect(fetcher).not.toHaveBeenCalled();
 await requestMeetingCapture("https://meet.google.com/abc-defg-hij",true,"Planning",false,{maxDurationSeconds:60,idempotencyKey:"meeting-key"});
 const create=fetcher.mock.calls.find(([url])=>url==="/api/captures/meetings")!;expect(JSON.parse(create[1].body)).toEqual({meetingUrl:"https://meet.google.com/abc-defg-hij",maxDurationSeconds:60,consent:true,title:"Planning"});expect(new Headers(create[1].headers).get("Idempotency-Key")).toBe("meeting-key");
 await retryMeeting("old",true);await retryMeeting("old",true);const retries=fetcher.mock.calls.filter(([url])=>url.endsWith("/retry"));expect(JSON.parse(retries[0][1].body)).toEqual({consent:true});expect(new Headers(retries[0][1].headers).get("Idempotency-Key")).toBe(new Headers(retries[1][1].headers).get("Idempotency-Key"));
 await expect(requestMeetingCapture("https://meet.google.com/abc-defg-hij",true,undefined,true)).rejects.toThrow();
});
it("private playback preserves expiry and exposes gone without losing transcript state",async()=>{
 setup();fetcher.mockResolvedValueOnce(json({url:"https://r2.invalid/get",expiresAt:"2026-10-27T12:00:00Z",contentType:"audio/mpeg",sizeBytes:123}));expect((await getPrivateAudio("capture")).expiresAt).toBe("2026-10-27T12:00:00Z");expect(fetcher.mock.calls[0][0]).toBe("/api/captures/capture/audio");fetcher.mockResolvedValueOnce(json({code:"audio_unavailable"},410));await expect(getPrivateAudio("capture")).rejects.toMatchObject({status:410,code:"audio_unavailable"});
});

it("retains a meeting key after an uncertain response and retires it after confirmed success",async()=>{
 setup();let posts=0;const keys:string[]=[];fetcher.mockImplementation(async(url:string,init?:RequestInit)=>{if(url.endsWith("policy"))return json(policy);keys.push(new Headers(init?.headers).get("Idempotency-Key")!);if(++posts===1)throw new TypeError("unknown outcome");return json({id:"meeting",state:"queued"});});
 const send=()=>requestMeetingCapture("https://meet.google.com/recurring",true,"Weekly",false,{maxDurationSeconds:60});
 await expect(send()).rejects.toThrow();await send();await send();expect(keys[0]).toBe(keys[1]);expect(keys[2]).not.toBe(keys[1]);
});

it("rejects operations when policy disables upload or meeting capture",async()=>{
 setup();const disabledPolicy={...policy,uploadEnabled:false,meetingEnabled:false};
 fetcher.mockResolvedValue(json(disabledPolicy));
 await expect(uploadAudio({blob:new Blob(["data"],{type:"audio/webm"}),filename:"rec.webm",title:"T",source:"voice_recording",consent:true},()=>{})).rejects.toThrow("Uploading is not enabled for this account yet.");
 await expect(requestMeetingCapture("https://meet.google.com/abc-defg-hij",true)).rejects.toThrow("Meeting capture is not available yet.");
});

it("sends meeting cancellation and handles capture states",async()=>{
 setup();fetcher.mockResolvedValue(json({state:"cancelled"}));
 const res=await cancelMeetingCapture("cap-123");
 expect(res.state).toBe("cancelled");
 expect(fetcher.mock.calls[0][0]).toBe("/api/captures/cap-123/cancel");
 expect(fetcher.mock.calls[0][1]?.method).toBe("POST");
});
