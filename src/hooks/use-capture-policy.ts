"use client";
import {useEffect,useState} from "react";
import {getCapturePolicy,type CapturePolicy} from "@/lib/upload-client";
export function useCapturePolicy(){const [policy,setPolicy]=useState<CapturePolicy|null>(null),[policyError,setError]=useState<string|null>(null);useEffect(()=>{const ctrl=new AbortController();getCapturePolicy(ctrl.signal).then(value=>{if(!ctrl.signal.aborted)setPolicy(value);},error=>{if(!ctrl.signal.aborted)setError(error instanceof Error?error.message:"Could not load capture limits.");});return()=>ctrl.abort();},[]);return {policy,policyError};}
