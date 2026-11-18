import { isValidElement, type ReactElement, type ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const hooks = vi.hoisted(() => ({
  states: [] as unknown[],
  setters: [] as Array<(v: unknown) => void>,
  effects: [] as Array<() => void>,
  cursor: 0,
}));
vi.mock("react", async (original) => {
  const actual = await original<typeof import("react")>();
  return {
    ...actual,
    useState: (initial: unknown) => {
      const i = hooks.cursor++;
      if (hooks.setters[i] === undefined) {
        if (hooks.states[i] === undefined) hooks.states[i] = typeof initial === "function" ? (initial as () => unknown)() : initial;
        hooks.setters[i] = (v: unknown) => {
          hooks.states[i] = typeof v === "function" ? (v as (p: unknown) => unknown)(hooks.states[i]) : v;
        };
      }
      return [hooks.states[i], hooks.setters[i]];
    },
    useEffect: (effect: () => unknown) => {
      hooks.effects.push(effect as () => void);
    },
    useRef: (initial: unknown) => ({ current: initial }),
  };
});
vi.mock("next/navigation", () => ({ useSearchParams: () => ({ get: () => null }) }));
vi.mock("@tanstack/react-query", async (original) => ({
  ...(await original<typeof import("@tanstack/react-query")>()),
  useQuery: () => ({ data: undefined, isError: false, error: null }),
}));
vi.mock("@/components/shell/use-display-title", () => ({ useDisplayTitle: () => () => "" }));
vi.mock("@/components/ui/toast", () => ({
  useToasts: () => ({ push: vi.fn(), items: [], dismiss: vi.fn() }),
  ToastStack: () => null,
}));
vi.mock("@/hooks/use-meeting-toasts", () => ({ useMeetingToasts: vi.fn() }));
vi.mock("@/lib/mutations", () => ({
  useRequestMeeting: () => ({ mutateAsync: vi.fn(async () => ({})), isPending: false }),
  useCancelMeeting: () => ({ mutateAsync: vi.fn() }),
}));

import { CaptureForm } from "./capture-form";
import { BotNamePreferenceDialog } from "./capture/bot-name-preference-dialog";

type Props = Record<string, unknown> & { children?: ReactNode };
function elements(node: ReactNode): ReactElement<Props>[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement<Props>(node)) return [];
  return [node, ...elements(node.props.children)];
}

const unsetPrefs = {
  version: 1,
  botName: null,
  promptState: "unset",
  effectiveBotName: "Joobah Notetaker",
  adminDefaultBotName: "Joobah Notetaker",
  policyVersion: 1,
};
const savedPrefs = {
  ...unsetPrefs,
  version: 2,
  botName: "MyBot",
  promptState: "saved",
  effectiveBotName: "MyBot",
};

function renderOnce() {
  hooks.cursor = 0;
  hooks.effects = [];
  const out = CaptureForm() as ReactNode;
  const pending = hooks.effects;
  hooks.effects = [];
  pending.forEach((e) => e());
  return out;
}
function screen() {
  renderOnce(); // let effects apply pending state updates
  hooks.cursor = 0;
  hooks.effects = [];
  const tree = elements(CaptureForm() as ReactNode);
  hooks.effects = [];
  const dialog = tree.find((e) => e.type === BotNamePreferenceDialog)!;
  const input = tree.find((e) => e.props.id === "bot-name")!;
  const form = tree.find((e) => e.type === "form")!;
  return {
    applyPrefs: (prefs: unknown) => (dialog.props.onReady as (p: unknown) => void)(prefs),
    typeName: (value: string) => (input.props.onChange as (e: { target: { value: string } }) => void)({ target: { value } }),
    fieldValue: input.props.value as string,
    submit: () => (form.props.onSubmit as (e: { preventDefault: () => void }) => Promise<void>)({ preventDefault: () => {} }),
  };
}

beforeEach(() => {
  hooks.states = [];
  hooks.setters = [];
  hooks.effects = [];
  hooks.cursor = 0;
});
afterEach(() => vi.unstubAllGlobals());

it("prefills the assistant name from the first preferences load", () => {
  screen().applyPrefs(unsetPrefs);
  expect(screen().fieldValue).toBe("Joobah Notetaker");
});

it("refills the assistant name after the name modal saves, without a page refresh", () => {
  screen().applyPrefs(unsetPrefs);
  expect(screen().fieldValue).toBe("Joobah Notetaker");
  // The modal PATCH answers with the newly saved name.
  screen().applyPrefs(savedPrefs);
  expect(screen().fieldValue).toBe("MyBot");
});

it("keeps a manually typed name when preferences reload", () => {
  screen().applyPrefs(unsetPrefs);
  screen().typeName("Custom");
  screen().applyPrefs({ ...savedPrefs, version: 3, effectiveBotName: "Other" });
  expect(screen().fieldValue).toBe("Custom");
});

it("brings the meetings list into view after the assistant is sent", async () => {
  const scrollIntoView = vi.fn();
  const getById = vi.fn(() => ({ scrollIntoView }));
  const scrollTo = vi.fn();
  vi.stubGlobal("document", { getElementById: getById });
  vi.stubGlobal("window", { matchMedia: () => ({ matches: false }), scrollTo });
  await screen().submit();
  expect(getById).toHaveBeenCalledWith("history-heading");
  expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
  expect(scrollTo).not.toHaveBeenCalled();
});

it("scrolls to the top when the meetings list is not on screen", async () => {
  const scrollTo = vi.fn();
  vi.stubGlobal("document", { getElementById: () => null });
  vi.stubGlobal("window", { matchMedia: () => ({ matches: true }), scrollTo });
  await screen().submit();
  expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "auto" });
});
