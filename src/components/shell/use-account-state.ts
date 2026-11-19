'use client';

import {useEffect,useRef} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {accountSummaryQuery,refreshAccountSummary} from '@/lib/account-query';
import {startAccountUpdates} from '@/lib/account-realtime';

export function useAccountState(identity:string|null,pathname:string){
  const qc=useQueryClient();
  const controller=useRef<ReturnType<typeof startAccountUpdates>|null>(null);
  const query=useQuery(accountSummaryQuery(identity));
  useEffect(()=>{
    if(!identity)return;
    const active=startAccountUpdates({
      refresh:()=>refreshAccountSummary(qc,identity),
      onUnauthorized:()=>{void qc.invalidateQueries({queryKey:['profile']});},
    });
    controller.current=active;
    return ()=>{active.stop();controller.current=null;};
  },[identity,qc]);
  useEffect(()=>{controller.current?.refresh();},[pathname]);

  const plan=identity?query.data??null:null;
  // Expiry/month boundaries can change the read projection without a database write.
  useEffect(()=>{
    if(!plan)return;
    const future=[plan.resetsAt,plan.plan.graceUntil,plan.plan.renewsAt,plan.purchasedCredits?.nextExpiryAt]
      .filter((value):value is string=>typeof value==='string')
      .map(value=>Date.parse(value)).filter(value=>Number.isFinite(value)&&value>Date.now());
    if(!future.length)return;
    const timer=setTimeout(()=>controller.current?.refresh(),Math.min(2147483647,Math.max(1000,Math.min(...future)-Date.now()+1000)));
    return ()=>clearTimeout(timer);
  },[plan]);
  // The backend's real account deletion lifecycle is still unavailable.
  return {plan,deletion:null};
}
