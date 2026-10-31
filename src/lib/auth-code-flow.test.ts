import { expect, it, vi } from "vitest";
import { createAuthCodeFlow, codeSecondsLeft, codeSignupPayload } from "./auth-code-flow";
it("signup explicitly chooses codes",()=>{expect(codeSignupPayload("a@example.test","password","A")).toEqual({email:"a@example.test",password:"password",name:"A",delivery:"code"});});
it("recovery preserves zeros, exchanges privately, resets once, and clears the grant",async()=>{
 let now=1000;const calls:{path:string;body:unknown}[]=[];
 const send=async(path:string,body:unknown)=>{calls.push({path,body});return Response.json(path.endsWith("verify-reset-code")?{resetToken:"a".repeat(64)}:{ok:true});};
 const flow=createAuthCodeFlow("recovery",send,()=>now);
 await flow.send("a@example.test");expect(flow.snapshot().step).toBe("code");expect(flow.snapshot().notice).toContain("If an account exists");
 expect(calls[0].body).toEqual({email:"a@example.test",delivery:"code"});
 await flow.send();expect(calls).toHaveLength(1);
 expect(codeSecondsLeft(flow.snapshot().resendAt,now)).toBe(60);now+=60000;expect(codeSecondsLeft(flow.snapshot().resendAt,now)).toBe(0);
 await flow.verify("012345");expect(calls[1].body).toEqual({email:"a@example.test",code:"012345"});
 expect(JSON.stringify(flow.snapshot())).not.toContain("a".repeat(64));
 await flow.reset("new password");expect(calls[2].body).toEqual({token:"a".repeat(64),password:"new password"});expect(flow.snapshot().step).toBe("done");
 await flow.reset("another password");expect(calls).toHaveLength(3);
});
it("pending requests cannot duplicate, and failed code checks remain retryable",async()=>{
 let finish!:(r:Response)=>void;const send=vi.fn(()=>new Promise<Response>(r=>{finish=r;}));
 const flow=createAuthCodeFlow("verification",send);
 const pending=flow.verify("012345");await flow.verify("012345");expect(send).toHaveBeenCalledTimes(1);
 finish(Response.json({error:"invalid_code"},{status:400}));await pending;expect(flow.snapshot()).toMatchObject({busy:false,step:"code"});expect(flow.snapshot().error).toContain("incorrect");
});
it.each([["expired_code",400],["too_many_attempts",429],["too_many_auth_attempts",429],["unauthorized",401],["invalid_or_expired_token",400]])("handles %s without exposing raw errors",async(error,status)=>{
 const flow=createAuthCodeFlow("verification",async()=>Response.json({error},{status}));await flow.verify("012345");expect(flow.snapshot().error).toBeTruthy();expect(flow.snapshot().busy).toBe(false);
 if(status===401)expect(flow.snapshot().signedOut).toBe(true);
 if(status===429)expect(codeSecondsLeft(flow.snapshot().resendAt,Date.now())).toBeGreaterThan(0);
});
it("verification resends codes and never sends a token with code",async()=>{
 const calls:unknown[]=[];const flow=createAuthCodeFlow("verification",async(path,body)=>{calls.push([path,body]);return Response.json({ok:true});});
 await flow.send();await flow.verify("000001");expect(calls).toEqual([["/api/auth/verify-email/resend",{delivery:"code"}],["/api/auth/verify-email",{code:"000001"}]]);expect(flow.snapshot().step).toBe("done");
});
it("missing endpoints and network failures report errors without fallback or raw secrets",async()=>{
 const send=vi.fn().mockResolvedValueOnce(Response.json({error:"missing"},{status:404})).mockRejectedValueOnce(new Error("private secret"));
 const flow=createAuthCodeFlow("recovery",send);await flow.send("a@example.test");expect(flow.snapshot().step).toBe("email");expect(flow.snapshot().error).toContain("unavailable");await flow.send("a@example.test");expect(flow.snapshot().error).not.toContain("private");expect(send).toHaveBeenCalledTimes(2);
});
it("back clears recovery grant and rejects malformed codes before any request",async()=>{
 const send=vi.fn(async(path:string)=>Response.json(path.endsWith("verify-reset-code")?{resetToken:"b".repeat(64)}:{ok:true}));const flow=createAuthCodeFlow("recovery",send);
 await flow.send("a@example.test");await flow.verify("12345");expect(send).toHaveBeenCalledTimes(1);await flow.verify("123456");flow.back();await flow.reset("password");expect(send).toHaveBeenCalledTimes(2);expect(flow.snapshot().step).toBe("email");
});

it("expired reset grants return to email entry and cannot be reused",async()=>{
 const calls:string[]=[];
 const flow=createAuthCodeFlow("recovery",async(path)=>{calls.push(path);return path.endsWith("verify-reset-code")?Response.json({resetToken:"a".repeat(64)}):path.endsWith("reset-password")?Response.json({error:"invalid_or_expired_token"},{status:400}):Response.json({ok:true});});
 await flow.send("a@example.test");await flow.verify("012345");await flow.reset("new password");expect(flow.snapshot().step).toBe("email");expect(flow.snapshot().error).toContain("expired");await flow.reset("new password");expect(calls).toHaveLength(3);
});
it("resend cooldown is authoritative locally even after navigating back",async()=>{
 let now=1000;const send=vi.fn(async()=>Response.json({ok:true}));const flow=createAuthCodeFlow("recovery",send,()=>now);
 await flow.send("a@example.test");flow.back();await flow.send("a@example.test");expect(send).toHaveBeenCalledTimes(1);now+=60000;await flow.send("a@example.test");expect(send).toHaveBeenCalledTimes(2);
});

it.each([{}, {resetToken:"bad-token"}])("does not advance on a malformed exchange grant",async(grant)=>{
 const flow=createAuthCodeFlow("recovery",async(path)=>Response.json(path.endsWith("verify-reset-code")?grant:{ok:true}));
 await flow.send("a@example.test");await flow.verify("012345");expect(flow.snapshot().step).toBe("code");expect(flow.snapshot().error).toBeTruthy();
});
