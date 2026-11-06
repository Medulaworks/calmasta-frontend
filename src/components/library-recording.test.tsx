import { createElement, isValidElement, type ReactNode, type ReactElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { LibraryRecording } from "./library-recording";
import { PrivateAudio } from "./private-audio";
import { MeetingInsights } from "./meeting-insights";
import { TranscriptEditor } from "./transcript-editor";
import { Button } from "./ui/button";
import { Tabs, tabPanelId } from "./ui/tabs";
import { qk } from "../lib/queries";
import type { MeetingInsights as Insights } from "../lib/meeting-insights-client";

// Run the recording/player hooks and their effects without a browser. Child insights
// are rendered with the real QueryClient; only navigation and the editor boundary are stubbed.
const hooks = vi.hoisted(() => ({ active: false, index: 0, values: [] as unknown[], deps: [] as (readonly unknown[] | undefined)[], pending: [] as (() => void)[], cleanup: [] as (() => void)[], subscriptions: [] as (() => void)[], client: null as QueryClient | null }));
vi.mock("react", async (original) => {
  const react = await original<typeof import("react")>();
  return { ...react,
    useState: (initial: unknown) => {
      if (!hooks.active) return react.useState(initial);
      const slot = hooks.index++;
      if (!(slot in hooks.values)) hooks.values[slot] = typeof initial === "function" ? initial() : initial;
      return [hooks.values[slot], (next: unknown) => { hooks.values[slot] = typeof next === "function" ? next(hooks.values[slot]) : next; }];
    },
    useRef: (initial: unknown) => {
      if (!hooks.active) return react.useRef(initial);
      const slot = hooks.index++;
      if (!(slot in hooks.values)) hooks.values[slot] = { current: initial };
      return hooks.values[slot];
    },
    useCallback: (callback: unknown, deps: readonly unknown[]) => hooks.active ? callback : react.useCallback(callback as () => void, deps),
    useEffect: (effect: () => void | (() => void), deps?: readonly unknown[]) => {
      if (!hooks.active) return react.useEffect(effect, deps);
      const slot = hooks.index++;
      const previous = hooks.deps[slot];
      if (!previous || !deps || deps.some((value, i) => !Object.is(value, previous[i]))) {
        hooks.deps[slot] = deps;
        hooks.pending.push(() => { hooks.cleanup[slot]?.(); const cleanup = effect(); hooks.cleanup[slot] = typeof cleanup === "function" ? cleanup : () => {}; });
      }
    },
  };
});
vi.mock("@tanstack/react-query", async (original) => {
  const query = await original<typeof import("@tanstack/react-query")>();
  return { ...query,
    useQueryClient: (...args: Parameters<typeof query.useQueryClient>) => hooks.active && hooks.client ? hooks.client : query.useQueryClient(...args),
    useMutation:(options:Parameters<typeof query.useMutation>[0])=>hooks.active&&hooks.client?new query.MutationObserver(hooks.client,options).getCurrentResult():query.useMutation(options),
    useQuery: (options: Parameters<typeof query.useQuery>[0]) => {
      if (!hooks.active || !hooks.client) return query.useQuery(options);
      const observer = new query.QueryObserver(hooks.client, options);
      hooks.subscriptions.push(observer.subscribe(() => {}));
      return observer.getCurrentResult();
    },
  };
});
vi.mock("next/navigation", () => ({ useRouter: () => ({ back: vi.fn(), push: vi.fn() }) }));
vi.mock("./transcript-editor", () => ({ TranscriptEditor: () => createElement("section", null, "Transcript editor") }));
const id = "fixture-meeting";
const detail = (source = "meeting", version = 3) => ({ id, source, title: "Team review", state: "completed", createdAt: "2026-11-04T00:00:00Z", transcriptVersion: version, transcript: [{ id: "line", startMs: 0, endMs: 1000, text: "When?", speakerId: null, editedByUser: false }], speakerNames: {} });
const insights: Insights = { captureId: id, transcriptVersion: 3, transcriptReady: true, enabled: true, liveProcessingEnabled: true, autoRecapEnabled: true, questionsOnDemand: true, recap: { id: "recap", state: "ready", transcriptVersion: 3, isStale: false, failureReason: null, emailStatus: "not_requested", updatedAt: "", result: { briefSummary: "Meeting overview", detailedSummary: "Long recap", highlights: [], decisions: [], nextSteps: [] } }, questions: { id: "questions", state: "ready", transcriptVersion: 3, isStale: false, failureReason: null, emailStatus: "not_requested", updatedAt: "", result: { coverage: "ai_extraction_not_guaranteed_exhaustive", questions: [{ text: "When?", sources: [{ segmentId: "line", startMs: 12000, endMs: 13000, speakerId: null }] }] } } };
const clients: QueryClient[] = [];
function run<T>(component: () => T): T {
  hooks.active = true; hooks.index = 0;
  try { return component(); } finally { hooks.active = false; }
}
async function effects() { hooks.pending.splice(0).forEach(effect => effect()); await Promise.resolve(); await Promise.resolve(); }
function find<P>(node: ReactNode, type: unknown): ReactElement<P> | undefined {
  if (Array.isArray(node)) return node.map(child => find<P>(child, type)).find(Boolean);
  if (!isValidElement<{ children?: ReactNode }>(node)) return undefined;
  if (node.type === type) return node as ReactElement<P>;
  return find<P>(node.props.children, type);
}
function markup(node: ReactNode) {
  const client = new QueryClient(); clients.push(client);
  client.setQueryData(qk.meetingInsights(id), insights);
  client.setQueryData(qk.meetingPreferences(), { recapEmailEnabled: false, emailVerified: true, canReceiveRecapEmail: true });
  return renderToStaticMarkup(createElement(QueryClientProvider, { client }, node));
}
beforeEach(() => { vi.stubGlobal("fetch", vi.fn().mockImplementation(() => Promise.resolve(Response.json(detail())))); });
afterEach(() => { hooks.cleanup.forEach(cleanup => cleanup?.()); hooks.values = []; hooks.deps = []; hooks.pending = []; hooks.cleanup = []; hooks.subscriptions.splice(0).forEach(unsubscribe => unsubscribe()); hooks.client = null; clients.splice(0).forEach(client => client.clear()); vi.unstubAllGlobals(); vi.useRealTimers(); });
async function mount(source = "meeting") {
  vi.mocked(fetch).mockImplementation(() => Promise.resolve(Response.json(detail(source))));
  run(() => LibraryRecording({ id })); await effects();
  await vi.waitFor(() => expect(find(run(() => LibraryRecording({ id })), TranscriptEditor)).toBeDefined());
  return run(() => LibraryRecording({ id }));
}
it("meeting recording shows the existing recap panel with actual identity/version and preserves the editor and player", async () => {
  const tree = await mount();
  const panel = find<ComponentProps<typeof MeetingInsights>>(tree, MeetingInsights);
  expect(panel?.props.id).toBe(id); expect(panel?.props.transcriptVersion).toBe(3);
  const html = markup(tree);
  expect(html).toContain("Meeting insights"); expect(html).toContain("Meeting overview"); expect(html).toContain("Transcript editor"); expect(html).toContain("Private audio"); expect(html).toContain("Meeting controls");
});
it("uploaded audio has no meeting insight panel or insight requests", async () => {
  const tree = await mount("upload");
  expect(markup(tree)).not.toContain("Meeting insights");
  expect(find(tree, MeetingInsights)).toBeUndefined(); expect(fetch).toHaveBeenCalledTimes(1);
});
it("mounting and refreshing the meeting only read data and never dispatch generation", async () => {
  const tree = await mount(); markup(tree); await effects();
  // Mount the real insight query observer and execute the panel's actual version
  // invalidation effect. This catches generation accidentally added to an effect.
  const panel = find<ComponentProps<typeof MeetingInsights>>(tree, MeetingInsights)!;
  expect(panel).toBeDefined();
  hooks.cleanup.forEach(cleanup => cleanup?.()); hooks.cleanup = []; hooks.deps = []; hooks.pending = [];
  hooks.values=[];hooks.client = clients.at(-1)!;
  vi.mocked(fetch).mockImplementation((url) => Promise.resolve(Response.json(String(url).endsWith("/insights") ? insights : detail())));
  run(() => MeetingInsights(panel.props)); await effects();
  await vi.waitFor(() => expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).endsWith("/insights"))).toBe(true));
  for (const [, init] of vi.mocked(fetch).mock.calls) expect(init?.method ?? "GET").toBe("GET");
});
it("a transcript save refreshes the version and marks the existing recap stale", async () => {
  const tree = await mount();
  vi.mocked(fetch).mockImplementation(() => Promise.resolve(Response.json(detail("meeting", 4))));
  find<ComponentProps<typeof TranscriptEditor>>(tree, TranscriptEditor)!.props.onChanged();
  run(() => LibraryRecording({ id })); await effects();
  await vi.waitFor(() => expect(find<ComponentProps<typeof TranscriptEditor>>(run(() => LibraryRecording({ id })), TranscriptEditor)?.props.cap.transcriptVersion).toBe(4));
  const updated = run(() => LibraryRecording({ id }));
  expect(find<ComponentProps<typeof MeetingInsights>>(updated, MeetingInsights)?.props.transcriptVersion).toBe(4);
  expect(markup(updated)).toContain("Based on an older transcript");
});
it("question seeking uses this player's loaded audio and disappears when audio becomes unavailable", async () => {
  let tree = await mount();
  let panel = find<ComponentProps<typeof MeetingInsights>>(tree, MeetingInsights)!;
  expect(panel.props.audioAvailable).toBe(false); expect(markup(tree)).not.toContain("Seek audio to");
  const audio = { readyState: 1, duration: 60, currentTime: 0, focus: vi.fn() } as unknown as HTMLAudioElement;
  const player = find<ComponentProps<typeof PrivateAudio> & { onAudioChange?: (audio: HTMLAudioElement | null) => void }>(tree, PrivateAudio)!;
  expect(player.props.onAudioChange).toBeTypeOf("function");
  player.props.onAudioChange?.({ ...audio, readyState: 0 });
  tree = run(() => LibraryRecording({ id }));
  expect(find<ComponentProps<typeof MeetingInsights>>(tree, MeetingInsights)?.props.audioAvailable).toBe(false);
  player.props.onAudioChange?.(audio);
  tree = run(() => LibraryRecording({ id })); panel = find<ComponentProps<typeof MeetingInsights>>(tree, MeetingInsights)!;
  expect(panel.props.audioAvailable).toBe(true); expect(markup(tree)).toContain("Seek audio to");
  panel.props.onSeek(12000); expect(audio.currentTime).toBe(12); expect(audio.focus).toHaveBeenCalledOnce();
  player.props.onAudioChange?.(null); tree = run(() => LibraryRecording({ id }));
  expect(find<ComponentProps<typeof MeetingInsights>>(tree, MeetingInsights)?.props.audioAvailable).toBe(false);
});
it("PrivateAudio reports metadata readiness and clears the audio on error, expiry and unmount", async () => {
  vi.useFakeTimers(); const onAudioChange = vi.fn();
  vi.mocked(fetch).mockResolvedValue(Response.json({ url: "/fixture-audio", expiresAt: new Date(Date.now() + 1000).toISOString() }));
  let tree = run(() => PrivateAudio({ id, ...{ onAudioChange } })); await effects();
  find<ComponentProps<typeof Button>>(tree, Button)!.props.onClick?.({} as never); await vi.advanceTimersByTimeAsync(0);
  tree = run(() => PrivateAudio({ id, ...{ onAudioChange } })); await effects();
  const audio = find<ComponentProps<"audio">>(tree, "audio")!;
  expect(audio).toBeDefined(); expect(audio.props.ref).toBeTypeOf("function");
  const element = { readyState: 1 } as HTMLAudioElement;
  audio.props.onLoadedMetadata?.({ currentTarget: element } as never); expect(onAudioChange).toHaveBeenLastCalledWith(element);
  audio.props.onEmptied?.({} as never); expect(onAudioChange).toHaveBeenLastCalledWith(null);
  audio.props.onError?.({} as never); expect(onAudioChange).toHaveBeenLastCalledWith(null);
  await vi.advanceTimersByTimeAsync(1000); tree = run(() => PrivateAudio({ id, ...{ onAudioChange } }));
  expect(find(tree, "audio")).toBeUndefined();
  // React detaches the audio ref when the link expires, is replaced or unmounts.
  (audio.props.ref as (node: HTMLAudioElement | null) => void)(null); expect(onAudioChange).toHaveBeenLastCalledWith(null);
});

it("groups transcript and insights in tabs, defaults to insights, and keeps both panels mounted", async () => {
 let tree = await mount();
 let tabs = find<ComponentProps<typeof Tabs>>(tree, Tabs);
 expect(tabs).toBeDefined();
 expect(tabs!.props.items.map(item => item.label)).toEqual(["Meeting insights", "Transcript"]);
 const transcript=tabs!.props.items.find(t=>t.label==="Transcript")!,insights=tabs!.props.items.find(t=>t.label==="Meeting insights")!;
 function panel(node: ReactNode, id: string): ReactElement<{id:string;hidden:boolean;children?:ReactNode}> | undefined {
  if(Array.isArray(node))return node.map(child=>panel(child,id)).find(Boolean);
  if(!isValidElement<{id?:string;children?:ReactNode}>(node))return undefined;
  return node.props.id===id?node as ReactElement<{id:string;hidden:boolean;children?:ReactNode}>:panel(node.props.children,id);
 }
 expect(tabs!.props.active).toBe(insights.id);
 expect(panel(tree,tabPanelId(insights.id))?.props.hidden).toBe(false);
 expect(panel(tree,tabPanelId(transcript.id))?.props.hidden).toBe(true);
 tabs!.props.onChange(transcript.id);
 tree=run(()=>LibraryRecording({id}));tabs=find<ComponentProps<typeof Tabs>>(tree,Tabs)!;
 expect(tabs.props.active).toBe(transcript.id);
 expect(panel(tree,tabPanelId(transcript.id))?.props.hidden).toBe(false);
 expect(panel(tree,tabPanelId(insights.id))?.props.hidden).toBe(true);
 expect(find(tree,TranscriptEditor)).toBeDefined();expect(find(tree,MeetingInsights)).toBeDefined();
 tabs.props.onChange(insights.id);tree=run(()=>LibraryRecording({id}));
 expect(find<ComponentProps<typeof Tabs>>(tree,Tabs)?.props.active).toBe(insights.id);
 find<ComponentProps<typeof Tabs>>(tree,Tabs)!.props.onChange(transcript.id);
 vi.mocked(fetch).mockImplementation(()=>Promise.resolve(Response.json({...detail(),id:"another-meeting"})));
 run(()=>LibraryRecording({id:"another-meeting"}));await effects();
 await vi.waitFor(()=>expect(find<ComponentProps<typeof Tabs>>(run(()=>LibraryRecording({id:"another-meeting"})),Tabs)?.props.active).toBe("recording-another-meeting-insights"));
});
