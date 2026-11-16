import { isValidElement, type ReactElement, type ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { fixtureEffectivePolicy } from "@/lib/product-policy-types";
import { ApiError } from "@/lib/upload-client";
import { ResourceBoundary } from "./ui";

const hooks = vi.hoisted(() => ({ values: [] as unknown[], cursor: 0, allowed: true }));
const cache = vi.hoisted(() => ({ removeQueries: vi.fn(), invalidateQueries: vi.fn(), reload: vi.fn(), intervals: [] as unknown[], fetching: false, error: null as Error | null, data: null as import("@/lib/product-policy-types").EffectiveProductPolicy | null }));
vi.mock("@tanstack/react-query", async original => ({ ...(await original<typeof import("@tanstack/react-query")>()), useQueryClient: () => cache }));
vi.mock("./ui", async original => ({ ...(await original<typeof import("./ui")>()), useResource: (_url: string, interval: unknown) => { cache.intervals.push(interval);return { data: cache.data ?? fixtureEffectivePolicy, loading: false, fetching: cache.fetching, error: cache.error, reload: cache.reload }; } }));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useState: (initial: unknown) => {
    const i = hooks.cursor++;
    if (!(i in hooks.values)) hooks.values[i] = typeof initial === "function" ? (initial as () => unknown)() : initial;
    return [hooks.values[i], (value: unknown) => { hooks.values[i] = typeof value === "function" ? (value as (old: unknown) => unknown)(hooks.values[i]) : value; }];
  },
  useRef: (initial: unknown) => {
    const i = hooks.cursor++;
    if (!(i in hooks.values)) hooks.values[i] = { current: initial };
    return hooks.values[i];
  },
}));
vi.mock("@/lib/admin-capabilities", () => ({ capability: () => ({ allowed: hooks.allowed, reason: hooks.allowed ? null : "staff_permission_required" }) }));

import { ProductSettingsForm, RecordingSettings } from "./product-settings-form";

type Props = Record<string, unknown> & { children?: ReactNode };
function elements(node: ReactNode): ReactElement<Props>[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement<Props>(node)) return [];
  return [node, ...elements(node.props.children)];
}
function renderedForms(node: ReactNode, parents: string[] = []): Array<{ element: ReactElement<Props>; parents: string[] }> {
  if (Array.isArray(node)) return node.flatMap(child => renderedForms(child, parents));
  if (!isValidElement<Props>(node)) return [];
  if (node.type === ResourceBoundary) return renderedForms(ResourceBoundary(node.props as unknown as Parameters<typeof ResourceBoundary>[0]), parents);
  if (node.type === ProductSettingsForm) return [{ element: node, parents }];
  return renderedForms(node.props.children, [...parents, typeof node.type === "string" ? node.type : String(node.type)]);
}
function sectionForm(node: ReactNode) {
  const form = renderedForms(node)[0]?.element;
  expect(form).toBeDefined();
  return form as ReactElement<Parameters<typeof ProductSettingsForm>[0]>;
}

const reload = vi.fn();
const policy = { ...fixtureEffectivePolicy, values: { ...fixtureEffectivePolicy.values, capture: { ...fixtureEffectivePolicy.values.capture, videoEnabled: false } } };
function screen() {
  hooks.cursor = 0;
  return elements(ProductSettingsForm({ data: policy, reload }));
}
function input(id: string) {
  const el = screen().find(e => e.props.id === id);
  expect(el, id).toBeDefined();
  return el!;
}
function edit(id: string, value: string | boolean) {
  const onChange = input(id).props.onChange as (event: { target: { value: string; checked: boolean } }) => void;
  onChange({ target: { value: String(value), checked: value === true } });
}
function button(label: string) {
  const el = screen().find(e => e.props.children === label && typeof e.props.onClick === "function");
  expect(el, label).toBeDefined();
  return el!;
}
async function click(label: string) { await (button(label).props.onClick as () => Promise<void>)(); }
beforeEach(() => { hooks.values = []; hooks.cursor = 0; hooks.allowed = true; reload.mockClear(); cache.removeQueries.mockClear(); cache.invalidateQueries.mockClear(); cache.reload.mockClear(); cache.intervals = []; cache.fetching = false; cache.error = null; cache.data = null; });
afterEach(() => vi.unstubAllGlobals());

it("loads saved nested policy and exposes the video switch", () => {
  expect(input("recording-default-minutes").props.value).toBe("10");
  expect(input("recording-max-minutes").props.value).toBe("20");
  expect(input("recording-video-enabled").props.checked).toBe(false);
});

it("loads the enable switch and removes the environment pause control", () => {
  expect(input("recording-processing-enabled").props.checked).toBe(policy.values.operations.processingEnabled);
  expect(screen().some(e => e.props.id === "recording-environment-paused")).toBe(false);
});

it("saves live provider processing independently without rewriting allowance or admission settings", async () => {
  const fetcher = vi.fn<typeof fetch>(async () => Response.json({ ...policy, version: 8 }));
  vi.stubGlobal("fetch", fetcher);
  expect(input("recording-live-processing-enabled").props.checked).toBe(false);
  edit("recording-live-processing-enabled", true);
  expect(button("Save recording settings").props.disabled).toBe(false);
  edit("recording-change-reason", "Allow bounded live provider processing");
  await click("Save recording settings");
  expect(JSON.parse(fetcher.mock.calls[0][1]!.body as string)).toEqual({ expectedVersion: 7, changes: { operations: { liveProcessingEnabled: true } }, reason: "Allow bounded live provider processing" });
  expect(reload).toHaveBeenCalledOnce();
});

it("saves processing changes directly without changing the separate environment pause or allowances", async () => {
  const fetcher = vi.fn<typeof fetch>(async () => Response.json({ ...policy, version: 8 }));
  vi.stubGlobal("fetch", fetcher);
  edit("recording-processing-enabled", true);
  edit("recording-change-reason", "Configure environment processing");
  await click("Save recording settings");
  expect(fetcher).toHaveBeenCalledOnce();
  expect(JSON.parse(fetcher.mock.calls[0][1]!.body as string)).toEqual({ expectedVersion: 7, changes: { operations: { processingEnabled: true } }, reason: "Configure environment processing" });
  expect(reload).toHaveBeenCalledOnce();
});

it("keeps only Save and enables it when a setting changes, before entering a reason", async () => {
  expect(button("Save recording settings").props.disabled).toBe(true);
  edit("recording-processing-enabled", !policy.values.operations.processingEnabled);
  const actions = screen().filter(e => typeof e.props.onClick === "function");
  expect(actions.map(e => e.props.children)).toEqual(["Save recording settings"]);
  expect(button("Save recording settings").props.disabled).toBe(false);
  const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
  await click("Save recording settings");
  expect(fetcher).not.toHaveBeenCalled();
  expect(JSON.stringify(screen())).toContain("Enter a reason");
  expect(input("recording-change-reason").props["aria-required"]).toBe(true);
});

it("explains the bounded allowance requirement without changing allowance settings", async () => {
  const fetcher = vi.fn<typeof fetch>(async () => Response.json({ code: "bounded_free_required" }, { status: 400 }));
  vi.stubGlobal("fetch", fetcher);
  edit("recording-processing-enabled", true);
  edit("recording-change-reason", "Enable processing");
  await click("Save recording settings");
  expect(JSON.stringify(screen())).toContain("bounded Free recording allowance");
  expect(JSON.parse(fetcher.mock.calls[0][1]!.body as string).changes).toEqual({ operations: { processingEnabled: true } });
  expect(reload).not.toHaveBeenCalled();
});

it("refreshes capture policy after saving so the capture page does not keep old limits", () => {
  const section = RecordingSettings();
  const form = sectionForm(section);
  form.props.reload();
  expect(cache.removeQueries).toHaveBeenCalledWith({ queryKey: ["capturePolicy"], type: "inactive" });
  expect(cache.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["capturePolicy"] });
  expect(cache.reload).toHaveBeenCalledOnce();
});

it("refreshes runtime readiness automatically but pauses polling while a draft is being edited", () => {
  const section = RecordingSettings();
  expect(cache.intervals.at(-1)).toBe(2000);
  const form = sectionForm(section);
  form.props.onEdited?.();
  cache.data = { ...fixtureEffectivePolicy, version: 8 };
  hooks.cursor = 0;const editing = RecordingSettings();
  expect(cache.intervals.at(-1)).toBe(false);
  expect(sectionForm(editing).props.data.version).toBe(7);
  form.props.reload();
  hooks.cursor = 0;RecordingSettings();
  expect(cache.intervals.at(-1)).toBe(2000);
});

it("saves durations and video directly through the versioned policy contract", async () => {
  const fetcher = vi.fn<typeof fetch>(async () => Response.json({ ...fixtureEffectivePolicy, version: 8 }));
  vi.stubGlobal("fetch", fetcher);
  edit("recording-default-minutes", "15");
  edit("recording-max-minutes", "30");
  edit("recording-video-enabled", true);
  edit("recording-change-reason", "Allow video for new meetings");
  await click("Save recording settings");
  expect(fetcher).toHaveBeenCalledOnce();
  const [url, init] = fetcher.mock.calls[0];
  expect(url).toBe("/api/admin/settings/product");
  expect(init?.method).toBe("PATCH");
  expect(new Headers(init?.headers).get("Idempotency-Key")).toBeTruthy();
  expect(JSON.parse(init!.body as string)).toEqual({ expectedVersion: 7, changes: { capture: { defaultMeetingDurationSeconds: 900, maxMeetingDurationSeconds: 1800, videoEnabled: true } }, reason: "Allow video for new meetings" });
  expect(reload).toHaveBeenCalledOnce();
});

it("rejects a default above the maximum and requires a reason", async () => {
  const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
  edit("recording-default-minutes", "30");
  edit("recording-change-reason", "Invalid duration");
  expect(button("Save recording settings").props.disabled).toBe(true);
  await click("Save recording settings");
  expect(fetcher).not.toHaveBeenCalled();
  edit("recording-default-minutes", "15");
  edit("recording-change-reason", "");
  expect(button("Save recording settings").props.disabled).toBe(false);
  await click("Save recording settings");
  expect(fetcher).not.toHaveBeenCalled();
});

it("allows a video-only change and prevents edits without settings permission", async () => {
  edit("recording-video-enabled", true);
  edit("recording-change-reason", "Enable optional video");
  expect(button("Save recording settings").props.disabled).toBe(false);
  hooks.allowed = false;
  const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
  for (const id of ["recording-default-minutes", "recording-max-minutes", "recording-video-enabled", "recording-processing-enabled", "recording-live-processing-enabled"]) expect(input(id).props.disabled).toBe(true);
  await click("Save recording settings");
  expect(fetcher).not.toHaveBeenCalled();
});

it("preserves the draft on a version conflict and offers explicit reload", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({ code: "version_conflict", message: "Policy changed" }, { status: 409 })));
  edit("recording-video-enabled", true);
  edit("recording-change-reason", "Enable video");
  await click("Save recording settings");
  expect(reload).not.toHaveBeenCalled();
  expect(input("recording-video-enabled").props.checked).toBe(true);
  expect(button("Save recording settings").props.disabled).toBe(true);
  await click("Reload recording settings");
  expect(reload).toHaveBeenCalledOnce();
});

it("reuses the operation key when retrying an uncertain save", async () => {
  const fetcher = vi.fn().mockRejectedValueOnce(new Error("Network unavailable")).mockResolvedValueOnce(Response.json({ ...fixtureEffectivePolicy, version: 8 }));
  vi.stubGlobal("fetch", fetcher);
  edit("recording-video-enabled", true);
  edit("recording-change-reason", "Enable video");
  await click("Save recording settings");
  await click("Save recording settings");
  const headers = fetcher.mock.calls.map(call => new Headers(call[1].headers).get("Idempotency-Key"));
  expect(headers[0]).toBeTruthy();
  expect(headers[1]).toBe(headers[0]);
  expect(reload).toHaveBeenCalledOnce();
});

it("keeps the form under the same real-boundary ancestry throughout an in-flight refresh", () => {
  const first = RecordingSettings();
  const parents = renderedForms(first)[0].parents;
  sectionForm(first).props.onEdited?.();
  cache.fetching = true; hooks.cursor = 0;
  expect(renderedForms(RecordingSettings())[0].parents).toEqual(parents);
  cache.fetching = false; hooks.cursor = 0;
  expect(renderedForms(RecordingSettings())[0].parents).toEqual(parents);
});

it("hides an edited form when the real resource boundary reports revoked access", () => {
  const first = RecordingSettings();
  sectionForm(first).props.onEdited?.();
  cache.error = new ApiError(403, "Forbidden"); hooks.cursor = 0;
  expect(renderedForms(RecordingSettings())).toEqual([]);
});
