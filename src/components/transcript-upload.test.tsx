import { isValidElement, type ComponentProps, type ReactElement, type ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { TranscriptUpload } from "./transcript-upload";
import { Button } from "./ui/button";
import { Dialog } from "./ui/dialog";
const h = vi.hoisted(() => ({ index: 0, values: [] as unknown[], push: vi.fn(), invalidate: vi.fn() }));
vi.mock("react", async original => ({ ...await original<typeof import("react")>(),
 useState: (initial: unknown) => { const slot = h.index++; if (!(slot in h.values)) h.values[slot] = initial; return [h.values[slot], (next: unknown) => { h.values[slot] = typeof next === "function" ? next(h.values[slot]) : next; }]; },
 useRef: (initial: unknown) => { const slot = h.index++; if (!(slot in h.values)) h.values[slot] = { current: initial }; return h.values[slot]; },
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: h.push }) }));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ invalidateQueries: h.invalidate }) }));
let currentPolicy: {maxTranscriptCharacters:number;maxTranscriptBytes:number}|null|undefined;
function tree() { h.index = 0; return TranscriptUpload({policy:currentPolicy}); }
function nodes<P>(node: ReactNode, type: unknown): ReactElement<P>[] {
 if (Array.isArray(node)) return node.flatMap(child => nodes<P>(child, type));
 if (!isValidElement<{ children?: ReactNode }>(node)) return [];
 return [...(node.type === type ? [node as ReactElement<P>] : []), ...nodes<P>(node.props.children, type)];
}
function button(label: string) { return nodes<ComponentProps<typeof Button>>(tree(), Button).find(item => item.props.children === label)!; }
function input(type: string) { return nodes<ComponentProps<"input">>(tree(), "input").find(item => item.props.type === type)!; }
function paste(text: string) { nodes<ComponentProps<"textarea">>(tree(), "textarea")[0].props.onChange?.({ target: { value: text } } as never); }
function consent() { input("checkbox").props.onChange?.({ target: { checked: true } } as never); }
function open() { button("Add transcript").props.onClick?.({} as never); }
const receipt = () => Response.json({ id: "saved", captureId: "saved", state: "completed", transcriptVersion: 1 }, { status: 201 });
beforeEach(() => { currentPolicy=undefined;h.index = 0; h.values = []; h.push.mockReset(); h.invalidate.mockReset(); vi.stubGlobal("fetch", vi.fn()); });
afterEach(() => vi.unstubAllGlobals());
it("pastes and previews text, requires consent and navigates only after confirmed persistence", async () => {
 let finish!: (response: Response) => void;
 vi.mocked(fetch).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
 open(); paste("Project notes\nNext step");
 expect(nodes<ComponentProps<"textarea">>(tree(), "textarea")[0].props.value).toBe("Project notes\nNext step");
 expect(button("Save transcript").props.disabled).toBe(true); consent(); expect(button("Save transcript").props.disabled).toBe(false);
 const save = button("Save transcript"); save.props.onClick?.({} as never); save.props.onClick?.({} as never);
 expect(fetch).toHaveBeenCalledOnce(); expect(h.push).not.toHaveBeenCalled(); expect(button("Saving transcript…").props.disabled).toBe(true);
 finish(receipt()); await vi.waitFor(() => expect(h.push).toHaveBeenCalledWith("/dashboard/library/recordings/saved"));
});
it("reads a UTF-8 txt into the preview and saves its original text", async () => {
 vi.mocked(fetch).mockResolvedValue(receipt()); open();
 await input("file").props.onChange?.({ currentTarget: { files: [new File(["Café\nPlan"], "notes.txt")], value: "notes.txt" } } as never);
 expect(nodes<ComponentProps<"textarea">>(tree(), "textarea")[0].props.value).toBe("Café\nPlan");
 consent(); button("Save transcript").props.onClick?.({} as never);
 await vi.waitFor(() => expect(h.push).toHaveBeenCalledOnce());
 expect(JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string)).toEqual({ text: "Café\nPlan", consent: true });
});
it("retains pasted text and operation key after an uncertain failure", async () => {
 vi.mocked(fetch).mockRejectedValueOnce(new TypeError("connection lost")).mockResolvedValueOnce(receipt()); open(); paste("Keep my text"); consent();
 button("Save transcript").props.onClick?.({} as never);
 await vi.waitFor(() => expect(button("Retry save")).toBeDefined());
 expect(h.push).not.toHaveBeenCalled(); expect(nodes<ComponentProps<"textarea">>(tree(), "textarea")[0].props.value).toBe("Keep my text");
 button("Retry save").props.onClick?.({} as never); await vi.waitFor(() => expect(h.push).toHaveBeenCalledOnce());
 const calls = vi.mocked(fetch).mock.calls; expect(new Headers(calls[0][1]?.headers).get("Idempotency-Key")).toBe(new Headers(calls[1][1]?.headers).get("Idempotency-Key"));
});
it("opens the form in a modal instead of expanding the card", () => {
  expect(nodes(tree(), Dialog).length).toBe(0);
  open();
  const after = tree();
  const dialogs = nodes<ComponentProps<typeof Dialog>>(after, Dialog);
  expect(dialogs.length).toBe(1);
  // The form lives inside the dialog; the card itself stays compact.
  expect(nodes(dialogs[0].props.children, "textarea").length).toBe(1);
  const card = nodes<{ children?: ReactNode }>(after, "section")[0];
  expect(nodes(card.props.children, "textarea").length).toBe(0);
  // Cancel closes the modal and keeps the card as it was.
  nodes<ComponentProps<typeof Button>>(after, Button).find(item => item.props.children === "Cancel")!.props.onClick?.({} as never);
  expect(nodes(tree(), Dialog).length).toBe(0);
});
it("accepts a dropped txt file into the preview", async () => {
  open();
  const zone = nodes<{ onDrop?: (e: never) => void }>(tree(), "label").find(item => typeof item.props.onDrop === "function")!;
  zone.props.onDrop?.({ preventDefault: () => {}, dataTransfer: { files: [new File(["Dropped\nText"], "drop.txt")] } } as never);
  await vi.waitFor(() => expect(nodes<ComponentProps<"textarea">>(tree(), "textarea")[0].props.value).toBe("Dropped\nText"));
});
it("a rejected file preserves the current paste and never sends a save", async () => {
 open(); paste("Keep this draft");
 await input("file").props.onChange?.({ currentTarget: { files: [new File([new Uint8Array([255])], "bad.txt")], value: "bad.txt" } } as never);
 expect(nodes<ComponentProps<"textarea">>(tree(), "textarea")[0].props.value).toBe("Keep this draft"); expect(fetch).not.toHaveBeenCalled(); expect(h.push).not.toHaveBeenCalled();
 expect(nodes<ComponentProps<"p">>(tree(), "p").some(node => node.props.role === "alert")).toBe(true);
});

it("renders transcript limits supplied by the capture policy",()=>{
 h.index=0;const output=TranscriptUpload({policy:{maxTranscriptCharacters:42,maxTranscriptBytes:2097152}});
 expect(JSON.stringify(output)).toContain("42 characters and 2 MiB per file");
});

it("applies refreshed limits without truncating an existing draft",async()=>{
 currentPolicy={maxTranscriptCharacters:50,maxTranscriptBytes:1048576};open();paste("a draft that must be preserved");
 currentPolicy={maxTranscriptCharacters:5,maxTranscriptBytes:1048576};
 expect(nodes<ComponentProps<"textarea">>(tree(),"textarea")[0].props.maxLength).toBe(5);
 consent();await button("Save transcript").props.onClick?.({} as never);
 expect(fetch).not.toHaveBeenCalled();expect(nodes<ComponentProps<"textarea">>(tree(),"textarea")[0].props.value).toBe("a draft that must be preserved");
});
