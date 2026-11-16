import { expect, it } from "vitest";
import { bannersFor } from "./account-banners";
import { normalizePlan } from "@/lib/plan-client";
it("reserved allowance is not described as consumed time",()=>{
 const plan=normalizePlan({plan:{plan:"free",status:"active"},allowanceMinutes:60,usedMinutes:0,reservedMinutes:90,remainingMinutes:0,exhausted:true});
 const text=bannersFor(plan,null).find(b=>b.id==="exhausted")?.text;
 expect(text).toContain("reserved");expect(text).not.toContain("You've used");expect(text).toContain("billing");
});
it("consumed allowance still explains exhausted quota, while available purchased time has no warning",()=>{
 const plan=normalizePlan({plan:{plan:"free",status:"active"},usedMinutes:60,reservedMinutes:0,remainingMinutes:0,exhausted:true});
 expect(bannersFor(plan,null).find(b=>b.id==="exhausted")?.text).toContain("You've used");
 expect(bannersFor({...plan,exhausted:false,remainingMinutes:60},null).some(b=>b.id==="exhausted")).toBe(false);
});
