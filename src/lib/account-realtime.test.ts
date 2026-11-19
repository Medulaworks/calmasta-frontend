import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {startAccountUpdates} from './account-realtime';

class FakeSocket {
  static instances:FakeSocket[]=[];
  static OPEN=1;
  readyState=0;
  onopen:((event:Event)=>void)|null=null;
  onmessage:((event:MessageEvent)=>void)|null=null;
  onclose:((event:CloseEvent)=>void)|null=null;
  onerror:((event:Event)=>void)|null=null;
  sent:string[]=[];
  constructor(readonly url:string){FakeSocket.instances.push(this);}
  send(value:string){this.sent.push(value);}
  open(){this.readyState=1;this.onopen?.(new Event('open'));}
  message(type:string){this.onmessage?.({data:JSON.stringify({type})} as MessageEvent);}
  close(code=1000){this.readyState=3;this.onclose?.({code} as CloseEvent);}
}
let browser:EventTarget,doc:EventTarget,refresh:ReturnType<typeof vi.fn<()=>Promise<unknown>>>,stop:undefined|(()=>void);
beforeEach(()=>{
  vi.useFakeTimers();FakeSocket.instances=[];browser=new EventTarget();doc=new EventTarget();
  Object.assign(browser,{location:{protocol:'https:',hostname:'app.example.test'}});
  Object.assign(doc,{visibilityState:'visible'});
  vi.stubGlobal('window',browser);vi.stubGlobal('document',doc);vi.stubGlobal('navigator',{onLine:true});
  vi.stubGlobal('WebSocket',FakeSocket);
  vi.stubGlobal('fetch',vi.fn(async()=>Response.json({ticket:'a'.repeat(64),expiresAt:new Date(Date.now()+30000).toISOString(),websocketUrl:'wss://api.example.test/account/realtime'})));
  refresh=vi.fn().mockResolvedValue(undefined);
});
afterEach(()=>{stop?.();stop=undefined;vi.useRealTimers();vi.unstubAllGlobals();});
async function start(){const controller=startAccountUpdates({refresh});stop=controller.stop;await vi.advanceTimersByTimeAsync(0);return controller;}
it('shares one socket and authenticates in a frame without putting credentials in the URL',async()=>{
  await start();expect(FakeSocket.instances).toHaveLength(1);const socket=FakeSocket.instances[0];socket.open();
  expect(socket.url).toBe('wss://api.example.test/account/realtime');expect(socket.sent).toEqual([JSON.stringify({type:'authenticate',ticket:'a'.repeat(64)})]);
  socket.message('account.ready');await vi.advanceTimersByTimeAsync(300);expect(refresh).toHaveBeenCalledTimes(1);
});
it('coalesces event bursts and performs a follow-up read for changes arriving during an in-flight refresh',async()=>{
  await start();const socket=FakeSocket.instances[0];socket.open();socket.message('account.ready');await vi.advanceTimersByTimeAsync(300);refresh.mockClear();
  let complete!:()=>void;refresh.mockImplementationOnce(()=>new Promise<void>(resolve=>{complete=resolve;}));
  for(let i=0;i<20;i++)socket.message('account.changed');await vi.advanceTimersByTimeAsync(300);expect(refresh).toHaveBeenCalledTimes(1);
  for(let i=0;i<20;i++)socket.message('account.changed');await vi.advanceTimersByTimeAsync(500);expect(refresh).toHaveBeenCalledTimes(1);
  complete();await vi.advanceTimersByTimeAsync(300);expect(refresh).toHaveBeenCalledTimes(2);
});
it('refreshes after reconnect and focus, retries with a delay, and stops cleanly on disposal',async()=>{
  await start();const first=FakeSocket.instances[0];first.open();first.message('account.ready');await vi.advanceTimersByTimeAsync(300);refresh.mockClear();
  first.close(1006);await vi.advanceTimersByTimeAsync(500);expect(FakeSocket.instances).toHaveLength(1);
  await vi.advanceTimersByTimeAsync(2000);expect(FakeSocket.instances).toHaveLength(2);
  const second=FakeSocket.instances[1];second.open();second.message('account.ready');await vi.advanceTimersByTimeAsync(300);expect(refresh).toHaveBeenCalledTimes(1);
  browser.dispatchEvent(new Event('focus'));await vi.advanceTimersByTimeAsync(300);expect(refresh).toHaveBeenCalledTimes(2);
  stop?.();expect(second.readyState).toBe(3);const count=refresh.mock.calls.length;
  browser.dispatchEvent(new Event('focus'));await vi.advanceTimersByTimeAsync(600000);expect(refresh).toHaveBeenCalledTimes(count);expect(FakeSocket.instances).toHaveLength(2);
});
it('recovers from a transient account refresh failure and retains future invalidations',async()=>{
  refresh.mockRejectedValueOnce(new Error('temporary outage'));await start();const socket=FakeSocket.instances[0];socket.open();socket.message('account.ready');await vi.advanceTimersByTimeAsync(300);
  socket.message('account.changed');await vi.advanceTimersByTimeAsync(300);expect(refresh).toHaveBeenCalledTimes(2);
});
it('stops on an unauthorized ticket response instead of continuously retrying the session',async()=>{
  vi.stubGlobal('fetch',vi.fn(async()=>Response.json({}, {status:401})));const ended=vi.fn();const controller=startAccountUpdates({refresh,onUnauthorized:ended});stop=controller.stop;
  await vi.advanceTimersByTimeAsync(300000);expect(ended).toHaveBeenCalledTimes(1);expect(fetch).toHaveBeenCalledTimes(1);expect(FakeSocket.instances).toHaveLength(0);
});
it('rejects insecure or credential-bearing websocket URLs and aborts ticket requests on teardown',async()=>{
  vi.stubGlobal('fetch',vi.fn(async()=>Response.json({ticket:'a'.repeat(64),websocketUrl:'ws://api.example.test/account/realtime'})));
  await start();expect(FakeSocket.instances).toHaveLength(0);stop?.();
  let signal:AbortSignal|undefined;
  vi.stubGlobal('fetch',vi.fn((_url:string,init?:RequestInit)=>{signal=init?.signal as AbortSignal;return new Promise(()=>{});}));
  const controller=startAccountUpdates({refresh});stop=controller.stop;await vi.advanceTimersByTimeAsync(0);stop();expect(signal?.aborted).toBe(true);
});
it('closes stalled connections and uses a slow fallback read when websocket service is unavailable',async()=>{
  await start();await vi.advanceTimersByTimeAsync(13000);expect(FakeSocket.instances[0].readyState).toBe(3);
  await vi.advanceTimersByTimeAsync(80000);expect(refresh.mock.calls.length).toBeGreaterThanOrEqual(1);
});
it('defers hidden/offline refreshes until foreground and ignores account events before authentication',async()=>{
  await start();const socket=FakeSocket.instances[0];socket.open();socket.message('account.changed');await vi.advanceTimersByTimeAsync(300);expect(refresh).not.toHaveBeenCalled();
  socket.message('account.ready');await vi.advanceTimersByTimeAsync(300);refresh.mockClear();
  Object.assign(doc,{visibilityState:'hidden'});socket.message('account.changed');await vi.advanceTimersByTimeAsync(1000);expect(refresh).not.toHaveBeenCalled();
  Object.assign(doc,{visibilityState:'visible'});doc.dispatchEvent(new Event('visibilitychange'));await vi.advanceTimersByTimeAsync(300);expect(refresh).toHaveBeenCalledTimes(1);
  Object.assign(navigator,{onLine:false});browser.dispatchEvent(new Event('calmasta:account-changed'));await vi.advanceTimersByTimeAsync(300);expect(refresh).toHaveBeenCalledTimes(1);
  Object.assign(navigator,{onLine:true});browser.dispatchEvent(new Event('online'));await vi.advanceTimersByTimeAsync(300);expect(refresh).toHaveBeenCalledTimes(2);
});
it('session revocation stops the socket and triggers the existing authentication refresh',async()=>{
  const ended=vi.fn();const controller=startAccountUpdates({refresh,onUnauthorized:ended});stop=controller.stop;
  await vi.advanceTimersByTimeAsync(0);const socket=FakeSocket.instances[0];socket.open();socket.message('account.ready');socket.close(4401);
  await vi.advanceTimersByTimeAsync(300000);expect(ended).toHaveBeenCalledTimes(1);expect(FakeSocket.instances).toHaveLength(1);
});
