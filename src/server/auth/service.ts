import {bffContext,requestIdentity,proxyEndpoint,reportBffFailure} from "./diagnostics";
import { isIP } from "node:net";
import { authErrorRedirect } from "./flash";
import type { AuthConfig } from "./config";
import type { AuthStore, SessionData } from "./store";
import { cookie,hashId,HttpError,opaqueId,readCookie,readJson,assertEmptyBody,safeReturnTo,sameOrigin } from "./security";
type Profile=Record<string,unknown>&{userId:string;subject:string;role:string;onboarded:boolean};
type Credentials={accessToken:string;refreshToken:string;expiresIn:number;user:{id:string;email:string;name:string|null;emailVerified:boolean}};
const headers={"Cache-Control":"no-store","Pragma":"no-cache"};
const json=(body:unknown,status=200)=>Response.json(body,{status,headers});
export class AuthService {
 constructor(private config:AuthConfig,private store:AuthStore){}
 private setCookie(res:Response,name:string,value:string,age:number){res.headers.append("Set-Cookie",cookie(name,value,this.config.secure,age));return res;}
 private redirect(path:string){return new Response(null,{status:303,headers:{...headers,Location:new URL(path,this.config.appOrigin).href}});}
 private checkOrigin(req:Request){if(!sameOrigin(req,this.config.appOrigin))throw new HttpError(403,"Request origin not allowed");}
 private clientIp(req:Request){
  if(this.config.trustProxy){const ip=req.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim();if(ip&&isIP(ip))return ip;throw new HttpError(503,"Trusted client IP is unavailable");}
  if(this.config.secure)throw new HttpError(503,"Trusted proxy is not configured");return "127.0.0.1";
 }
 private async upstream(path:string,method="GET",body?:Record<string,unknown>,session?:SessionData,key?:string,clientIp?:string){
  const h:Record<string,string>={Accept:"application/json"};if(body!==undefined)h["Content-Type"]="application/json";if(session)h.Authorization=`Bearer ${session.accessToken}`;if(key)h["Idempotency-Key"]=key;
  if(clientIp){h["X-Auth-Client-IP"]=clientIp;h["X-Bff-Secret"]=hashId(`calmasta-bff-store:${this.config.sessionSecret}`);}
  const identity=bffContext.getStore()??requestIdentity();
  h["traceparent"]=identity.traceparent;h["x-correlation-id"]=identity.correlationId;
  return fetch(new URL(path,this.config.apiOrigin),{method,headers:h,body:body===undefined?undefined:JSON.stringify(body),cache:"no-store",redirect:"error",signal:AbortSignal.timeout(15000)});
 }
 private api(session:SessionData,path:string,method="GET",body?:Record<string,unknown>,key?:string){return this.upstream(path,method,body,session,key);}
 private async errorBody(res:Response){const data=await res.json().catch(()=>({}));return json({error:data.code??"Authentication request failed"},res.status);}
 private async establishSession(req:Request,data:Credentials,returnTo?:string){
  const value:SessionData={subject:data.user.id,accessToken:data.accessToken,refreshToken:data.refreshToken,accessExpiresAt:Date.now()+data.expiresIn*1000,email:data.user.email,emailVerified:data.user.emailVerified,identityName:data.user.name};
  const profile=await this.profile(value);const id=opaqueId();
  await this.store.putSession(hashId(id),value,Date.now()+30*86400000);
  const previous=readCookie(req,this.config.sessionCookie);if(previous)await this.store.revoke(hashId(previous),false);
  const destination=!profile.emailVerified?"/auth/verify-email":profile.onboarded?safeReturnTo(returnTo??null):"/dashboard/welcome";
  const res=returnTo!==undefined?this.redirect(destination):json({ok:true,onboarded:profile.onboarded,emailVerified:profile.emailVerified});
  return this.setCookie(res,this.config.sessionCookie,id,30*86400);
 }
 async register(req:Request){return this.credentials(req,"register");}
 private async credentials(req:Request,action:"register"|"login"){
  try{this.checkOrigin(req);const body=await readJson(req);const res=await this.upstream(`/auth/${action}`,"POST",body,undefined,undefined,this.clientIp(req));if(!res.ok)return this.errorBody(res);return await this.establishSession(req,await res.json());}catch(e){return this.error(e);}
 }
 async login(req:Request){
  if(req.method==="POST")return this.credentials(req,"login");
  try{
   const provider=new URL(req.url).searchParams.get("provider")==="microsoft"?"microsoft":"google";
   const endpoint=provider==="microsoft"?"/auth/microsoft/url":"/auth/google/url";
   const res=await this.upstream(endpoint,"GET",undefined,undefined,undefined,this.clientIp(req));if(!res.ok)throw Error(`${provider} unavailable`);const data=await res.json() as {url:string;state:string};
   const target=new URL(data.url);const validHost=provider==="microsoft"?target.hostname==="login.microsoftonline.com":target.hostname==="accounts.google.com";if(target.protocol!=="https:"||!validHost||typeof data.state!=="string")throw Error("Invalid authorization URL");
   const id=opaqueId();await this.store.putTransaction(hashId(id),{state:data.state,returnTo:safeReturnTo(new URL(req.url).searchParams.get("returnTo")),provider});
   return this.setCookie(new Response(null,{status:303,headers:{...headers,Location:target.href}}),this.config.transactionCookie,id,600);
  }catch{return authErrorRedirect("not_configured",this.config.secure);}
 }
 async microsoftUrl(req:Request){
  try{
   this.checkOrigin(req);
   const res=await this.upstream("/auth/microsoft/url","GET",undefined,undefined,undefined,this.clientIp(req));if(!res.ok)return this.errorBody(res);const data=await res.json() as {url:string;state:string};
   const target=new URL(data.url);if(target.protocol!=="https:"||target.hostname!=="login.microsoftonline.com"||typeof data.state!=="string")throw Error("Invalid authorization URL");
   const id=opaqueId();await this.store.putTransaction(hashId(id),{state:data.state,returnTo:safeReturnTo(new URL(req.url).searchParams.get("returnTo")),provider:"microsoft"});
   const response=Response.json({url:target.href,state:data.state},{headers});
   return this.setCookie(response,this.config.transactionCookie,id,600);
  }catch(error){return error instanceof HttpError?this.error(error):json({error:"Microsoft sign-in is temporarily unavailable. Please try again."},503);}
 }
 async microsoftCallback(req:Request){
  let stage="transaction";
  try{
   const id=readCookie(req,this.config.transactionCookie),txn=id?await this.store.consumeTransaction(hashId(id)):null;
   const body=await readJson(req) as {code?:unknown;state?:unknown};
   stage="validation";
   if(!txn||txn.provider!=="microsoft"||typeof body.code!=="string"||typeof body.state!=="string"||body.state!==txn.state)throw Error("Invalid callback");
   stage="code_exchange";
   const upstream=await this.upstream("/auth/microsoft/callback","POST",{state:txn.state,code:body.code},undefined,undefined,this.clientIp(req));
   if(!upstream.ok){
    const b=await upstream.json().catch(()=>({}));const diagnosticCode=["account_link_required","invalid_microsoft_transaction","invalid_microsoft_identity","too_many_auth_attempts","internal_error"].includes(b.code)?b.code:"unknown";
    const correlation=upstream.headers.get("x-correlation-id");const correlationId=correlation&&/^[a-f0-9-]{36}$/i.test(correlation)?correlation:undefined;
    console.error(JSON.stringify({event:"microsoft_callback_failed",stage,method:"POST",endpoint:"/auth/microsoft/callback",status:upstream.status,diagnosticCode,correlationId}));
    return this.setCookie(authErrorRedirect(b.code==="account_link_required"?"account_link_required":"invalid_response",this.config.secure),this.config.transactionCookie,"",0);
   }
   stage="session";const res=await this.establishSession(req,await upstream.json(),txn.returnTo);
   return this.setCookie(res,this.config.transactionCookie,"",0);
  }catch{
   console.error(JSON.stringify({event:"microsoft_callback_failed",stage,method:"POST",endpoint:"/api/auth/microsoft/callback"}));
   const res=authErrorRedirect("invalid_response",this.config.secure);
   return this.setCookie(res,this.config.transactionCookie,"",0);
  }
 }
 async callback(req:Request){
  let res:Response;
  let stage="transaction";
  try{
   const id=readCookie(req,this.config.transactionCookie),txn=id?await this.store.consumeTransaction(hashId(id)):null,q=new URL(req.url).searchParams;
   stage="validation";
   if(!txn||q.getAll("state").length!==1||q.get("state")!==txn.state||q.getAll("code").length!==1||q.getAll("iss").length>1||q.has("error"))throw Error("Invalid callback");
   stage="code_exchange";
   const isMicrosoft=txn.provider==="microsoft";
   const endpoint=isMicrosoft?"/auth/microsoft/callback":"/auth/google/callback";
   const event=isMicrosoft?"microsoft_callback_failed":"google_callback_failed";
   const upstream=await this.upstream(endpoint,"POST",{state:txn.state,code:q.get("code"),...(q.has("iss")?{iss:q.get("iss")}:{})},undefined,undefined,this.clientIp(req));
   if(!upstream.ok){
    const body=await upstream.json().catch(()=>({}));
    const codes=isMicrosoft?["account_link_required","invalid_microsoft_transaction","invalid_microsoft_identity","too_many_auth_attempts","internal_error"]:["account_link_required","invalid_google_transaction","invalid_google_identity","too_many_auth_attempts","internal_error"];
    const diagnosticCode=(codes as string[]).includes(body.code)?body.code:"unknown";
    const correlation=upstream.headers.get("x-correlation-id");
    const correlationId=correlation&&/^[a-f0-9-]{36}$/i.test(correlation)?correlation:undefined;
    console.error(JSON.stringify({event,stage,method:"POST",endpoint,status:upstream.status,diagnosticCode,correlationId}));
    res=authErrorRedirect(body.code==="account_link_required"?"account_link_required":"invalid_response",this.config.secure);
   }else{stage="session";res=await this.establishSession(req,await upstream.json(),txn.returnTo);}
  }catch{
   console.error(JSON.stringify({event:"google_callback_failed",stage,method:"GET",endpoint:"/api/auth/callback"}));
   res=authErrorRedirect("invalid_response",this.config.secure);
  }
  return this.setCookie(res,this.config.transactionCookie,"",0);
 }
 private async session(req:Request){
  const id=readCookie(req,this.config.sessionCookie);if(!id)return null;
  return this.store.session(hashId(id),async previous=>{
   if(previous.accessExpiresAt>Date.now()+30000)return previous;if(!previous.refreshToken)return null;
   const context=bffContext.getStore();if(context)context.stage="session_refresh";
   const res=await this.upstream("/auth/refresh","POST",{refreshToken:previous.refreshToken},undefined,undefined,this.clientIp(req));if(res.status===401){console.warn(JSON.stringify({event:"auth_session_rejected",endpoint:"/auth/refresh",reason:"refresh_rejected"}));return null;}if(!res.ok)throw Object.assign(new HttpError(503,"Authentication service unavailable"),{upstreamStatus:res.status,upstreamCorrelationId:res.headers.get("x-correlation-id")});
   const tokens=await res.json();return {...previous,accessToken:tokens.accessToken,refreshToken:tokens.refreshToken,accessExpiresAt:Date.now()+tokens.expiresIn*1000};
  });
 }
 private async profile(session:SessionData):Promise<Profile>{
  const res=await this.api(session,"/account/me");if(!res.ok){if(res.status===401)console.warn(JSON.stringify({event:"profile_session_rejected",endpoint:"/account/me",reason:"access_token_rejected"}));throw new HttpError(res.status===401?401:502,"Account is unavailable");}const p=await res.json() as Profile;
  if(p.userId!==session.subject)throw new HttpError(401,"Account identity mismatch");return p;
 }
 private view(profile:Profile){return {...profile,role:profile.profession??null,workspaceRole:profile.role};}
 async action(req:Request,action:string){
  try{
   this.checkOrigin(req);
   if(!["forgot-password","verify-reset-code","reset-password","verify-email","verify-email/resend","change-password"].includes(action))throw new HttpError(404,"API route not found");
   const body=await readJson(req);
   if(action==="verify-email"&&("code" in body)===("token" in body))throw new HttpError(400,"invalid_request");
   const authenticated=["verify-email/resend","change-password"].includes(action)||(action==="verify-email"&&"code" in body);const session=authenticated?await this.session(req):undefined;
   if(authenticated&&!session)return this.unauthorized();
   const res=await this.upstream(`/auth/${action}`,"POST",body,session??undefined,undefined,this.clientIp(req));
   if(!res.ok)return this.errorBody(res);const result=await res.json();
   if(action==="change-password"){
    const id=readCookie(req,this.config.sessionCookie);if(id)await this.store.revoke(hashId(id),true);
    return this.setCookie(json(result),this.config.sessionCookie,"",0);
   }return json(result);
  }catch(e){return this.error(e);}
 }
  async me(request: Request) {
    let stage = "request";
    try {
      const method = request.method;
      if (method !== "GET" && method !== "PATCH") throw new HttpError(405, "Method not allowed");
      if (method === "PATCH") this.checkOrigin(request);
      stage = "session";
      const session = await this.session(request);
      if (!session) {
        console.warn(JSON.stringify({ event: "profile_session_rejected", endpoint: "/api/me", reason: readCookie(request, this.config.sessionCookie) ? "session_unavailable" : "missing_cookie" }));
        return this.unauthorized();
      }
      if (method === "GET") { stage = "profile_load"; return json(this.view(await this.profile(session))); }
      stage = "request_body";
      const input = await readJson(request);
      const allowed = new Set(["role", "name", "timezone", "outputsOnly", "complete", "theme", "mode"]);
      if (Object.keys(input).some(key => !allowed.has(key))) throw new HttpError(400, "Unknown profile field");
      const patch = { ...input };
      if ("role" in patch) { patch.profession = patch.role; delete patch.role; }
      stage = "profile_update";
      const response = await this.api(session, "/account/me", "PATCH", patch);
      stage = "response_decode";
      const body = await response.json();
      if (response.status === 401) return this.unauthorized();
      return response.ok ? json(this.view(body as Profile)) : json({ error: response.status === 400 ? "Invalid profile update" : "Profile update failed" }, response.status);
    } catch (error) {
      if (!(error instanceof HttpError) || error.status >= 500) {
        const cause = error instanceof Error ? error.cause as { code?: unknown } | undefined : undefined;
        const transportCode = typeof cause?.code === "string" && ["ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "ENOTFOUND", "EAI_AGAIN", "UND_ERR_CONNECT_TIMEOUT"].includes(cause.code) ? cause.code : undefined;
        const knownErrors: Record<string, string> = { "Session refresh busy": "session_refresh_busy", "Session lease expired": "session_lease_expired" };
        const diagnosticCode = transportCode ?? (error instanceof Error && Object.hasOwn(knownErrors, error.message) ? knownErrors[error.message] : "unknown");
        const errorType = error instanceof TypeError ? "TypeError" : error instanceof SyntaxError ? "SyntaxError" : error instanceof Error && error.name === "TimeoutError" ? "TimeoutError" : "Error";
        const storeStatus = error instanceof Error ? /^Auth store request failed \(([1-5][0-9]{2})\)$/.exec(error.message) : null;
        console.error(JSON.stringify({ event: "profile_request_failed", endpoint: "/api/me", method: request.method === "PATCH" ? "PATCH" : "GET", stage, errorType, diagnosticCode, upstreamStatus: storeStatus ? Number(storeStatus[1]) : undefined }));
      }
      return this.error(error);
    }
  }

  async proxy(request: Request, segments: string[]) {
    return bffContext.run({...requestIdentity(),stage:"session_lookup",endpoint:proxyEndpoint(segments),method:["GET","POST","PATCH","PUT","DELETE"].includes(request.method)?request.method:"OTHER"},async()=>{
      const response=await this.proxyRequest(request,segments);
      response.headers.set("x-correlation-id",bffContext.getStore()!.correlationId);return response;
    });
  }
  private async proxyRequest(request: Request, segments: string[]) {
    try {
      if (!["GET", "POST", "PATCH", "PUT", "DELETE"].includes(request.method)) throw new HttpError(405, "Method not allowed");
      if (request.method !== "GET") this.checkOrigin(request);
      const allowed = new Set(["uploads", "jobs", "usage", "account", "dashboard", "captures", "documents", "library", "calendar", "booking", "plan", "admin", "notifications", "public", "shared-notes"]);
      if (!allowed.has(segments[0]) || segments.some(s => !/^[A-Za-z0-9_-]+$/.test(s))) throw new HttpError(404, "API route not found");
      const isPublicRoute = segments[0] === "public";
      const session = await this.session(request);
      if (!session && !isPublicRoute) return this.unauthorized();
      const transcriptEdit=request.method==="PATCH"&&segments.length===4&&segments[0]==="library"&&segments[1]==="captures"&&segments[3]==="transcript";
      const bodylessInsight = request.method === "POST" && segments.length === 3 && segments[0] === "captures" && ["recap", "questions"].includes(segments[2]);
      if (bodylessInsight) await assertEmptyBody(request);
      const body = request.method === "GET" || bodylessInsight || request.method === "DELETE" && !request.body ? undefined : await readJson(request,transcriptEdit?262144:16384);
      const url = new URL(request.url);
      const pathAndQuery = "/" + segments.map(encodeURIComponent).join("/") + url.search;
      bffContext.getStore()!.stage="api_request";
      const upstream = isPublicRoute
        ? await this.upstream(pathAndQuery, request.method, body, undefined, request.headers.get("idempotency-key") ?? undefined)
        : await this.api(session!, pathAndQuery, request.method, body, request.headers.get("idempotency-key") ?? undefined);
      if (upstream.status === 401) return this.unauthorized();
      if (upstream.status === 204) return new Response(null, { status: 204, headers });
      bffContext.getStore()!.stage="api_response";
      const result = await upstream.json();
      if(upstream.status>=500){
        bffContext.getStore()!.stage="api_response";reportBffFailure(undefined,upstream.status,upstream.status,upstream.headers.get("x-correlation-id")??result?.correlationId);
        return json({...result,correlationId:bffContext.getStore()!.correlationId},upstream.status);
      }
      return json(result, upstream.status);
    } catch (error) {
      if(error instanceof HttpError&&error.status<500)return this.error(error);
      const context=bffContext.getStore()!;reportBffFailure(error,503);
      const stage=context.stage;
      const code=stage==="session_lookup"?"session_service_unavailable":stage==="session_refresh"?"session_refresh_unavailable":"service_unavailable";
      const message=stage==="session_lookup"?"We could not check your sign-in. Please try again.":stage==="session_refresh"?"We could not renew your sign-in. Please try again.":"The service is temporarily unavailable. Please try again.";
      return json({code,error:message,correlationId:context.correlationId},503);
    }
  }


 async logout(req:Request){
  try{
   this.checkOrigin(req);const body=await readJson(req);if(Object.keys(body).some(k=>k!=="all")||(body.all!==undefined&&typeof body.all!=="boolean"))throw new HttpError(400,"Invalid logout request");
   const session=await this.session(req);if(body.all===true&&!session)return this.unauthorized();
   if(session){const res=await this.upstream("/auth/logout","POST",{all:body.all===true},session,undefined,this.clientIp(req));if(!res.ok&&res.status!==401)throw new HttpError(503,"Logout failed; please retry");}
   const id=readCookie(req,this.config.sessionCookie);if(id)await this.store.revoke(hashId(id),body.all===true);
   const res=json({redirectTo:this.config.appOrigin+"/auth/login",scope:body.all===true?"all_calmasta_sessions":"current_session"});
   this.setCookie(res,this.config.sessionCookie,"",0);return this.setCookie(res,this.config.transactionCookie,"",0);
  }catch(e){return this.error(e);}
 }
 async adminLogin(req:Request){
  try{
   this.checkOrigin(req);
   const body=await readJson(req) as {email?:unknown;password?:unknown};
   if(typeof body.email!=="string"||typeof body.password!=="string"||!body.email.trim()||!body.password)throw new HttpError(400,"Invalid request");
   const res=await this.upstream("/admin/auth/login","POST",{email:body.email,password:body.password},undefined,undefined,this.clientIp(req));
   if(!res.ok){const data=await res.json().catch(()=>({}));const code=typeof data.code==="string"?data.code:undefined;const corr=res.headers.get("x-correlation-id")??undefined;return json({code:code??"authentication_failed",correlationId:corr},res.status);}
   const data=await res.json() as Credentials & {principal?:unknown};
   return this.establishSession(req,data);
  }catch(e){return this.error(e);}
 }
 async adminLogout(req:Request){
  try{
   this.checkOrigin(req);
   const session=await this.session(req);if(!session)return this.unauthorized();
   const res=await this.upstream("/admin/auth/logout","POST",{},session,undefined,this.clientIp(req));
   if(!res.ok&&res.status!==401){const data=await res.json().catch(()=>({}));return json({code:data.code??"logout_failed",correlationId:res.headers.get("x-correlation-id")??undefined},res.status);}
   const id=readCookie(req,this.config.sessionCookie);if(id)await this.store.revoke(hashId(id),false);
   const out=json({ok:true});return this.setCookie(out,this.config.sessionCookie,"",0);
  }catch(e){return this.error(e);}
 }
 async adminMe(req:Request){
  try{
   if(req.method!=="GET")throw new HttpError(405,"Method not allowed");
   const session=await this.session(req);if(!session)return this.unauthorized();
   const res=await this.upstream("/admin/me","GET",undefined,session,undefined,this.clientIp(req));
   if(res.status===401)return this.unauthorized();
   const data=await res.json().catch(()=>({}));if(!res.ok)return json({code:data.code??"request_failed",correlationId:res.headers.get("x-correlation-id")??undefined},res.status);
   return json({id:data.id,name:data.name,email:data.email,email_verified:data.email_verified,emailVerified:data.emailVerified??data.email_verified,role:data.role,permissions:data.permissions});
  }catch(e){return this.error(e);}
 }
 async adminCapabilities(req:Request){
  try{
   if(req.method!=="GET")throw new HttpError(405,"Method not allowed");
   const session=await this.session(req);if(!session)return this.unauthorized();
   const res=await this.upstream("/admin/capabilities","GET",undefined,session,undefined,this.clientIp(req));
   if(res.status===401)return this.unauthorized();
   const data=await res.json().catch(()=>({}));if(!res.ok)return json({code:data.code??"request_failed",correlationId:res.headers.get("x-correlation-id")??undefined},res.status);
   return json(data);
  }catch(e){return this.error(e);}
 }
 private unauthorized(){return this.setCookie(json({error:"Your session expired. Please sign in again."},401),this.config.sessionCookie,"",0);}
 private error(error:unknown){if(error instanceof HttpError&&error.status===401)return this.unauthorized();return json({error:error instanceof HttpError?error.message:"Authentication service unavailable"},error instanceof HttpError?error.status:503);}
}
