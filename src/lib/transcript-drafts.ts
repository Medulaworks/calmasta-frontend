export function updateTranscriptDraft(drafts:Record<string,string>,key:string,value:string,original:string,acknowledged:Record<string,string>,submitted:Record<string,string>={}) {
 const baseline=submitted[key]??acknowledged[key]??original;
 return value===baseline?Object.fromEntries(Object.entries(drafts).filter(([k])=>k!==key)):{...drafts,[key]:value};
}
export function pendingTranscriptDrafts(current:Record<string,string>,saved:Record<string,string>){return Object.fromEntries(Object.entries(current).filter(([key,value])=>saved[key]!==value));}
