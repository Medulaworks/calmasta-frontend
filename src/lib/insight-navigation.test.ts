import {expect,it} from "vitest";
import {readInsightTab,withInsightTab} from "./insight-navigation";
it("persists tabs without losing unrelated query or recording hash",()=>{
 expect(readInsightTab("?tab=insights")).toBe("insights");expect(readInsightTab("?tab=unknown")).toBe("insights");expect(readInsightTab("")).toBe("insights");expect(readInsightTab("?tab=transcript")).toBe("transcript");
 const url=withInsightTab(new URL("https://example.test/capture?template=sales-bant&x=1#recording-audio"),"transcript");
 expect(url.searchParams.get("template")).toBe("sales-bant");expect(url.searchParams.get("x")).toBe("1");expect(url.hash).toBe("#recording-audio");expect(url.searchParams.get("tab")).toBe("transcript");
});
