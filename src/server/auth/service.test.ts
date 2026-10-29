import { beforeAll,afterAll,beforeEach,expect,it,vi } from "vitest";
import { createServer,type Server } from "node:http";
import { AuthService } from "./service";
import { authConfig,type AuthConfig } from "./config";
import { hashId } from "./security";
import type { AuthStore,LoginTransaction,SessionData } from "./store";
class MemoryStore implements AuthStore {
 transactions=new Map<string,LoginTransaction>();sessions=new Map<string,SessionData>();
 async putTransaction(id:string,v:LoginTransaction){this.transactions.set(id,v);}
 async consumeTransaction(id:string){const v=this.transactions.get(id)??null;this.transactions.delete(id);return v;}
 async putSession(id:string,v:SessionData){this.sessions.set(id,v);}
 async session(id:string,refresh:(v:SessionData)=>Promise<SessionData|null>){const v=this.sessions.get(id);if(!v)return null;const result=await refresh(v);if(result)this.sessions.set(id,result);else this.sessions.delete(id);return result;}
 async revoke(id:string,all:boolean){const current=this.sessions.get(id);const removed:SessionData[]=[];for(const [key,v]of this.sessions){if(key===id||(all&&current&&v.subject===current.subject)){removed.push(v);this.sessions.delete(key);}}return removed;}
}
let server:Server,origin:string,store:MemoryStore,auth:AuthService;
let calls:{path:string;body:Record<string,unknown>;authorization:string|undefined;clientIp?:string;bffProof?:string}[]=[],emailVerified=true,refreshCalls=0,revoked=false;
const userId="11111111-1111-4111-8111-111111111111";
const responseCookie=(res:Response,name="sid")=>res.headers.getSetCookie().find(x=>x.startsWith(name+"="))!.split(";")[0];
const cfg=():AuthConfig=>({appOrigin:origin,apiOrigin:origin,sessionSecret:"a".repeat(64),secure:false,callbackUrl:origin+"/api/auth/callback",sessionCookie:"sid",transactionCookie:"txn"});
function request(path:string,body:Record<string,unknown>,cookie?:string,requestOrigin?:string){return new Request(origin+path,{method:"POST",headers:{Origin:requestOrigin??origin,"Content-Type":"application/json",...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(body)});}
beforeAll(async()=>{
 server=createServer(async(req,res)=>{
  res.setHeader("Content-Type","application/json");const path=new URL(req.url!,origin).pathname;let raw="";for await(const chunk of req)raw+=chunk;const body=raw?JSON.parse(raw):{};
  calls.push({path,body,authorization:req.headers.authorization,clientIp:req.headers["x-auth-client-ip"] as string|undefined,bffProof:req.headers["x-bff-secret"] as string|undefined});
  const credentials={accessToken:"internal-access",refreshToken:"internal-refresh",expiresIn:900,user:{id:userId,email:"user@example.com",name:"Name",emailVerified}};
  if(path==="/auth/login"||path==="/auth/register"){if(body.password!=="ValidPassword1!"){res.statusCode=401;return res.end(JSON.stringify({code:"invalid_credentials"}));}return res.end(JSON.stringify(credentials));}
  if(path==="/auth/google/url")return res.end(JSON.stringify({url:"https://accounts.google.com/o/oauth2/v2/auth?state=backend-state",state:"backend-state"}));
  if(path==="/auth/google/callback"){if(body.code!=="valid-code"){res.statusCode=401;return res.end(JSON.stringify({code:"invalid_google_identity"}));}return res.end(JSON.stringify(credentials));}
  if(path==="/auth/refresh"){refreshCalls++;return res.end(JSON.stringify({...credentials,refreshToken:"rotated-refresh"}));}
  if(path==="/auth/logout"){revoked=true;return res.end(JSON.stringify({ok:true}));}
  if(path==="/account/me"){
   if(req.headers.authorization!=="Bearer internal-access"||revoked){res.statusCode=401;return res.end("{}");}
   return res.end(JSON.stringify({userId,subject:userId,email:"user@example.com",emailVerified,name:"Local name",profession:body.profession??"consultant",role:"owner",onboarded:true,theme:body.theme??"a",mode:body.mode??"system"}));
  }
  if(path.startsWith("/auth/"))return res.end(JSON.stringify({ok:true}));
  if(path==="/usage/summary")return res.end(JSON.stringify({usedSeconds:10}));
  res.statusCode=404;res.end("{}");
 });await new Promise<void>(r=>server.listen(0,"127.0.0.1",r));origin=`http://127.0.0.1:${(server.address() as {port:number}).port}`;
});
afterAll(()=>new Promise<void>(r=>server.close(()=>r())));
beforeEach(()=>{calls=[];emailVerified=true;refreshCalls=0;revoked=false;store=new MemoryStore();auth=new AuthService(cfg(),store);});
async function login(){return auth.login(request("/api/auth/login",{email:"user@example.com",password:"ValidPassword1!"}));}
it("email/password login and registration issue opaque cookies without browser tokens",async()=>{
 const res=await login();expect(res.status).toBe(200);const body=await res.json();expect(body).toEqual({ok:true,onboarded:true,emailVerified:true});expect(JSON.stringify(body)).not.toContain("internal-access");expect(responseCookie(res)).not.toContain("internal-access");
 const registration=await auth.register(request("/api/auth/register",{email:"user@example.com",password:"ValidPassword1!"}));expect(registration.status).toBe(200);
});
it("invalid credentials and cross-origin requests cannot establish sessions",async()=>{
 expect((await auth.login(request("/api/auth/login",{email:"user@example.com",password:"wrong"}))).status).toBe(401);
 const count=calls.length;expect((await auth.register(request("/api/auth/register",{},undefined,"https://foreign.invalid"))).status).toBe(403);expect(calls.length).toBe(count);
});
it("Google callback uses backend-issued internal tokens and validates single-use browser state",async()=>{
 const start=await auth.login(new Request(origin+"/api/auth/login?returnTo=/library"));expect(start.headers.get("location")).toContain("accounts.google.com");const cookie=responseCookie(start,"txn");
 const callback=new Request(origin+"/api/auth/callback?state=backend-state&code=valid-code",{headers:{cookie}});
 const res=await auth.callback(callback);expect(res.headers.get("location")).toBe(origin+"/dashboard/library");expect(calls.find(x=>x.path==="/auth/google/callback")?.body).toEqual({state:"backend-state",code:"valid-code"});
 expect(store.sessions.values().next().value?.subject).toBe(userId);const replay=await auth.callback(callback);expect(replay.headers.get("location")).toBe("/auth/login");expect(replay.headers.get("set-cookie")).toContain("calmasta_auth_error=invalid_response");
});
it("wrong or duplicate callback states do not reach the backend code exchange",async()=>{
 const start=await auth.login(new Request(origin+"/api/auth/login"));const cookie=responseCookie(start,"txn");
 await auth.callback(new Request(origin+"/api/auth/callback?state=wrong&code=valid-code",{headers:{cookie}}));expect(calls.some(x=>x.path==="/auth/google/callback")).toBe(false);
});
it("unverified accounts are directed to verification and profile verification is authoritative",async()=>{
 emailVerified=false;const res=await login();expect((await res.clone().json()).emailVerified).toBe(false);emailVerified=true;
 const profile=await auth.me(new Request(origin+"/api/me",{headers:{cookie:responseCookie(res)}}));expect((await profile.json()).emailVerified).toBe(true);
});
it("anonymous recovery and verification are explicit bounded same-origin actions",async()=>{
 for(const action of ["forgot-password","reset-password","verify-email"]){expect((await auth.action(request(`/api/auth/${action}`,{token:"token"}),action)).status).toBe(200);}
 expect((await auth.action(request("/api/auth/reset-password",{},undefined,"https://foreign.invalid"),"reset-password")).status).toBe(403);
 expect((await auth.action(request("/api/auth/change-password",{}),"change-password")).status).toBe(401);
});
it("refresh uses only internal refresh endpoint and logout revokes backend before clearing cookie",async()=>{
 const res=await login(),cookie=responseCookie(res),id=hashId(cookie.split("=")[1]);store.sessions.get(id)!.accessExpiresAt=0;
 expect((await auth.me(new Request(origin+"/api/me",{headers:{cookie}}))).status).toBe(200);expect(refreshCalls).toBe(1);expect(store.sessions.get(id)?.refreshToken).toBe("rotated-refresh");
 const out=await auth.logout(request("/api/auth/logout",{all:true},cookie));expect(out.status).toBe(200);expect(revoked).toBe(true);expect(calls.find(x=>x.path==="/auth/logout")?.body).toEqual({all:true});expect(store.sessions.size).toBe(0);
});
it("password change clears application sessions after backend revocation",async()=>{
 const res=await login();expect((await auth.action(request("/api/auth/change-password",{currentPassword:"old",newPassword:"new"},responseCookie(res)),"change-password")).status).toBe(200);expect(store.sessions.size).toBe(0);
});
it("profile mapping and ordinary API proxy preserve role separation and session protection",async()=>{
 const res=await login(),cookie=responseCookie(res);const me=await auth.me(new Request(request("/api/me",{role:"sales"},cookie),{method:"PATCH"}));const body=await me.json();expect(body.role).toBe("sales");expect(body.workspaceRole).toBe("owner");
 expect((await auth.proxy(new Request(origin+"/api/usage/summary",{headers:{cookie}}),["usage","summary"])).status).toBe(200);
 expect((await auth.proxy(new Request(origin+"/api/auth/refresh",{headers:{cookie}}),["auth","refresh"])).status).toBe(404);
});
it("production frontend configuration needs no Google secret and rejects public HTTP",()=>{
 const env={AUTH_TRUST_PROXY:"true",NODE_ENV:"production" as const,APP_URL:"https://app.invalid",CALMASTA_API_URL:"https://api.invalid",SESSION_SECRET:"a".repeat(64)};
 expect(authConfig(env).appOrigin).toBe("https://app.invalid");expect(()=>authConfig({...env,CALMASTA_API_URL:"http://89.117.56.55"})).toThrow();
});

it("propagates only the trusted proxy final client address with BFF authentication",async()=>{
 const service=new AuthService({...cfg(),trustProxy:true},store);
 const req=new Request(request("/api/auth/login",{email:"user@example.com",password:"ValidPassword1!"}),{headers:{Origin:origin,"Content-Type":"application/json","X-Forwarded-For":"203.0.113.1, 198.51.100.8"}});
 expect((await service.login(req)).status).toBe(200);
 expect(calls.find(x=>x.path==="/auth/login")?.clientIp).toBe("198.51.100.8");
 expect(calls.find(x=>x.path==="/auth/login")?.bffProof).toBe(hashId(`calmasta-bff-store:${cfg().sessionSecret}`));
});

it("Google callback failures keep errors out of the URL and log sanitized upstream diagnostics",async()=>{
 const logs=vi.spyOn(console,"error").mockImplementation(()=>{});
 try {
  const start=await auth.login(new Request(origin+"/api/auth/login"));
  const callback=new Request(origin+"/api/auth/callback?state=backend-state&code=private-invalid-code",{headers:{cookie:responseCookie(start,"txn")}});
  const result=await auth.callback(callback);
  expect(result.headers.get("location")).toBe("/auth/login");
  expect(result.headers.get("set-cookie")).toContain("calmasta_auth_error=invalid_response");
  expect(JSON.parse(logs.mock.calls[0][0])).toMatchObject({event:"google_callback_failed",stage:"code_exchange",endpoint:"/auth/google/callback",status:401,diagnosticCode:"invalid_google_identity"});
  expect(JSON.stringify(logs.mock.calls)).not.toContain("private-invalid-code");
 }finally{logs.mockRestore();}
});

it("forwards Google's issuer response parameter and rejects duplicate issuer parameters",async()=>{
 const start=await auth.login(new Request(origin+"/api/auth/login"));
 const response=await auth.callback(new Request(origin+"/api/auth/callback?state=backend-state&code=valid-code&iss=https%3A%2F%2Faccounts.google.com",{headers:{cookie:responseCookie(start,"txn")}}));
 expect(response.headers.get("location")).toBe(origin+"/dashboard");
 expect(calls.find(x=>x.path==="/auth/google/callback")?.body).toEqual({state:"backend-state",code:"valid-code",iss:"https://accounts.google.com"});
 const again=await auth.login(new Request(origin+"/api/auth/login"));
 calls=[];
 const duplicate=await auth.callback(new Request(origin+"/api/auth/callback?state=backend-state&code=valid-code&iss=https%3A%2F%2Faccounts.google.com&iss=https%3A%2F%2Fevil.invalid",{headers:{cookie:responseCookie(again,"txn")}}));
 expect(duplicate.headers.get("location")).toBe("/auth/login");
 expect(calls.some(x=>x.path==="/auth/google/callback")).toBe(false);
});

it("profile failure logs identify session lookup failures without exposing credentials",async()=>{
 const logs=vi.spyOn(console,"error").mockImplementation(()=>{});
 const session=vi.spyOn(store,"session").mockRejectedValue(Object.assign(new TypeError("private token"),{cause:{code:"ECONNRESET"}}));
 try {
  const result=await auth.me(new Request(request("/api/me",{role:"sales"},"sid=fixture"),{method:"PATCH"}));
  expect(result.status).toBe(503);
  expect(JSON.parse(logs.mock.calls[0][0])).toMatchObject({event:"profile_request_failed",endpoint:"/api/me",method:"PATCH",stage:"session",errorType:"TypeError",diagnosticCode:"ECONNRESET"});
  expect(JSON.stringify(logs.mock.calls)).not.toContain("private");
 }finally{session.mockRestore();logs.mockRestore();}
});

it("profile401 diagnostics distinguish a missing cookie from an unavailable session without logging secrets",async()=>{
 const logs=vi.spyOn(console,"warn").mockImplementation(()=>{});
 try {
  expect((await auth.me(new Request(origin+"/api/me"))).status).toBe(401);
  expect(JSON.parse(logs.mock.calls[0][0])).toMatchObject({event:"profile_session_rejected",endpoint:"/api/me",reason:"missing_cookie"});
  expect((await auth.me(new Request(origin+"/api/me",{headers:{cookie:"sid=private-session"}}))).status).toBe(401);
  expect(JSON.parse(logs.mock.calls[1][0])).toMatchObject({reason:"session_unavailable"});
  expect(JSON.stringify(logs.mock.calls)).not.toContain("private-session");
 }finally{logs.mockRestore();}
});

it("appearance PATCH is forwarded through the same authenticated profile route",async()=>{
 const loggedIn=await login();
 const response=await auth.me(new Request(request("/api/me",{theme:"e",mode:"dark"},responseCookie(loggedIn)),{method:"PATCH"}));
 expect(response.status).toBe(200);
 expect(await response.json()).toMatchObject({theme:"e",mode:"dark"});
 expect(calls.find(x=>x.path==="/account/me"&&x.body.theme)?.body).toEqual({theme:"e",mode:"dark"});
});
