import { afterEach, expect, it, vi } from "vitest";
import { AuthService } from "./service";
import type { AuthStore, SessionData } from "./store";
const app = "http://localhost:3006";
const session: SessionData = {subject:"u",accessToken:"fixture-access",accessExpiresAt:Date.now()+60000,email:"owner@example.test",emailVerified:true,identityName:null};
const store: AuthStore = {putTransaction:vi.fn(),consumeTransaction:vi.fn(),putSession:vi.fn(),session:async()=>session,revoke:async()=>[]};
const auth = new AuthService({appOrigin:app,apiOrigin:"http://api.test",sessionSecret:"a".repeat(64),secure:false,sessionCookie:"sid",transactionCookie:"txn",callbackUrl:app+"/api/auth/callback"},store);
afterEach(()=>vi.unstubAllGlobals());
it.each(["recap","questions"])("forwards authenticated bodyless %s without inventing JSON", async kind => {
 const fetcher=vi.fn().mockResolvedValue(Response.json({id:"a",state:"blocked",failureReason:"quota_exceeded"},{status:202})); vi.stubGlobal("fetch",fetcher);
 const res=await auth.proxy(new Request(`${app}/api/captures/m/${kind}`,{method:"POST",headers:{Origin:app,Cookie:"sid=fixture"}}),["captures","m",kind]);
 expect(res.status).toBe(202); expect((await res.json()).state).toBe("blocked");
 expect(fetcher.mock.calls[0][1]).toMatchObject({method:"POST",body:undefined,headers:expect.objectContaining({Authorization:"Bearer fixture-access"})});
});
it("preserves origin/session guards and JSON requirements on other POST routes", async () => {
 const fetcher=vi.fn();vi.stubGlobal("fetch",fetcher);
 for(const [origin,cookie,path,status] of [["https://foreign.test","sid=fixture","recap",403],[app,"","questions",401],[app,"sid=fixture","cancel",415]] as const){
  const res=await auth.proxy(new Request(`${app}/api/captures/m/${path}`,{method:"POST",headers:{Origin:origin,Cookie:cookie}}),["captures","m",path]); expect(res.status).toBe(status);
 }
 expect(fetcher).not.toHaveBeenCalled();
});
it("rejects bodies on no-body insight endpoints", async () => {
 vi.stubGlobal("fetch",vi.fn());
 const res=await auth.proxy(new Request(`${app}/api/captures/m/recap`,{method:"POST",headers:{Origin:app,Cookie:"sid=fixture","Content-Type":"application/json"},body:'{"recipient":"arbitrary@example.test"}'}),["captures","m","recap"]);
 expect(res.status).toBe(400); expect(fetch).not.toHaveBeenCalled();
});

it.each(["recap", "questions"])("forwards a zero-byte POST stream for %s as no body", async kind => {
 const fetcher=vi.fn().mockResolvedValue(Response.json({id:"a",state:"queued",failureReason:null},{status:202}));vi.stubGlobal("fetch",fetcher);
 const req=new Request(`${app}/api/captures/m/${kind}`,{method:"POST",headers:{Origin:app,Cookie:"sid=fixture","Content-Length":"0"},body:""});
 expect(req.body).not.toBeNull();
 const res=await auth.proxy(req,["captures","m",kind]);
 expect(res.status).toBe(202);expect(fetcher).toHaveBeenCalledOnce();expect(fetcher.mock.calls[0][1].body).toBeUndefined();
});
it.each(["{}", " ", '{"recipient":"arbitrary@example.test"}'])("does not forward nonempty insight payload %s",async body=>{
 const fetcher=vi.fn();vi.stubGlobal("fetch",fetcher);
 const req=new Request(`${app}/api/captures/m/questions`,{method:"POST",headers:{Origin:app,Cookie:"sid=fixture","Content-Type":"application/json"},body});
 const res=await auth.proxy(req,["captures","m","questions"]);expect(res.status).toBe(400);expect(fetcher).not.toHaveBeenCalled();
});
it("rejects a streaming payload at its first nonempty chunk without buffering it", async()=>{
 let cancelled=false;const stream=new ReadableStream<Uint8Array>({start(controller){controller.enqueue(new Uint8Array());controller.enqueue(new TextEncoder().encode("x"));},cancel(){cancelled=true;}});
 vi.stubGlobal("fetch",vi.fn());
 const req=new Request(`${app}/api/captures/m/questions`,{method:"POST",headers:{Origin:app,Cookie:"sid=fixture"},body:stream,duplex:"half"} as RequestInit);
 const res=await auth.proxy(req,["captures","m","questions"]);expect(res.status).toBe(400);expect(cancelled).toBe(true);expect(fetch).not.toHaveBeenCalled();
});

it("forwards bounded transcript imports with their idempotency key and preserves auth and origin guards",async()=>{
 const fetcher=vi.fn().mockResolvedValue(Response.json({captureId:"text",state:"completed"},{status:201}));vi.stubGlobal("fetch",fetcher);
 const request=(origin=app,cookie="sid=fixture",text="x".repeat(100000))=>new Request(`${app}/api/captures/transcripts`,{method:"POST",headers:{Origin:origin,Cookie:cookie,"Content-Type":"application/json","Idempotency-Key":"import-key"},body:JSON.stringify({text,consent:true})});
 expect((await auth.proxy(request(),["captures","transcripts"])).status).toBe(201);
 expect(fetcher.mock.calls[0][1].headers["Idempotency-Key"]).toBe("import-key"); expect(JSON.parse(fetcher.mock.calls[0][1].body).text).toHaveLength(100000);
 fetcher.mockClear();
 expect((await auth.proxy(request(),["captures","transcripts","extra"])).status).toBe(413);
 expect((await auth.proxy(request("https://foreign.test"),["captures","transcripts"])).status).toBe(403);
 expect((await auth.proxy(request(app,""),["captures","transcripts"])).status).toBe(401);
 expect((await auth.proxy(request(app,"sid=fixture","x".repeat(1048577)),["captures","transcripts"])).status).toBe(413);
 expect(fetcher).not.toHaveBeenCalled();
});

it("forwards max-length multibyte imported transcript edits within a bounded 1MiB allowance",async()=>{
 const fetcher=vi.fn().mockResolvedValue(Response.json({version:2}));vi.stubGlobal("fetch",fetcher);
 const text="界".repeat(100000),segments=Array.from({length:13},(_,i)=>({id:`segment-${i}`,text:text.slice(i*8000,(i+1)*8000)}));
 const request=(size?:number)=>new Request(`${app}/api/library/captures/text/transcript`,{method:"PATCH",headers:{Origin:app,Cookie:"sid=fixture","Content-Type":"application/json"},body:JSON.stringify(size?{text:"x".repeat(size)}:{baseVersion:1,segments,speakers:{}})});
 expect((await auth.proxy(request(),["library","captures","text","transcript"])).status).toBe(200);
 expect(JSON.parse(fetcher.mock.calls[0][1].body).segments.map((s:{text:string})=>s.text).join("")).toBe(text);
 fetcher.mockClear();expect((await auth.proxy(request(1048577),["library","captures","text","transcript"])).status).toBe(413);expect(fetcher).not.toHaveBeenCalled();
});
