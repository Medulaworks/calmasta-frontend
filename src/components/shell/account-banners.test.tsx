import { isValidElement, type ReactNode } from "react";
import { expect, it } from "vitest";
import { SidebarPlanCard, bannersFor } from "./account-banners";
import { DUMMY_PLAN, normalizePlan } from "@/lib/plan-client";

type Props = Record<string, unknown> & { children?: ReactNode };
function texts(node: ReactNode): string[] {
  if (Array.isArray(node)) return node.flatMap(texts);
  if (typeof node === "string" || typeof node === "number") return [String(node)];
  if (!isValidElement<Props>(node)) return [];
  return texts(node.props.children);
}
const cardText = (plan: Parameters<typeof SidebarPlanCard>[0]["plan"]) => texts(SidebarPlanCard({ plan })).join(" ").replace(/\s+/g, " ");
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
it("shows zero defaults before the plan fetch lands instead of the dummy minutes",()=>{
 const text=cardText(null);
 expect(text).toContain("0 min left");
 expect(text).not.toContain("2.7 h");
 expect(text).toContain("Free plan");
});
it("still shows the fetched allowance once the plan arrives",()=>{
 expect(cardText(DUMMY_PLAN)).toContain("2.7 h left");
});
