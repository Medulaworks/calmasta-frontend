export type InsightTab="insights"|"transcript";
export const SUMMARY_TEMPLATE_IDS=["enhanced","sales","sales-sandler","sales-spiced","sales-meddpicc","sales-bant","customer-success","customer-success-reach","candidate-interview","demo","one-on-one","project-kickoff","project-update","q-and-a","retrospective","stand-up"] as const;
export function readInsightTab(search:string):InsightTab{return new URLSearchParams(search).get("tab")==="transcript"?"transcript":"insights";}
export function readSummaryTemplate(search:string):string|null{const value=new URLSearchParams(search).get("template");return value&&SUMMARY_TEMPLATE_IDS.some(id=>id===value)?value:null;}
export function withInsightTab(url:URL,tab:InsightTab):URL{const next=new URL(url);next.searchParams.set("tab",tab);return next;}
export function insightSearch():string{return typeof window!=="undefined"&&window.location?window.location.search:"";}
export function updateInsightUrl(values:{tab?:InsightTab;template?:string}){
 if(typeof window==="undefined"||!window.location||!window.history)return;
 const url=new URL(window.location.href);if(values.tab)url.searchParams.set("tab",values.tab);if(values.template)url.searchParams.set("template",values.template);
 if(url.href!==window.location.href)window.history.pushState(null,"",url);
 window.dispatchEvent(new Event("insight-navigation"));
}
export function listenInsightNavigation(callback:()=>void){
 if(typeof window==="undefined"||typeof window.addEventListener!=="function")return ()=>{};
 window.addEventListener("popstate",callback);window.addEventListener("insight-navigation",callback);
 return ()=>{window.removeEventListener("popstate",callback);window.removeEventListener("insight-navigation",callback);};
}
