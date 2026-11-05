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
