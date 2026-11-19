import {ACCOUNT_CHANGED} from './plan-client';

type Options={refresh:()=>Promise<unknown>;onUnauthorized?:()=>void};
type Ticket={ticket:string;websocketUrl:string;expiresAt:string};

/** One transport per app shell; only hints cross the socket, never account data. */
export function startAccountUpdates({refresh,onUnauthorized}:Options){
  let stopped=false,connecting=false,ready=false,refreshing=false,dirty=false,attempt=0;
  let socket:WebSocket|undefined,request:AbortController|undefined;
  let reconnectTimer:ReturnType<typeof setTimeout>|undefined;
  let deadline:ReturnType<typeof setTimeout>|undefined;
  let refreshTimer:ReturnType<typeof setTimeout>|undefined;
  let fallbackTimer:ReturnType<typeof setTimeout>|undefined;
  const foreground=()=>document.visibilityState!=='hidden'&&navigator.onLine!==false;

  function stop(){
    if(stopped)return;stopped=true;
    clearTimeout(reconnectTimer);clearTimeout(deadline);clearTimeout(refreshTimer);clearTimeout(fallbackTimer);
    request?.abort();
    if(socket){socket.onopen=null;socket.onmessage=null;socket.onclose=null;socket.onerror=null;socket.close();socket=undefined;}
    window.removeEventListener('focus',resume);window.removeEventListener('online',resume);
    window.removeEventListener(ACCOUNT_CHANGED,requestRefresh);document.removeEventListener('visibilitychange',resume);
  }
  function unauthorized(){stop();onUnauthorized?.();}
  function requestRefresh(){
    if(stopped)return;dirty=true;
    if(refreshTimer||refreshing||!foreground())return;
    refreshTimer=setTimeout(()=>{
      refreshTimer=undefined;if(stopped||!foreground())return;
      dirty=false;refreshing=true;
      void Promise.resolve().then(refresh).catch((error:unknown)=>{
        if(error&&typeof error==='object'&&'status'in error&&error.status===401)unauthorized();
      }).finally(()=>{refreshing=false;if(dirty&&!stopped)requestRefresh();});
    },250);
  }
  function fallback(){
    clearTimeout(fallbackTimer);
    if(stopped)return;
    fallbackTimer=setTimeout(()=>{if(foreground())requestRefresh();fallback();},ready?300000+Math.random()*60000:60000+Math.random()*30000);
  }
  function retry(minimum=1000){
    if(stopped||reconnectTimer)return;
    const delay=Math.max(minimum,Math.min(60000,1000*2**Math.min(attempt++,6)))+Math.random()*1000;
    reconnectTimer=setTimeout(()=>{reconnectTimer=undefined;void connect();},delay);
  }
  async function connect(){
    if(stopped||connecting||socket||!foreground())return;
    connecting=true;const controller=new AbortController();request=controller;
    deadline=setTimeout(()=>controller.abort(),10000);
    try{
      const response=await fetch('/api/account/realtime/ticket',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}',credentials:'same-origin',cache:'no-store',signal:controller.signal});
      if(stopped||controller.signal.aborted)return;
      if(response.status===401){unauthorized();return;}
      if(!response.ok)throw Error('Realtime unavailable');
      const ticket=await response.json() as Ticket;
      if(stopped||controller.signal.aborted)return;
      const url=new URL(ticket.websocketUrl);
      const local=['localhost','127.0.0.1','[::1]'].includes(url.hostname);
      if(url.protocol!=='wss:'&&!(url.protocol==='ws:'&&window.location.protocol==='http:'&&local)||url.pathname!=='/account/realtime'||url.username||url.password||url.search||url.hash||!/^[a-f0-9]{64}$/.test(ticket.ticket)||!Number.isFinite(Date.parse(ticket.expiresAt))||Date.parse(ticket.expiresAt)<=Date.now())throw Error('Invalid realtime endpoint');
      clearTimeout(deadline);
      const ws=new WebSocket(url.href);socket=ws;
      deadline=setTimeout(()=>{if(socket===ws)ws.close();},10000);
      ws.onopen=()=>{if(!stopped)ws.send(JSON.stringify({type:'authenticate',ticket:ticket.ticket}));};
      ws.onmessage=event=>{
        if(stopped||socket!==ws||typeof event.data!=='string'||event.data.length>256)return;
        try{
          const message=JSON.parse(event.data);
          if(message.type==='account.ready'){clearTimeout(deadline);ready=true;attempt=0;fallback();requestRefresh();}
          else if(message.type==='account.changed'&&ready)requestRefresh();
        }catch{ /* Ignore malformed transport hints. */ }
      };
      ws.onclose=event=>{
        if(stopped||socket!==ws)return;
        socket=undefined;const wasReady=ready;ready=false;clearTimeout(deadline);
        if(wasReady)fallback();
        if(event.code===4401){unauthorized();return;}
        retry(event.code===4429?30000:1000);
      };
      ws.onerror=()=>{if(socket===ws)ws.close();};
    }catch{
      if(!stopped)retry();
    }finally{
      connecting=false;
      if(request===controller)request=undefined;
      if(!socket)clearTimeout(deadline);
    }
  }
  function resume(){if(!foreground()||stopped)return;requestRefresh();void connect();}
  window.addEventListener('focus',resume);window.addEventListener('online',resume);
  window.addEventListener(ACCOUNT_CHANGED,requestRefresh);document.addEventListener('visibilitychange',resume);
  fallback();void connect();
  return {stop,refresh:requestRefresh};
}
