import { isValidElement, type ReactNode, type ReactElement } from "react";
import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ state: vi.fn(), reload: vi.fn(), push: vi.fn(), patch: vi.fn(), post: vi.fn(), resource: vi.fn(), paged: vi.fn(), historyState: vi.fn(), mailTestState: vi.fn(), expandedState: vi.fn() }));
vi.mock("react", async (original) => ({ ...await original<typeof import("react")>(), useState: mocks.state, useCallback: (callback: unknown) => callback, useRef: (initial: unknown) => ({ current: initial }) }));
vi.mock("@/lib/admin-client", async (original) => ({ ...await original<typeof import("@/lib/admin-client")>(), adminPatch: mocks.patch, adminPost: mocks.post }));
vi.mock("@/lib/admin-capabilities", () => ({ capability: () => ({ allowed: true, reason: null }) }));
vi.mock("@/components/ui/toast", () => ({ useToasts: () => ({ push: mocks.push, items: [], dismiss: vi.fn() }), ToastStack: () => null }));
vi.mock("./ui", async (original) => ({ ...await original<typeof import("./ui")>(), useResource: mocks.resource, usePaged: mocks.paged }));
import { IntegrationsView, IntegrationHistory } from "./integrations-view";
import { ActionDialog, DataTable, Th } from "./ui";
import { Dialog } from "@/components/ui/dialog";

type Props = Record<string, unknown> & { children?: ReactNode };
function elements(node: ReactNode): ReactElement<Props>[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement<Props>(node)) return [];
  return [node, ...elements(node.props.children)];
}
const item = { id: "oauth_microsoft", configured: true, version: 3, activeVersion: 2, updatedAt: null as string | null, adoption: { receipts: [], healthy: false, basis: "startup_application_only" }, effectiveStatus: "restart_required", providerConnectivity: "not_checked" };
const data = { environment: "development", replacementEnabled: true, items: [item] };
function view(editing: unknown = null, activating: unknown = null, response = data, historyId: string | null = null, expanded?: Set<string>, mailTest: unknown = null) {
  mocks.state.mockImplementationOnce(() => [editing, vi.fn()]).mockImplementationOnce(() => [activating, vi.fn()]).mockImplementationOnce(() => [historyId, mocks.historyState]).mockImplementationOnce(() => [mailTest, mocks.mailTestState]).mockImplementationOnce((initial) => [expanded ?? initial, mocks.expandedState]);
  const boundary = IntegrationsView() as ReactElement<{ children: (d: unknown) => ReactNode }>;
  return elements(boundary.props.children(response));
}
beforeEach(() => { vi.resetAllMocks(); mocks.state.mockImplementation((initial) => [initial, vi.fn()]); mocks.resource.mockReturnValue({ reload: mocks.reload }); mocks.patch.mockResolvedValue({ version: 4, effectiveStatus: "staged" }); mocks.post.mockResolvedValue({ effectiveStatus: "restart_required" }); });
it("uses the profile encryption flag and versions instead of legacy fields", () => {
  const tree = view(null, null, data, null, new Set([item.id]));
  const text = JSON.stringify(tree);
  expect(text).not.toContain("Secret replacement disabled");
  expect(text).not.toContain("storedVersion");
  expect(tree.some(e => e.props.children === "Test")).toBe(false);
  const replace = tree.find(e => e.props.children === "Replace credentials");
  expect(replace?.props.disabled).toBe(false);
});
it("disables replacement when the backend encryption key is unavailable", () => {
  const tree = view(null, null, { ...data, replacementEnabled: false }, null, new Set([item.id]));
  expect(tree.find(e => e.props.children === "Replace credentials")?.props.disabled).toBe(true);
});
it("stages typed Microsoft fields using the current version without activating", async () => {
  const dialog = view(item).find(e => e.type === ActionDialog)!;
  const fields = dialog.props.fields as Array<{ name: string }>;
  expect(fields.map(f => f.name)).toEqual(["clientId", "clientSecret", "redirectUri"]);
  await (dialog.props.onSubmit as (v: unknown) => Promise<void>)({ clientId: "fixture-id", clientSecret: "fixture-secret", redirectUri: "https://example.test/callback", reason: "Fixture profile update" });
  expect(mocks.patch).toHaveBeenCalledWith("/api/admin/integration-profiles/oauth_microsoft", { expectedVersion: 3, changes: { clientId: "fixture-id", clientSecret: "fixture-secret", redirectUri: "https://example.test/callback" }, clearFields: [], reason: "Fixture profile update" }, expect.objectContaining({ "Idempotency-Key": expect.any(String) }));
  expect(mocks.post).not.toHaveBeenCalled();
  expect(mocks.push).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining("Staged") }));
});
it("pre-fills the redirect URI with origin callback URL for Google Sign-in", () => {
  const original = globalThis.window;
  try {
    globalThis.window = { location: { origin: "http://localhost:3006" } } as unknown as Window & typeof globalThis;
    const googleItem = { ...item, id: "oauth_google" };
    const dialog = view(googleItem).find(e => e.type === ActionDialog)!;
    const fields = dialog.props.fields as Array<{ name: string; defaultValue?: string }>;
    const redirectField = fields.find(f => f.name === "redirectUri");
    expect(redirectField?.defaultValue).toBe("http://localhost:3006/api/auth/callback");
  } finally {
    globalThis.window = original;
  }
});
it("activates the staged version only through a separate confirmation", async () => {
  const dialog = view(null, item).find(e => e.type === ActionDialog)!;
  await (dialog.props.onSubmit as (v: unknown) => Promise<void>)({ reason: "Fixture profile activation" });
  expect(mocks.post).toHaveBeenCalledWith("/api/admin/integration-profiles/oauth_microsoft/activate", { expectedVersion: 3, reason: "Fixture profile activation" }, expect.objectContaining({ "Idempotency-Key": expect.any(String) }));
  expect(mocks.patch).not.toHaveBeenCalled();
});

it("pauses the background poll while the replace dialog is open", () => {
  view(item);
  expect(mocks.resource).toHaveBeenCalledWith("/api/admin/integration-profiles", false);
});
it("polls application status and exposes per-service adoption and history", () => {
  const response = { ...data, items: [{ ...item, effectiveStatus: "applying", adoption: { services: [{ service: "calmasta-api", state: "applied" }, { service: "calmasta-worker", state: "applying" }] } }] };
  const tree = view(null, null, response as unknown as typeof data, null, new Set([item.id]));
  expect(mocks.resource).toHaveBeenCalledWith("/api/admin/integration-profiles", 5000);
  expect(JSON.stringify(tree)).toContain("Worker");
  expect(JSON.stringify(tree)).toContain("History");
});
it("renders audit identity time version reason and pagination without credential fields", () => {
  mocks.paged.mockReturnValue({ status: "ready", rows: [{ id: "event-fixture", action: "integration_profile.activate", version: 3, actorName: "Fixture Admin", actorEmail: "admin@example.test", actorId: "actor-fixture", createdAt: "2026-11-12T10:00:00Z", reason: "Rotate fixture credentials" }], hasMore: true, more: false, loadMore: vi.fn() });
  const tree=elements(IntegrationHistory({ id: "oauth_microsoft", onClose: vi.fn() }));
  const text=JSON.stringify(tree);
  expect(text).toContain("Fixture Admin");expect(text).toContain("admin@example.test");expect(text).toContain("2026-11-12 10:00 UTC");expect(text).toContain("Rotate fixture credentials");
  expect(text).not.toContain("clientSecret");expect(tree.some(e=>e.props.children==="Load older changes")).toBe(true);
});

it("lets history recover from request failures during automatic restarts", () => {
  const reload=vi.fn();mocks.paged.mockReturnValue({ status: "error", message: "Temporarily unavailable", rows: [], hasMore: false, reload });
  const tree=elements(IntegrationHistory({ id: "oauth_microsoft", onClose: vi.fn() }));
  const retry=tree.find(e=>e.props.children==="Try again");expect(retry).toBeDefined();(retry!.props.onClick as () => void)();expect(reload).toHaveBeenCalledOnce();
});

it("opens history in a modal instead of expanding a service card", () => {
  const closed=view();const trigger=closed.find(e=>e.props["aria-haspopup"]==="dialog")!;
  expect(trigger.props["aria-haspopup"]).toBe("dialog");
  (trigger.props.onClick as () => void)();expect(mocks.historyState).toHaveBeenCalledWith(item.id);expect(mocks.expandedState).not.toHaveBeenCalled();
  const opened=view(null,null,data,item.id),card=opened.find(e=>e.key===item.id)!;
  expect(elements(card.props.children).some(e=>e.type===IntegrationHistory)).toBe(false);
  const history=opened.find(e=>e.type===IntegrationHistory)!;expect(history).toBeDefined();
  (history.props.onClose as () => void)();expect(mocks.historyState).toHaveBeenLastCalledWith(null);
  expect(opened.some(e=>e.props.children==="Hide history")).toBe(false);
});
it("presents history in the shared accessible modal with clear table columns", () => {
  const close=vi.fn();mocks.paged.mockReturnValue({status:"ready",rows:[],hasMore:false});
  const tree=elements(IntegrationHistory({id:"recall",onClose:close}));
  const modal=tree.find(e=>e.type===Dialog)!;expect(modal.props.onClose).toBe(close);expect(modal.props.title).toBe("Version history — Recall");
  expect(tree.some(e=>e.type===DataTable)).toBe(true);
  expect(tree.filter(e=>e.type===Th).map(e=>e.props.children)).toEqual(["Changed at","Administrator","Action","Version","Fields changed","Reason"]);
  expect(JSON.stringify(tree)).toContain("No recorded changes for this service.");
  expect(tree.some(e=>e.props.children==="Close history")).toBe(false);
});

it("starts cards collapsed with title history last updated status and pending notice visible", () => {
  const response={...data,items:[{...item,updatedAt:"2026-11-12T10:00:00Z",effectiveStatus:"applying"}]};
  const tree=view(null,null,response);
  const toggle=tree.find(e=>e.props["aria-controls"]===`integration-details-${item.id}`)!;
  expect(toggle.props["aria-expanded"]).toBe(false);
  expect(JSON.stringify(tree)).toContain("Microsoft Sign-in");
  expect(JSON.stringify(tree)).toContain("2026-11-12 10:00 UTC");
  expect(JSON.stringify(tree)).toContain("Application pending");
  expect(tree.some(e=>e.props["aria-haspopup"]==="dialog")).toBe(true);
  expect(tree.some(e=>e.props.children==="Replace credentials")).toBe(false);
});
it("expands cards independently and can collapse one without affecting another", () => {
  const response={...data,items:[item,{...item,id:"woo",effectiveStatus:"applied"}]};
  const tree=view(null,null,response);
  const toggle=tree.find(e=>e.props["aria-controls"]===`integration-details-${item.id}`)!;
  (toggle.props.onClick as () => void)();
  const update=mocks.expandedState.mock.calls.at(-1)![0] as (s:Set<string>)=>Set<string>;
  const expanded=update(new Set(["woo"]));expect([...expanded].sort()).toEqual([item.id,"woo"].sort());
  const opened=view(null,null,response,null,expanded);
  expect(opened.filter(e=>e.props.children==="Replace credentials")).toHaveLength(2);
  const collapse=opened.find(e=>e.props["aria-controls"]===`integration-details-${item.id}`)!;
  (collapse.props.onClick as () => void)();
  const remove=mocks.expandedState.mock.calls.at(-1)![0] as (s:Set<string>)=>Set<string>;
  expect([...remove(expanded)]).toEqual(["woo"]);
});

const emailFixture = () => ({ ...data, items: [{ ...item, id: "mail", activeVersion: 1, version: 2, credentialTest: { supported: true, scope: "api_applied_credentials", kind: "smtp_connection_and_authentication", appliedVersion: 1, canTest: true, reason: null, latest: null } }] });
it("collects a required sample recipient before testing the applied mail credentials", async () => {
  mocks.post.mockResolvedValue({ status: "passed", code: "smtp_delivery_accepted", version: 1, scope: "api_applied_credentials" });
  const tree=view(null,null,emailFixture(),null,new Set(["mail"]));
  expect(JSON.stringify(tree)).toContain("Draft v2 is not tested");expect(JSON.stringify(tree)).toContain("diagnostic email");
  const button=tree.find(e=>e.props.children==="Test applied credentials")!;expect(button.props.disabled).toBe(false);
  (button.props.onClick as () => void)();expect(mocks.mailTestState).toHaveBeenCalledWith(emailFixture().items[0]);expect(mocks.post).not.toHaveBeenCalled();
  const dialog=view(null,null,emailFixture(),null,new Set(["mail"]),emailFixture().items[0]).find(e=>e.type===ActionDialog)!;
  expect(dialog.props.title).toBe("Send SMTP test email");expect(dialog.props.confirmLabel).toBe("Send test email");
  expect(dialog.props.fields).toEqual([expect.objectContaining({name:"recipientEmail",label:"Recipient email",type:"email",autoComplete:"email",required:true})]);
  await (dialog.props.onSubmit as (v:Record<string,string>)=>Promise<void>)({recipientEmail:" SAMPLE@Example.Test ",reason:"Verify Postmark delivery"});
  expect(mocks.post).toHaveBeenCalledOnce();expect(mocks.post).toHaveBeenCalledWith("/api/admin/integration-profiles/mail/test",{expectedVersion:1,reason:"Verify Postmark delivery",recipientEmail:"sample@example.test"},expect.objectContaining({"Idempotency-Key":expect.any(String)}));
  expect(mocks.push).toHaveBeenCalledWith(expect.objectContaining({tone:"success",message:expect.stringContaining("SMTP accepted")}));
});
it("keeps the SMTP dialog retryable when the test request fails", async () => {
  mocks.post.mockRejectedValue(new Error("network unavailable"));
  const fixture=emailFixture().items[0];
  const dialog=view(null,null,emailFixture(),null,new Set(["mail"]),fixture).find(e=>e.type===ActionDialog)!;
  await expect((dialog.props.onSubmit as (v:Record<string,string>)=>Promise<void>)({recipientEmail:"sample@example.test",reason:"Verify delivery"})).rejects.toThrow("We couldn’t run the credential check");
  expect(mocks.push).toHaveBeenCalledWith(expect.objectContaining({tone:"danger"}));
});
it("keeps tests unavailable until a version is applied to this API", () => {
  const response=emailFixture();response.items[0].credentialTest.canTest=false;
  const tree=view(null,null,response,null,new Set(["mail"]));
  expect(tree.find(e=>e.props.children==="Test applied credentials")?.props.disabled).toBe(true);
});
it("shows old test results as stale instead of validating the current credentials", () => {
  const response={...emailFixture(),items:[{...emailFixture().items[0],credentialTest:{...emailFixture().items[0].credentialTest,latest:{status:"passed",code:"smtp_authentication_verified",version:0,checkedAt:"2026-11-12T10:00:00Z",isCurrent:false}}}]};
  const tree=view(null,null,response,null,new Set(["mail"]));expect(JSON.stringify(tree)).toContain("Older version");
});
