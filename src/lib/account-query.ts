import {queryOptions,type QueryClient} from '@tanstack/react-query';
import {fetchPlan} from './plan-client';

export const accountSummaryQuery=(identity:string|null)=>queryOptions({
  queryKey:['account-summary',identity],
  queryFn:({signal})=>fetchPlan(signal),
  enabled:!!identity,staleTime:30000,gcTime:0,retry:false,
  refetchOnWindowFocus:false,refetchOnReconnect:false,
});

export async function refreshAccountSummary(client:QueryClient,identity:string){
  const options=accountSummaryQuery(identity);
  // The initial useQuery fetch runs outside the socket controller. Its snapshot
  // may predate this hint: settle it first, then make a fresh read without overlap.
  if(client.getQueryState(options.queryKey)?.fetchStatus==='fetching'){
    try{await client.fetchQuery(options);}catch(error){
      if(error&&typeof error==='object'&&'status'in error&&error.status===401)throw error;
    }
  }
  await client.invalidateQueries({queryKey:options.queryKey,exact:true},{cancelRefetch:false,throwOnError:true});
}
