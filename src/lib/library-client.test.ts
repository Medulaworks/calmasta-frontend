import { afterEach, expect, it, vi } from "vitest";
import { searchLibrary, searchLibraryPage, getLibraryCapture, saveLibraryTranscript, EMPTY_QUERY } from "./library-client";
const fetcher=vi.fn();
afterEach(()=>{vi.unstubAllGlobals();fetcher.mockReset();});
it("maps library filters and preserves cursor pagination",async()=>{
 vi.stubGlobal("fetch",fetcher);fetcher.mockResolvedValue(new Response(JSON.stringify({results:[],nextCursor:"next"})));
 expect((await searchLibraryPage({...EMPTY_QUERY,q:" architecture ",type:"meetings",status:"ready"},undefined,"cursor")).nextCursor).toBe("next");
 const url=new URL(fetcher.mock.calls[0][0],"https://fixture.invalid");expect(url.pathname).toBe("/api/library/search");expect(url.searchParams.get("type")).toBe("meeting");expect(url.searchParams.get("q")).toBe("architecture");expect(url.searchParams.get("cursor")).toBe("cursor");
});
it("maps persisted transcript detail to the existing editor without provider URLs",async()=>{
 vi.stubGlobal("fetch",fetcher);fetcher.mockResolvedValue(new Response(JSON.stringify({id:"capture",source:"meeting",title:"Review",state:"completed",createdAt:"now",transcript:[{id:"line",startMs:0,endMs:1,text:"Hello",speakerId:"A",editedByUser:false}],transcriptVersion:2,speakerNames:{A:"Maya"}})));
 const c=await getLibraryCapture("capture");expect(c.source).toBe("meeting_url");expect(c.transcriptVersion).toBe(2);expect(c.speakerNames.A).toBe("Maya");expect(c.audio).toBeNull();expect(fetcher.mock.calls[0][0]).toBe("/api/library/captures/capture");
});
it("maps editor baseVersion and preserves conflict identity",async()=>{
 vi.stubGlobal("fetch",fetcher);fetcher.mockResolvedValue(new Response(JSON.stringify({code:"version_conflict"}),{status:409}));
 await expect(saveLibraryTranscript("capture",{baseVersion:3,segments:[{id:"line",text:"Corrected"}],speakers:{A:"Maya"}})).rejects.toMatchObject({status:409,code:"version_conflict"});
 expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({expectedVersion:3,segments:[{id:"line",text:"Corrected"}],speakers:{A:"Maya"}});
});

it("retains incoming header-search limit support",async()=>{
 vi.stubGlobal("fetch",fetcher);fetcher.mockResolvedValue(new Response(JSON.stringify({results:[],nextCursor:null})));
 await searchLibrary(EMPTY_QUERY,undefined,7);expect(new URL(fetcher.mock.calls[0][0],"https://fixture.invalid").searchParams.get("limit")).toBe("7");
});
