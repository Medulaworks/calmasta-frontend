"use client";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { VerificationSignInLink } from "@/components/verification-sign-in-link";
import { AUTH_FIELD, AUTH_HEADING, AUTH_DESCRIPTION, AUTH_BUTTON } from "@/components/auth-styles";
import { AuthLayout } from "@/components/auth-layout";
import { buttonClass } from "@/components/ui/button";
import { LoaderCircle } from "lucide-react";
import { createEmailVerifier } from "@/lib/email-verification";
import { useEffect,useRef,useState,type FormEvent } from "react";
export function AuthAccountAction({kind}:{kind:"verify-email"|"reset-password"|"change-password"}){
 const params=useSearchParams();const [token,setToken]=useState(()=>params.get("token")??"");
 const [password,setPassword]=useState(""),[confirm,setConfirm]=useState(""),[current,setCurrent]=useState("");
 const [busy,setBusy]=useState(kind==="verify-email"&&Boolean(token)),[message,setMessage]=useState(""),[done,setDone]=useState(false);
 const [autoVerifying,setAutoVerifying]=useState(kind==="verify-email"&&Boolean(token));
 const [verify]=useState(()=>createEmailVerifier());
 const [resendSeconds,setResendSeconds]=useState(0);
 const resendDeadline=useRef(0);
 const coolingDown=resendSeconds>0;
 useEffect(()=>{
  if(!coolingDown)return;
  const timer=window.setInterval(()=>{
   setResendSeconds(Math.max(0,Math.ceil((resendDeadline.current-Date.now())/1000)));
  },1000);
  return()=>window.clearInterval(timer);
 },[coolingDown]);
 useEffect(()=>{if(params.has("token"))window.history.replaceState(null,"",window.location.pathname);},[params]);
 const verifying=kind==="verify-email",changing=kind==="change-password";
 useEffect(()=>{
  if(!verifying||!token)return;
  let cancelled=false;
  verify(token).then(()=>{
   if(cancelled)return;
   setBusy(false);setAutoVerifying(false);setDone(true);setToken("");setMessage("Your email is verified.");
  },(error:unknown)=>{
   if(cancelled)return;
   setBusy(false);setAutoVerifying(false);setMessage(error instanceof Error?error.message:"We couldn’t verify your email. The link may have expired.");
  });
  return()=>{cancelled=true;};
 },[verifying,token,verify]);
 async function submit(e:FormEvent){
  e.preventDefault();setMessage("");if(password!==confirm){setMessage("The passwords do not match.");return;}setBusy(true);
  try{
   const body=changing?{currentPassword:current,newPassword:password}:{token,password};
   const res=await fetch(`/api/auth/${kind}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
   if(!res.ok){const data=await res.json().catch(()=>({}));setMessage(res.status===401?"Please sign in again.":data.error==="use_password_recovery"?"Use Forgot password on the sign-in page to set a password.":data.error==="invalid_current_password"?"Your current password is incorrect.":"This request could not be completed. The link may have expired or already been used.");}
   else{setDone(true);setToken("");setPassword("");setCurrent("");setConfirm("");setMessage("Your password was updated. Please sign in again.");}
  }catch{setMessage("We can’t connect right now. Check your connection and try again.");}finally{setBusy(false);}
 }
 async function resend(){
  if(busy||Date.now()<resendDeadline.current)return;
  setBusy(true);setMessage("");
  try{
   const res=await fetch("/api/auth/verify-email/resend",{method:"POST",headers:{"Content-Type":"application/json"},body:"{}"});
   if(res.ok){resendDeadline.current=Date.now()+60000;setResendSeconds(60);}
   setMessage(res.ok?"A new verification email was requested. Check your inbox.":res.status===401?"Sign in first, then request another verification email.":"Email could not be sent. Please try again later.");
  }catch{setMessage("We can’t connect right now. Check your connection and try again.");}finally{setBusy(false);}
 }
 const content=<><h1 className={AUTH_HEADING}>{verifying?"Verify your email":changing?"Change password":"Reset password"}</h1>
 {verifying&&!done&&<p className={AUTH_DESCRIPTION}>Open the link in your verification email. Your address will be verified automatically before you use recording features.</p>}
 {autoVerifying&&!done&&<p role="status" aria-live="polite" className="mt-6 flex items-center gap-2 text-sm text-muted"><LoaderCircle aria-hidden className="size-4 animate-spin"/>Verifying your email…</p>}
 {message&&<p role="status" className={verifying?"mt-6 rounded-lg border border-border bg-surface px-4 py-3 text-sm":"my-4"}>{message}</p>}
 {!done&&!verifying&&<form onSubmit={submit} className="mt-6 space-y-4">
 {changing&&<label className="block">Current password<input className={`${AUTH_FIELD} mt-2`} type="password" autoComplete="current-password" required maxLength={128} value={current} onChange={e=>setCurrent(e.target.value)}/></label>}
 <label className="block">New password<input className={`${AUTH_FIELD} mt-2`} type="password" autoComplete="new-password" minLength={8} maxLength={128} required value={password} onChange={e=>setPassword(e.target.value)}/></label>
 <label className="block">Confirm new password<input className={`${AUTH_FIELD} mt-2`} type="password" autoComplete="new-password" minLength={8} maxLength={128} required value={confirm} onChange={e=>setConfirm(e.target.value)}/></label>
 <button className={buttonClass("primary", `${AUTH_BUTTON} disabled:opacity-50`, "lg")} disabled={busy||(!changing&&!token)}>{busy?"Please wait…":"Update password"}</button>
 </form>}
 {verifying&&!done&&(coolingDown
  ? <p role="timer" aria-live="off" className="mt-4 text-center text-sm text-muted">Send another email in {Math.floor(resendSeconds/60)}:{String(resendSeconds%60).padStart(2,"0")}</p>
  : <button type="button" onClick={resend} disabled={busy} className={buttonClass("secondary","mt-4 w-full","lg")}>Send another verification email</button>)}
 {verifying&&!done ? <VerificationSignInLink disabled={busy}/> : <Link className={verifying?"mt-6 block text-center text-xs font-medium text-foreground underline hover:no-underline":"mt-6 block underline"} href={done&&verifying?"/dashboard/welcome":"/auth/login"}>{done&&verifying?"Continue":"Back to sign in"}</Link>}
 </>;
 return <AuthLayout>{content}</AuthLayout>;
}
