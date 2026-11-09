import { afterEach, expect, it, vi } from "vitest";
import { adminGet, adminPost, adminPatch } from "./admin-client";
import { capability } from "./admin-capabilities";
import { SECTIONS, sectionFor } from "../components/admin/admin-nav";
afterEach(()=>vi.unstubAllGlobals());
it("staff API failures remain server-authoritative without fabricating success",async()=>{
 const fetcher=vi.fn().mockImplementation(async()=>Response.json({code:"forbidden",error:"Staff access required"},{status:403}));vi.stubGlobal("fetch",fetcher);
 for(const operation of [()=>adminGet("/api/admin/overview"),()=>adminPost("/api/admin/staff/invites",{}),()=>adminPatch("/api/admin/settings",{})]){
  await expect(operation()).rejects.toMatchObject({status:403,code:"forbidden"});
 }
 expect(fetcher).toHaveBeenCalledTimes(3);
});

it("keeps all unimplemented admin capabilities disabled",()=>{
 for(const name of ["user_edit_profile","user_suspend","user_revoke_sessions","user_send_mail","user_staff_role","staff_manage","settings_edit","integration_replace","integration_check","export_audit"] as const){
  expect(capability(name)).toMatchObject({allowed:false,reason:expect.any(String)});
 }
});
it("groups existing and new staff pages under /admin without losing admin routes",()=>{
 expect(sectionFor("/admin/customers/user-id")?.id).toBe("users");
 expect(sectionFor("/admin/health")?.id).toBe("home");
 expect(sectionFor("/admin/audit")?.id).toBe("activity");
 const paths=SECTIONS.flatMap(s=>s.tabs.map(t=>t.href));
 for(const suffix of ["","/customers","/entitlements","/usage","/webhooks","/reconciliation","/dunning","/privacy","/plans","/settings","/integrations","/admins","/audit","/health"])expect(paths).toContain(`/admin${suffix}`);
});
