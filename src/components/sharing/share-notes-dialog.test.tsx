import { createElement, isValidElement, type ReactNode, type ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fixtureSharingState } from "@/lib/sharing-types";

const hooks = vi.hoisted(() => ({
  values: [] as unknown[],
  cursor: 0,
}));

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
  useEffect: () => {},
}));

import { ShareNotesDialog } from "./share-notes-dialog";

type Props = Record<string, unknown> & { children?: ReactNode };
function elements(node: ReactNode): ReactElement<Props>[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement<Props>(node)) return [];
  return [node, ...elements(node.props.children)];
}

describe("ShareNotesDialog", () => {
  beforeEach(() => {
    hooks.values = [];
    hooks.cursor = 0;
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("does not render when open is false", () => {
    const result = ShareNotesDialog({ captureId: "test-id", open: false, onClose: () => {} });
    expect(result).toBeNull();
  });

  it("renders sharing dialog structure with cards when state is loaded", () => {
    // Populate hook state:
    // 0: state, 1: loading, 2: submitting, 3: error, 4: email, 5: displayTitle, 6: includeTranscript,
    // 7: selectedInsightIds, 8: readyInsights, 9: hasTranscript, 10: expiryDays, 11: linkUrl, 12: alreadyIssued
    hooks.values[0] = {
      ...fixtureSharingState,
      capabilities: {
        publicLinksEnabled: true,
        recipientGrantsEnabled: true,
        invitationsEnabled: true,
        maxExpiryDays: 30,
      },
    };
    hooks.cursor = 0;
    const result = ShareNotesDialog({ captureId: "test-id", open: true, onClose: () => {} });
    expect(result).not.toBeNull();
    const all = elements(result);
    const text = all.map(e => typeof e.props.children === "string" ? e.props.children : "").join(" ");
    expect(all.some(e => e.props.title === "Choose what to share")).toBe(true);
    expect(all.some(e => e.props.title === "People with access")).toBe(true);
    expect(all.some(e => e.props.title === "Link visibility")).toBe(true);
  });

  it("displays policy alert when sharing is disabled by policy", () => {
    hooks.values[0] = {
      ...fixtureSharingState,
      capabilities: {
        publicLinksEnabled: false,
        recipientGrantsEnabled: false,
        invitationsEnabled: false,
        maxExpiryDays: null,
      },
    };
    hooks.cursor = 0;
    const result = ShareNotesDialog({ captureId: "test-id", open: true, onClose: () => {} });
    const all = elements(result);
    const alert = all.find(e => e.props.role === "alert");
    expect(alert).toBeDefined();
    expect(JSON.stringify(alert)).toContain("Sharing is turned off");
  });
});
