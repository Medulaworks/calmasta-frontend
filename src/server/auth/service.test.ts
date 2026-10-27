import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import { generateKeyPair, exportJWK, SignJWT } from "jose";
import { authConfig, type AuthConfig } from "./config";
import { AuthService } from "./service";
import type { AuthStore, LoginTransaction, SessionData } from "./store";
import { hashId } from "./security";

class MemoryStore implements AuthStore {
  transactions=new Map<string, LoginTransaction>(); sessions=new Map<string, SessionData>();
  async putTransaction(id:string, data:LoginTransaction){this.transactions.set(id,data);}
  async consumeTransaction(id:string){const data=this.transactions.get(id)??null;this.transactions.delete(id);return data;}
  async putSession(id:string,data:SessionData){this.sessions.set(id,data);}
  async session(id:string,refresh:(data:SessionData)=>Promise<SessionData|null>){
    const old=this.sessions.get(id);if(!old)return null;const data=await refresh(old);if(data)this.sessions.set(id,data);else this.sessions.delete(id);return data;
  }
  async revoke(id:string,all:boolean){const current=this.sessions.get(id);if(!current)return [];const removed:SessionData[]=[];
    for(const [key,value] of this.sessions)if(key===id||all&&value.subject===current.subject){removed.push(value);this.sessions.delete(key);}return removed;}
}
let server:Server, origin:string, key:Awaited<ReturnType<typeof generateKeyPair>>, wrongKey:Awaited<ReturnType<typeof generateKeyPair>>;
let nonce="", challenge="", tokenCalls=0, refreshCalls=0, profileCalls=0, verified=true, invalidSignature=false, invalidNonce=false, wrongSubject=false;
const cookieFrom=(response:Response,name:string)=>response.headers.getSetCookie().find(value=>value.startsWith(name+"="))!.split(";")[0];
const fixtureConfig=():AuthConfig=>({appOrigin:origin,apiOrigin:origin,issuer:origin,clientId:"fixture-client",projectId:"project",sessionSecret:"a".repeat(64),databaseUrl:"unused",secure:false,callbackUrl:origin+"/api/auth/callback",sessionCookie:"sid",transactionCookie:"txn"});
beforeAll(async()=>{
  key=await generateKeyPair("RS256");wrongKey=await generateKeyPair("RS256");const jwk=await exportJWK(key.publicKey);jwk.kid="fixture";
  server=createServer(async(req,res)=>{
    res.setHeader("Content-Type","application/json");
    const path=new URL(req.url!,origin).pathname;
    if(path==="/.well-known/openid-configuration")return res.end(JSON.stringify({issuer:origin,authorization_endpoint:origin+"/authorize",token_endpoint:origin+"/token",userinfo_endpoint:origin+"/userinfo",jwks_uri:origin+"/jwks",revocation_endpoint:origin+"/revoke",end_session_endpoint:origin+"/logout",response_types_supported:["code"],subject_types_supported:["public"],id_token_signing_alg_values_supported:["RS256"],token_endpoint_auth_methods_supported:["none"],code_challenge_methods_supported:["S256"]}));
    if(path==="/jwks")return res.end(JSON.stringify({keys:[jwk]}));
    if(path==="/token"){
      let body="";for await (const chunk of req)body+=chunk;const params=new URLSearchParams(body);tokenCalls++;
      if(params.get("grant_type")==="refresh_token")refreshCalls++;
      else {const {createHash}=await import("node:crypto");if(createHash("sha256").update(params.get("code_verifier")??"").digest("base64url")!==challenge){res.statusCode=400;return res.end(JSON.stringify({error:"invalid_grant"}));}}
      const id=await new SignJWT({nonce:invalidNonce?"wrong":nonce,email:"person@example.invalid",email_verified:verified})
        .setProtectedHeader({alg:"RS256",kid:"fixture"}).setSubject("user").setIssuer(origin).setAudience("fixture-client").setIssuedAt().setExpirationTime("5m").sign(invalidSignature?wrongKey.privateKey:key.privateKey);
      return res.end(JSON.stringify({access_token:"access-fixture",token_type:"Bearer",expires_in:300,refresh_token:"refresh-fixture",id_token:id}));
    }
    if(path==="/userinfo")return res.end(JSON.stringify({sub:"user",email:"person@example.invalid",email_verified:verified,name:"Identity Name"}));
    if(path==="/revoke")return res.end("{}");
    if(path==="/account/me"){
      profileCalls++;if(req.headers.authorization!=="Bearer access-fixture"){res.statusCode=401;return res.end("{}");}
      let body="";for await(const chunk of req)body+=chunk;const patch=body?JSON.parse(body):{};
      return res.end(JSON.stringify({subject:wrongSubject?"other":"user",role:"owner",profession:patch.profession??null,name:null,onboarded:patch.complete??false,isStaff:false,timezone:"UTC",outputsOnly:false,audioRetentionDays:14,defaultTemplate:"summary_and_actions"}));
    }
    if(path==="/uploads")return res.end(JSON.stringify({id:"fixture-upload",authenticated:req.headers.authorization==="Bearer access-fixture",idempotencyKey:req.headers["idempotency-key"]}));
    res.statusCode=404;res.end("{}");
  });
  await new Promise<void>(resolve=>server.listen(0,"127.0.0.1",resolve));
  origin=`http://127.0.0.1:${(server.address() as {port:number}).port}`;
});
afterAll(()=>new Promise<void>(resolve=>server.close(()=>resolve())));
async function begin(auth:AuthService){
  const response=await auth.login(new Request(origin+"/api/auth/login?returnTo=/library&signup=1"));
  const url=new URL(response.headers.get("location")!);nonce=url.searchParams.get("nonce")!;challenge=url.searchParams.get("code_challenge")!;
  return {response,url,cookie:cookieFrom(response,"txn")};
}
async function complete(auth:AuthService,start:Awaited<ReturnType<typeof begin>>){return auth.callback(new Request(origin+"/api/auth/callback?code=fixture&state="+start.url.searchParams.get("state"),{headers:{cookie:start.cookie}}));}

describe("OIDC session and API flow",()=>{
 it("validates PKCE/code exchange and signature, provisions profile and keeps tokens server-side",async()=>{
  const store=new MemoryStore(),auth=new AuthService(fixtureConfig(),store),start=await begin(auth);
  expect(start.url.searchParams.get("code_challenge_method")).toBe("S256");expect(start.url.searchParams.get("prompt")).toBe("create");
  expect(start.url.searchParams.get("scope")).toContain("urn:zitadel:iam:org:project:id:project:aud");
  const callback=await complete(auth,start);expect(callback.headers.get("location")).toBe(origin+"/welcome");
  const browser=cookieFrom(callback,"sid");expect(browser).not.toContain("access-fixture");
  const profile=await auth.me(new Request(origin+"/api/me",{headers:{cookie:browser}}));
  expect(profile.status).toBe(200);expect(await profile.json()).toMatchObject({email:"person@example.invalid",emailVerified:true,role:null,workspaceRole:"owner",name:null});
  const patch=await auth.me(new Request(origin+"/api/me",{method:"PATCH",headers:{cookie:browser,origin,"content-type":"application/json"},body:JSON.stringify({role:"consultant",complete:true})}));
  expect(await patch.json()).toMatchObject({profession:"consultant",role:"consultant",workspaceRole:"owner",onboarded:true});
  const replay=await complete(auth,start);expect(replay.headers.get("location")).toContain("login_expired");
 });
 it("rejects wrong state without token exchange, forged signatures, nonce mismatch and unverified email",async()=>{
  const store=new MemoryStore(),auth=new AuthService(fixtureConfig(),store);let start=await begin(auth);const before=tokenCalls;
  const wrong=await auth.callback(new Request(origin+"/api/auth/callback?code=fixture&state=wrong",{headers:{cookie:start.cookie}}));
  expect(wrong.headers.get("location")).toContain("invalid_response");expect(tokenCalls).toBe(before);
  invalidSignature=true;start=await begin(auth);expect((await complete(auth,start)).headers.get("location")).toContain("invalid_response");invalidSignature=false;
  invalidNonce=true;start=await begin(auth);expect((await complete(auth,start)).headers.get("location")).toContain("invalid_response");invalidNonce=false;
  verified=false;start=await begin(auth);expect((await complete(auth,start)).headers.get("location")).toContain("email_unverified");verified=true;
  expect(store.sessions.size).toBe(0);
 });
 it("rejects cross-site writes, translates profession and rejects privilege fields",async()=>{
  const store=new MemoryStore(),auth=new AuthService(fixtureConfig(),store),start=await begin(auth);const browser=cookieFrom(await complete(auth,start),"sid");
  const req=(body:unknown,requestOrigin=origin)=>new Request(origin+"/api/me",{method:"PATCH",headers:{cookie:browser,origin:requestOrigin,"content-type":"application/json"},body:JSON.stringify(body)});
  expect((await auth.me(req({role:"consultant"},"https://evil.invalid"))).status).toBe(403);
  expect((await auth.me(req({workspaceRole:"admin"}))).status).toBe(400);
  expect((await auth.logout(new Request(origin+"/api/auth/logout",{method:"POST",headers:{cookie:browser,origin:"https://evil.invalid","content-type":"application/json"},body:"{}"}))).status).toBe(403);
  expect(store.sessions.size).toBe(1);
 });
 it("refreshes expired tokens, forwards only server tokens and revokes all local sessions",async()=>{
  const store=new MemoryStore(),auth=new AuthService(fixtureConfig(),store),start=await begin(auth);const browser=cookieFrom(await complete(auth,start),"sid");
  const id=hashId(browser.split("=")[1]),session=store.sessions.get(id)!;session.accessExpiresAt=0;
  await store.putSession("another",{...session});await store.putSession("different-user",{...session,subject:"other-user"});
  const before=refreshCalls;
  const result=await auth.proxy(new Request(origin+"/api/uploads",{method:"POST",headers:{cookie:browser,origin,"content-type":"application/json",authorization:"Bearer injected","idempotency-key":"retry-1"},body:"{}"}),["uploads"]);
  expect(await result.json()).toEqual({id:"fixture-upload",authenticated:true,idempotencyKey:"retry-1"});expect(refreshCalls).toBe(before+1);
  const logout=await auth.logout(new Request(origin+"/api/auth/logout",{method:"POST",headers:{cookie:browser,origin,"content-type":"application/json"},body:'{"all":true}'}));
  expect(await logout.json()).toMatchObject({scope:"all_calmasta_sessions",providerRevocation:"completed"});
  expect(store.sessions.size).toBe(1);expect(store.sessions.has("different-user")).toBe(true);
  expect((await auth.me(new Request(origin+"/api/me",{headers:{cookie:browser}}))).status).toBe(401);
 });
 it("rejects API path traversal and mismatched backend identity",async()=>{
  const store=new MemoryStore(),auth=new AuthService(fixtureConfig(),store),start=await begin(auth);const browser=cookieFrom(await complete(auth,start),"sid");
  const before=profileCalls;
  expect((await auth.proxy(new Request(origin+"/api/implementation",{headers:{cookie:browser}}),["implementation"])).status).toBe(404);
  expect((await auth.proxy(new Request(origin+"/api/uploads",{headers:{cookie:browser}}),["uploads",".."])) .status).toBe(404);
  expect(profileCalls).toBe(before);wrongSubject=true;
  expect((await auth.me(new Request(origin+"/api/me",{headers:{cookie:browser}}))).status).toBe(401);wrongSubject=false;
 });
 it("requires HTTPS to public backend and production app, keeping local development usable",()=>{
  const env={NODE_ENV:"production" as const,APP_URL:"http://public.invalid",CALMASTA_API_URL:"http://127.0.0.1:3000",ZITADEL_ISSUER:"https://identity.invalid",ZITADEL_CLIENT_ID:"client",ZITADEL_PROJECT_ID:"project",SESSION_SECRET:"a".repeat(64),DATABASE_URL:"private"};
  expect(()=>authConfig(env)).toThrow();expect(()=>authConfig({...env,APP_URL:"https://app.invalid",CALMASTA_API_URL:"http://89.117.56.55"})).toThrow();
  expect(authConfig({...env,APP_URL:"https://app.invalid"}).sessionCookie).toBe("__Host-calmasta_session");
 });
});

it("uses the larger edit limit only for transcript PATCH and retains origin checks",async()=>{
 const store=new MemoryStore(),auth=new AuthService(fixtureConfig(),store),start=await begin(auth);const browser=cookieFrom(await complete(auth,start),"sid");
 const path=["library","captures","11111111-1111-4111-8111-111111111111","transcript"];
 const req=(originHeader=origin)=>new Request(origin+"/api/"+path.join("/"),{method:"PATCH",headers:{cookie:browser,origin:originHeader,"content-type":"application/json"},body:JSON.stringify({text:"x".repeat(17000)})});
 // The fixture backend intentionally has no library route: 404 proves this passed the proxy body parser.
 expect((await auth.proxy(req(),path)).status).toBe(404);
 expect((await auth.proxy(req(),["uploads"])).status).toBe(413);
 expect((await auth.proxy(req("https://evil.invalid"),path)).status).toBe(403);
});
