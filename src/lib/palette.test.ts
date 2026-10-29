import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { LibraryResult } from "./library-client";
import { COMMANDS, groupResults, isOpenShortcut, libraryUrl, matchCommands, matchScore, parseRecent, pushRecent } from "./palette";

const result = (kind: LibraryResult["kind"], id: string): LibraryResult => ({ kind, id, title: id, href: `/x/${id}`, status: "ready", failureReason: null, at: "2026-10-23T10:00:00Z", snippet: null });

describe("matchScore", () => {
  it("ranks a start above a word start above a contains, and 0 for none", () => {
    expect(matchScore("Calendar", "cal")).toBe(3);
    expect(matchScore("Plan and usage", "usage")).toBe(2);
    expect(matchScore("Calendar", "lend")).toBe(1);
    expect(matchScore("Calendar", "zzz")).toBe(0);
  });
});

describe("matchCommands", () => {
  it("matches nothing for an empty or blank query", () => {
    expect(matchCommands("")).toEqual([]);
    expect(matchCommands("   ")).toEqual([]);
  });

  it("finds a page by its label, ignoring case and surrounding space", () => {
    expect(matchCommands("  CALEN ")[0].href).toBe("/dashboard/calendar");
  });

  it("finds a page by a keyword that isn't in its name", () => {
    expect(matchCommands("billing")[0].href).toBe("/dashboard/plan");
    expect(matchCommands("password")[0].href).toBe("/dashboard/profile");
  });

  it("puts a label match ahead of a keyword match", () => {
    // "record" is the start of the action "Record a thought" and only a keyword of "Capture a meeting".
    const found = matchCommands("record").map((c) => c.id);
    expect(found[0]).toBe("a-record");
    expect(found).toContain("a-capture");
  });

  it("returns at most the limit and never an unknown command", () => {
    expect(matchCommands("e", COMMANDS, 3).length).toBeLessThanOrEqual(3);
    expect(matchCommands("qqqqq")).toEqual([]);
  });

  it("only points at routes that exist in the app", () => {
    for (const c of COMMANDS) {
      expect(c.href).toMatch(/^\/dashboard(?:\/[a-z]+)?$/);
      expect(existsSync(`src/app/dashboard/(app)${c.href.slice("/dashboard".length)}/page.tsx`)).toBe(true);
    }
  });
});

describe("groupResults", () => {
  it("splits documents from recordings and meetings and drops empty groups", () => {
    const g = groupResults([result("document", "d1"), result("recording", "r1"), result("meeting", "m1")]);
    expect(g.map((x) => x.id)).toEqual(["documents", "conversations"]);
    expect(g[1].items.map((i) => i.id)).toEqual(["r1", "m1"]);
    expect(groupResults([result("document", "d1")]).map((x) => x.id)).toEqual(["documents"]);
    expect(groupResults([])).toEqual([]);
  });

  it("caps each group", () => {
    const many = Array.from({ length: 9 }, (_, i) => result("document", `d${i}`));
    expect(groupResults(many, 4)[0].items).toHaveLength(4);
  });
});

describe("libraryUrl", () => {
  it("carries the words and a type filter, encoded", () => {
    expect(libraryUrl("budget & plan")).toBe("/dashboard/library?q=budget+%26+plan");
    expect(libraryUrl("budget", "documents")).toBe("/dashboard/library?q=budget&type=documents");
    expect(libraryUrl("  ")).toBe("/dashboard/library");
  });
});

describe("recent searches", () => {
  it("puts the newest first, without repeats, up to five", () => {
    let l: string[] = [];
    for (const q of ["one", "two", "three", "four", "five", "six"]) l = pushRecent(l, q);
    expect(l).toEqual(["six", "five", "four", "three", "two"]);
    expect(pushRecent(l, "FOUR")).toEqual(["FOUR", "six", "five", "three", "two"]);
  });

  it("ignores empty and one-character searches", () => {
    expect(pushRecent(["abc"], " a ")).toEqual(["abc"]);
    expect(pushRecent([], "")).toEqual([]);
  });

  it("reads stored data defensively", () => {
    expect(parseRecent(null)).toEqual([]);
    expect(parseRecent("not json")).toEqual([]);
    expect(parseRecent('{"a":1}')).toEqual([]);
    expect(parseRecent('["ok", 5, "", "fine"]')).toEqual(["ok", "fine"]);
  });
});

describe("isOpenShortcut", () => {
  const key = (k: string, extra: Partial<{ metaKey: boolean; ctrlKey: boolean; altKey: boolean }> = {}, target: unknown = { tagName: "BODY" }) => ({ key: k, metaKey: false, ctrlKey: false, altKey: false, target: target as EventTarget, ...extra });
  it("opens on Cmd+K and Ctrl+K", () => {
    expect(isOpenShortcut(key("k", { metaKey: true }))).toBe(true);
    expect(isOpenShortcut(key("K", { ctrlKey: true }))).toBe(true);
    expect(isOpenShortcut(key("k"))).toBe(false);
  });
  it("opens on / only when not typing somewhere", () => {
    expect(isOpenShortcut(key("/"))).toBe(true);
    expect(isOpenShortcut(key("/", {}, { tagName: "INPUT" }))).toBe(false);
    expect(isOpenShortcut(key("/", {}, { tagName: "TEXTAREA" }))).toBe(false);
    expect(isOpenShortcut(key("/", {}, { tagName: "DIV", isContentEditable: true }))).toBe(false);
    expect(isOpenShortcut(key("/", { ctrlKey: true }))).toBe(false);
  });
});
