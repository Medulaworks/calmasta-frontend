import {afterEach,expect,it,vi} from 'vitest';
import {QueryClient,QueryObserver} from '@tanstack/react-query';
import {accountSummaryQuery,refreshAccountSummary} from './account-query';

afterEach(()=>vi.unstubAllGlobals());

it('reads again after a pre-existing initial fetch so a realtime invalidation cannot retain an old snapshot',async()=>{
  const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
  let finishInitial!:(value:Response)=>void;
  const request=vi.fn().mockImplementationOnce(()=>new Promise<Response>(resolve=>{finishInitial=resolve;}))
    .mockResolvedValueOnce(Response.json({remainingMinutes:5}));
  vi.stubGlobal('fetch',request);
  const observer=new QueryObserver(client,accountSummaryQuery('owner@example.test'));
  const unsubscribe=observer.subscribe(()=>{});
  try{
    expect(request).toHaveBeenCalledTimes(1);
    const update=refreshAccountSummary(client,'owner@example.test');
    finishInitial(Response.json({remainingMinutes:20}));
    await update;
    expect(request).toHaveBeenCalledTimes(2);
    expect(observer.getCurrentResult().data?.remainingMinutes).toBe(5);
  }finally{unsubscribe();client.clear();}
});

it('preserves the last account data when a refresh fails and aborts an unobserved initial request',async()=>{
  const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
  const request=vi.fn().mockResolvedValueOnce(Response.json({remainingMinutes:20})).mockRejectedValueOnce(new Error('temporary outage'));
  vi.stubGlobal('fetch',request);
  const options=accountSummaryQuery('owner@example.test');
  await client.fetchQuery(options);
  const observer=new QueryObserver(client,options);const unsubscribe=observer.subscribe(()=>{});
  try{
    await expect(refreshAccountSummary(client,'owner@example.test')).rejects.toThrow('temporary outage');
    expect(observer.getCurrentResult().data?.remainingMinutes).toBe(20);
  }finally{unsubscribe();client.clear();}
  let signal:AbortSignal|undefined;
  vi.stubGlobal('fetch',vi.fn((_url:string,init?:RequestInit)=>{signal=init?.signal as AbortSignal;return new Promise(()=>{});}));
  const pending=new QueryObserver(client,accountSummaryQuery('another@example.test'));
  const unobserve=pending.subscribe(()=>{});unobserve();expect(signal?.aborted).toBe(true);client.clear();
});
