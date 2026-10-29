// The rules behind the header search (command palette): which pages and actions match what was typed, how library
// results are grouped, and how recent searches are remembered. Pure, so it is tested without a browser.

import type { LibraryResult } from "./library-client";

export type CommandIcon =
  | "home"
  | "mic"
  | "video"
  | "library"
  | "calendar"
  | "booking"
  | "plan"
  | "settings"
  | "profile"
  | "upload";

export interface Command {
  id: string;
  label: string;
  href: string;
  /** "Go to" for places, "Do" for things you start. */
  group: "page" | "action";
  icon: CommandIcon;
  /** Other words someone might type for it. */
  keywords: readonly string[];
}

export const COMMANDS: readonly Command[] = [
  {
    id: "a-record",
    label: "Record a thought",
    href: "/dashboard/voice",
    group: "action",
    icon: "mic",
    keywords: ["voice", "dictate", "note", "new"],
  },
  {
    id: "a-capture",
    label: "Capture a meeting",
    href: "/dashboard/capture",
    group: "action",
    icon: "video",
    keywords: ["bot", "assistant", "join", "record", "live", "new"],
  },
  {
    id: "a-upload",
    label: "Upload audio",
    href: "/dashboard/voice",
    group: "action",
    icon: "upload",
    keywords: ["file", "import", "mp3", "recording", "new"],
  },
  {
    id: "p-home",
    label: "Home",
    href: "/dashboard",
    group: "page",
    icon: "home",
    keywords: ["dashboard", "overview"],
  },
  {
    id: "p-capture",
    label: "Capture",
    href: "/dashboard/voice",
    group: "page",
    icon: "mic",
    keywords: ["voice inbox", "meeting bot"],
  },
  {
    id: "p-library",
    label: "Library",
    href: "/dashboard/library",
    group: "page",
    icon: "library",
    keywords: ["documents", "recordings", "transcripts"],
  },
  {
    id: "p-calendar",
    label: "Calendar",
    href: "/dashboard/calendar",
    group: "page",
    icon: "calendar",
    keywords: ["meetings", "schedule", "agenda", "upcoming"],
  },
  {
    id: "p-booking",
    label: "Booking",
    href: "/dashboard/booking",
    group: "page",
    icon: "booking",
    keywords: ["availability", "appointments", "scheduling page"],
  },
  {
    id: "p-plan",
    label: "Plan and usage",
    href: "/dashboard/plan",
    group: "page",
    icon: "plan",
    keywords: [
      "billing",
      "upgrade",
      "pro",
      "hours",
      "allowance",
      "subscription",
    ],
  },
  {
    id: "p-profile",
    label: "Your profile",
    href: "/dashboard/profile",
    group: "page",
    icon: "profile",
    keywords: ["photo", "name", "password", "account"],
  },
  {
    id: "p-settings",
    label: "Settings",
    href: "/dashboard/settings",
    group: "page",
    icon: "settings",
    keywords: [
      "theme",
      "appearance",
      "privacy",
      "calendars",
      "connections",
      "delete",
    ],
  },
];

/** How well `text` matches `q`: 3 starts with it, 2 a word in it starts with it, 1 contains it, 0 no match. */
export function matchScore(text: string, q: string): number {
  const t = text.toLowerCase();
  if (!q) return 0;
  if (t.startsWith(q)) return 3;
  if (t.split(/[\s/_-]+/).some((w) => w.startsWith(q))) return 2;
  return t.includes(q) ? 1 : 0;
}

/**
 * The pages and actions that match what was typed, best first, at most `limit`. Label matches beat keyword matches, and
 * ties keep the order above (actions before pages). An empty query matches nothing: the palette lists its own defaults.
 */
export function matchCommands(
  query: string,
  commands: readonly Command[] = COMMANDS,
  limit = 4,
): Command[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return commands
    .map((c, order) => {
      const label = matchScore(c.label, q);
      const keyword = Math.max(0, ...c.keywords.map((k) => matchScore(k, q)));
      return { c, order, score: label > 0 ? label * 10 : keyword };
    })
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .slice(0, limit)
    .map((m) => m.c);
}

export type PaletteFilter = "all" | "documents" | "recordings" | "meetings";
export const FILTERS: readonly { id: PaletteFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "documents", label: "Documents" },
  { id: "recordings", label: "Recordings" },
  { id: "meetings", label: "Meetings" },
];

export interface ResultGroup {
  id: "documents" | "conversations";
  label: string;
  items: LibraryResult[];
}

/** Library results in two groups, each newest first as the server returned them, each capped so the list stays short. */
export function groupResults(
  results: readonly LibraryResult[],
  perGroup = 4,
): ResultGroup[] {
  const docs = results.filter((r) => r.kind === "document");
  const convs = results.filter((r) => r.kind !== "document");
  const groups: ResultGroup[] = [
    { id: "documents", label: "Documents", items: docs.slice(0, perGroup) },
    {
      id: "conversations",
      label: "Recordings and meetings",
      items: convs.slice(0, perGroup),
    },
  ];
  return groups.filter((g) => g.items.length > 0);
}

/** Where "see all results" goes: the Library, with the same words and type filter. */
export function libraryUrl(
  query: string,
  filter: PaletteFilter = "all",
): string {
  const p = new URLSearchParams();
  const q = query.trim();
  if (q) p.set("q", q);
  if (filter !== "all") p.set("type", filter);
  const qs = p.toString();
  return qs ? `/dashboard/library?${qs}` : "/dashboard/library";
}

export const RECENT_KEY = "MyJooba-recent-searches";
export const MAX_RECENT = 5;

/** Puts a search at the front of the recent list: trimmed, no repeats (ignoring case), too-short ones ignored. */
export function pushRecent(list: readonly string[], query: string): string[] {
  const q = query.trim();
  if (q.length < 2) return [...list];
  return [q, ...list.filter((x) => x.toLowerCase() !== q.toLowerCase())].slice(
    0,
    MAX_RECENT,
  );
}

/** Reads the stored list defensively: anything that isn't an array of strings is ignored. */
export function parseRecent(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const v: unknown = JSON.parse(raw);
    return Array.isArray(v)
      ? v
          .filter(
            (x): x is string => typeof x === "string" && x.trim().length >= 2,
          )
          .slice(0, MAX_RECENT)
      : [];
  } catch {
    return [];
  }
}

/** True for the keys that open the palette from anywhere: Ctrl/Cmd+K, or "/" when typing isn't happening. */
export function isOpenShortcut(e: {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  target: EventTarget | null;
}): boolean {
  if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === "k")
    return true;
  if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return false;
  const t = e.target as {
    tagName?: string;
    isContentEditable?: boolean;
  } | null;
  const tag = t?.tagName?.toLowerCase();
  return !(
    tag === "input" ||
    tag === "textarea" ||
    tag === "select" ||
    t?.isContentEditable
  );
}
