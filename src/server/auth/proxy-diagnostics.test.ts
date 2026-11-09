import {afterEach,expect,it,vi} from "vitest";
import {AuthService} from "./service";
import type {AuthStore,SessionData} from "./store";
const session:SessionData={subject:"fixture-user",accessToken:"private-token",refreshToken:"private-refresh",accessExpiresAt:Date.now()+900000,email:"fixture@example.invalid",emailVerified:true,identityName:null};
function service(options:{storeError?:Error;expired?:boolean}={}){
 const store={session:async(_id:string,refresh:(v:SessionData)=>Promise<SessionData|null>)=>{if(options.storeError)throw options.storeError;return refresh({...session,accessExpiresAt:options.expired?0:session.accessExpiresAt});}} as AuthStore;
 return new AuthService({appOrigin:"https://app.invalid",apiOrigin:"https://api.invalid",sessionSecret:"s".repeat(64),secure:false,callbackUrl:"https://app.invalid/api/auth/callback",sessionCookie:"sid",transactionCookie:"txn"},store);
}
const id="11111111-1111-4111-8111-111111111111";
const request=()=>new Request(`https://app.invalid/api/captures/${id}/audio?private-query=secret`,{headers:{cookie:"sid=private-session"}});
afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks();});
it("playback transport failure has a safe error, support reference and correlated diagnostic",async()=>{
 const logs=vi.spyOn(console,"error").mockImplementation(()=>{});
 const fetcher=vi.fn().mockRejectedValue(new TypeError("private exception",{cause:{code:"ECONNREFUSED"}}));vi.stubGlobal("fetch",fetcher);
 const res=await service().proxy(request(),["captures",id,"audio"]);const body=await res.json();
 expect(res.status).toBe(503);expect(body.code).toBe("service_unavailable");expect(body.error).not.toContain("Authentication");
 expect(body.correlationId).toMatch(/^[a-f0-9-]{36}$/);expect(res.headers.get("x-correlation-id")).toBe(body.correlationId);
 const log=JSON.parse(logs.mock.calls[0][0]);expect(log).toMatchObject({event:"bff_request_failed",stage:"api_request",endpoint:"/captures/:id/audio",diagnosticCode:"ECONNREFUSED",correlationId:body.correlationId});
 expect(fetcher.mock.calls[0][1].headers["x-correlation-id"]).toBe(body.correlationId);
 const output=JSON.stringify([body,log]);for(const value of [id,"private-token","private-session","private-query","private exception"])expect(output).not.toContain(value);
});
it("session store failure is distinguished from playback connection failure",async()=>{
 const logs=vi.spyOn(console,"error").mockImplementation(()=>{});vi.stubGlobal("fetch",vi.fn());
 const res=await service({storeError:Error("Auth store request failed (503)")}).proxy(request(),["captures",id,"audio"]);const body=await res.json();
 expect(body.code).toBe("session_service_unavailable");expect(JSON.parse(logs.mock.calls[0][0])).toMatchObject({stage:"session_lookup",upstreamStatus:503});
});
it("failed refresh is classified without clearing the browser session",async()=>{
 const logs=vi.spyOn(console,"error").mockImplementation(()=>{});vi.stubGlobal("fetch",vi.fn().mockResolvedValue(Response.json({code:"internal_error"},{status:500})));
 const res=await service({expired:true}).proxy(request(),["captures",id,"audio"]);const body=await res.json();
 expect(body.code).toBe("session_refresh_unavailable");expect(res.headers.get("set-cookie")).toBeNull();expect(JSON.parse(logs.mock.calls[0][0])).toMatchObject({stage:"session_refresh",upstreamStatus:500});
});
it("upstream playback 5xx retains its code and emits a correlated failure",async()=>{
 const logs=vi.spyOn(console,"error").mockImplementation(()=>{});vi.stubGlobal("fetch",vi.fn().mockResolvedValue(Response.json({code:"storage_unavailable"},{status:503})));
 const res=await service().proxy(request(),["captures",id,"audio"]);const body=await res.json();
 expect(body.code).toBe("storage_unavailable");expect(body.correlationId).toBeTruthy();expect(JSON.parse(logs.mock.calls[0][0])).toMatchObject({stage:"api_response",upstreamStatus:503});
});
it("expired sessions still return 401 without a service failure alert",async()=>{
 const logs=vi.spyOn(console,"error").mockImplementation(()=>{});vi.stubGlobal("fetch",vi.fn().mockResolvedValue(Response.json({code:"unauthorized"},{status:401})));
 const res=await service({expired:true}).proxy(request(),["captures",id,"audio"]);expect(res.status).toBe(401);expect(logs).not.toHaveBeenCalled();
});
it("parallel proxy requests have distinct request identities",async()=>{
 vi.stubGlobal("fetch",vi.fn().mockResolvedValue(Response.json({ok:true})));
 const a=service();const results=await Promise.all([a.proxy(request(),["captures",id,"audio"]),a.proxy(request(),["captures",id,"audio"])]);
 expect(results[0].headers.get("x-correlation-id")).toBeTruthy();expect(results[0].headers.get("x-correlation-id")).not.toBe(results[1].headers.get("x-correlation-id"));
});

it("malformed upstream JSON is a reported service failure instead of a successful playback response",async()=>{
 const logs=vi.spyOn(console,"error").mockImplementation(()=>{});vi.stubGlobal("fetch",vi.fn().mockResolvedValue(new Response("private broken body",{status:200})));
 const res=await service().proxy(request(),["captures",id,"audio"]);expect(res.status).toBe(503);const body=await res.json();expect(body.code).toBe("service_unavailable");expect(JSON.parse(logs.mock.calls[0][0])).toMatchObject({stage:"api_response"});expect(JSON.stringify(body)).not.toContain("private broken body");
});

it("retains backend support references in logs even without an exported trace",async()=>{
 const logs=vi.spyOn(console,"error").mockImplementation(()=>{});const backendId="22222222-2222-4222-8222-222222222222";
 vi.stubGlobal("fetch",vi.fn().mockResolvedValue(Response.json({code:"storage_unavailable",correlationId:backendId},{status:503,headers:{"x-correlation-id":backendId}})));
 const res=await service().proxy(request(),["captures",id,"audio"]);const body=await res.json();expect(body.correlationId).not.toBe(backendId);expect(JSON.parse(logs.mock.calls[0][0])).toMatchObject({correlationId:body.correlationId,upstreamCorrelationId:backendId});
});
