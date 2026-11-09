"use client";

import { dashboardPath } from "@/lib/app-routes";

import { ArrowRight, CalendarCheck, CalendarDays, CornerDownLeft, FileText, Gauge, History, House, Library, Loader2, Mic, Search, Settings, Upload, User, Video, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Highlight } from "@/components/ui/highlight";
import { type LibraryResult, searchLibrary } from "@/lib/library-client";
import {
  type Command,
  type CommandIcon,
  COMMANDS,
  FILTERS,
  type PaletteFilter,
  RECENT_KEY,
  groupResults,
  isOpenShortcut,
  libraryUrl,
  matchCommands,
  parseRecent,
  pushRecent,
} from "@/lib/palette";
import { captureStatus, documentStatus, timeAgo } from "@/lib/status";

const COMMAND_ICON: Record<CommandIcon, typeof Mic> = {
  home: House,
  mic: Mic,
  video: Video,
  library: Library,
  calendar: CalendarDays,
  booking: CalendarCheck,
  plan: Gauge,
  settings: Settings,
  profile: User,
  upload: Upload,
};

const KIND_LABEL = { document: "Document", recording: "Recording", meeting: "Meeting" } as const;
const MIN_CHARS = 2;
const DEBOUNCE_MS = 200;
const noSubscribe = () => () => {};
const usesMac = () => /Mac|iPhone|iPad/.test(navigator.userAgent);

type Option =
  | { id: string; type: "recent"; label: string }
  | { id: string; type: "command"; command: Command }
  | { id: string; type: "result"; result: LibraryResult }
  | { id: string; type: "all"; label: string };

interface Section {
  id: string;
  label: string;
  options: Option[];
  action?: React.ReactNode;
}

const Kbd = ({ children }: { children: React.ReactNode }) => (
  <kbd className="rounded border border-border bg-surface px-2 py-px font-sans text-xs leading-4 text-muted">{children}</kbd>
);

/** Opens the search from the top bar. The palette itself is mounted only while open. */
export function HeaderSearch({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLElement | null>(null);
  const mac = useSyncExternalStore(noSubscribe, usesMac, () => true);

  const show = useCallback(() => {
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setOpen(true);
  }, []);
  const hide = useCallback(() => {
    setOpen(false);
    // Hand focus back to whatever had it, once the palette is gone.
    const o = opener.current;
    if (o && document.contains(o)) requestAnimationFrame(() => o.focus());
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!isOpenShortcut(e)) return;
      e.preventDefault();
      setOpen((was) => {
        if (!was) opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        return !was;
      });
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      {compact ? (
        <button type="button" onClick={show} aria-label="Search" aria-haspopup="dialog" className="grid size-10 place-items-center rounded-lg text-muted transition-colors hover:bg-surface hover:text-foreground">
          <Search aria-hidden className="h-5 w-5" />
        </button>
      ) : (
        <button
          type="button"
          onClick={show}
          aria-haspopup="dialog"
          aria-keyshortcuts="Control+K Meta+K"
          className="flex h-9 w-full max-w-md items-center gap-2 rounded-lg border border-border bg-surface px-3 text-left text-sm text-muted transition-colors hover:border-muted/50 hover:bg-background"
        >
          <Search aria-hidden className="h-4 w-4 shrink-0" />
          <span className="min-w-0 flex-1 truncate">Search or jump to…</span>
          <span aria-hidden className="flex shrink-0 items-center gap-1">
            <Kbd>{mac ? "⌘" : "Ctrl"}</Kbd>
            <Kbd>K</Kbd>
          </span>
        </button>
      )}
      {open && <Palette onClose={hide} />}
    </>
  );
}

function Palette({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const uid = useId();
  const listId = `${uid}-list`;
  const optionId = (id: string) => `${uid}-opt-${id}`;
  const box = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [filter, setFilter] = useState<PaletteFilter>("all");
  const [active, setActive] = useState(0);
  const [recents, setRecents] = useState<string[]>(() => {
    try {
      return parseRecent(localStorage.getItem(RECENT_KEY));
    } catch {
      return [];
    }
  });
  const [res, setRes] = useState<{ key: string; items: LibraryResult[]; error: string | null } | null>(null);
  const [retry, setRetry] = useState(0);

  const q = query.trim();
  const searchable = q.length >= MIN_CHARS;
  const dq = debounced.trim();
  const key = `${dq}|${filter}|${retry}`;

  // Wait for a pause in typing before asking the server.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  // Ask for the results of what was typed. A newer search cancels the older one, so a slow reply never overwrites a fast one.
  useEffect(() => {
    if (dq.length < MIN_CHARS) return;
    const ctrl = new AbortController();
    searchLibrary({ q: dq, type: filter, status: "all", from: "", to: "" }, ctrl.signal, 30).then(
      (items) => setRes({ key, items, error: null }),
      (err) => {
        if (!ctrl.signal.aborted) setRes({ key, items: [], error: err instanceof Error ? err.message : "Could not search your library." });
      },
    );
    return () => ctrl.abort();
  }, [dq, filter, key]);

  // Stop the page behind from scrolling while the palette is open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const settled = res?.key === key;
  const pending = searchable && (q !== dq || !settled);
  const items = useMemo(() => (searchable && res ? res.items : []), [searchable, res]);
  const error = searchable && settled ? res.error : null;

  const sections = useMemo<Section[]>(() => {
    const out: Section[] = [];
    if (!q) {
      if (recents.length > 0) out.push({ id: "recent", label: "Recent searches", options: recents.map((r, i) => ({ id: `recent-${i}`, type: "recent", label: r })) });
      out.push({ id: "actions", label: "Quick actions", options: COMMANDS.filter((c) => c.group === "action" && c.id !== "a-upload").map((c) => ({ id: c.id, type: "command", command: c })) });
      out.push({ id: "pages", label: "Go to", options: COMMANDS.filter((c) => c.group === "page" && c.id !== "p-capture").map((c) => ({ id: c.id, type: "command", command: c })) });
      return out;
    }
    const cmds = matchCommands(q);
    if (cmds.length > 0) out.push({ id: "jump", label: "Jump to", options: cmds.map((c) => ({ id: c.id, type: "command", command: c })) });
    if (searchable) {
      for (const g of groupResults(items)) out.push({ id: g.id, label: g.label, options: g.items.map((r) => ({ id: `${r.kind}-${r.id}`, type: "result", result: r })) });
      out.push({ id: "all", label: "", options: [{ id: "all", type: "all", label: filter === "all" ? `Search the Library for “${q}”` : `Search ${FILTERS.find((f) => f.id === filter)?.label.toLowerCase()} for “${q}”` }] });
    }
    return out;
  }, [q, searchable, items, recents, filter]);

  const flat = useMemo(() => sections.flatMap((s) => s.options), [sections]);
  const current = flat.length === 0 ? -1 : Math.min(active, flat.length - 1);
  const currentId = current >= 0 ? optionId(flat[current].id) : undefined;

  useEffect(() => {
    if (currentId) document.getElementById(currentId)?.scrollIntoView({ block: "nearest" });
  }, [currentId]);

  const remember = (text: string) => {
    const next = pushRecent(recents, text);
    setRecents(next);
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch {
      /* private mode or blocked storage: recent searches just aren't kept */
    }
  };
  const clearRecents = () => {
    setRecents([]);
    try {
      localStorage.removeItem(RECENT_KEY);
    } catch {
      /* nothing to clear */
    }
  };
  const go = (href: string, searched?: string) => {
    if (searched) remember(searched);
    onClose();
    router.push(dashboardPath(href));
  };
  const choose = (o: Option) => {
    if (o.type === "command") return go(o.command.href);
    if (o.type === "result") return go(o.result.href, q);
    if (o.type === "all") return go(libraryUrl(q, filter), q);
    // A recent search fills the box again, so it can be refined or run.
    setQuery(o.label);
    setDebounced(o.label);
    setActive(0);
  };

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      return onClose();
    }
    if (e.key === "Tab" && box.current) {
      const f = [...box.current.querySelectorAll<HTMLElement>("input, button:not([disabled])")];
      const i = f.indexOf(document.activeElement as HTMLElement);
      if (f.length > 0 && ((e.shiftKey && i <= 0) || (!e.shiftKey && i === f.length - 1))) {
        e.preventDefault();
        f[e.shiftKey ? f.length - 1 : 0].focus();
      }
      return;
    }
    if (e.target !== box.current?.querySelector("input")) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (flat.length === 0) return;
      setActive((e.key === "ArrowDown" ? current + 1 : current - 1 + flat.length) % flat.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if ((e.shiftKey || e.metaKey || e.ctrlKey) && searchable) return go(libraryUrl(q, filter), q);
      if (current >= 0) choose(flat[current]);
      else if (searchable) go(libraryUrl(q, filter), q);
    }
  }

  const status = !q ? "" : !searchable ? "Keep typing to search your library." : pending ? "Searching…" : error ? error : `${items.length} ${items.length === 1 ? "result" : "results"} in your library.`;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 pt-[8vh] backdrop-blur-[2px] sm:pt-[12vh]" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={box} role="dialog" aria-modal="true" aria-label="Search" onKeyDown={onKeyDown} className="flex max-h-[min(34rem,80vh)] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-sm text-foreground shadow-2xl">
        <div className="flex items-center gap-3 border-b border-border px-4">
          <Search aria-hidden className="h-5 w-5 shrink-0 text-muted" />
          <input
            autoFocus
            role="combobox"
            aria-expanded={flat.length > 0}
            aria-controls={listId}
            aria-activedescendant={currentId}
            aria-autocomplete="list"
            aria-label="Search your library, or jump to a page"
            type="text"
            value={query}
            maxLength={100}
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            placeholder="Search recordings, documents and action items…"
            className="h-12 min-w-0 flex-1 border-0 bg-transparent px-0 text-base placeholder:text-muted focus-visible:shadow-none"
          />
          {pending && <Loader2 aria-hidden className="h-4 w-4 shrink-0 animate-spin text-muted" />}
          {query && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => {
                setQuery("");
                setDebounced("");
                setActive(0);
                box.current?.querySelector("input")?.focus();
              }}
              className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-muted hover:bg-surface hover:text-foreground"
            >
              <X aria-hidden className="h-4 w-4" />
            </button>
          )}
          <button type="button" onClick={onClose} className="hidden shrink-0 sm:block" aria-label="Close search" tabIndex={-1}>
            <Kbd>esc</Kbd>
          </button>
        </div>

        {searchable && (
          <div role="group" aria-label="Narrow results to" className="flex gap-2 overflow-x-auto border-b border-border px-4 py-2">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                aria-pressed={filter === f.id}
                onClick={() => {
                  setFilter(f.id);
                  setActive(0);
                }}
                className={`h-6 shrink-0 rounded-md px-3 text-xs transition-colors ${filter === f.id ? "bg-accent/10 font-medium text-accent ring-1 ring-inset ring-accent/25" : "text-muted hover:bg-surface hover:text-foreground"}`}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}

        <div id={listId} role="listbox" aria-label="Results" className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
          {q && !searchable && sections.length === 0 && <p className="px-3 py-5 text-center text-sm text-muted">Keep typing to search your library.</p>}

          {error && (
            <div role="alert" className="mx-1 mb-2 flex items-center justify-between gap-3 rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
              <span>{error}</span>
              <button type="button" onClick={() => setRetry((n) => n + 1)} className="shrink-0 rounded-md px-2 py-1 text-xs font-medium underline underline-offset-2">Try again</button>
            </div>
          )}

          {searchable && pending && items.length === 0 && !error && (
            <ul aria-hidden className="space-y-1 px-1 pb-2">
              {[0, 1, 2].map((i) => <li key={i} className="flex items-center gap-3 rounded-lg px-2 py-2"><span className="h-7 w-7 jb-skel rounded-md bg-border" /><span className="h-3 w-2/5 jb-skel rounded bg-border" /></li>)}
            </ul>
          )}

          {searchable && !pending && !error && items.length === 0 && (
            <p className="px-3 pb-2 pt-3 text-center text-sm text-muted">
              Nothing in your library matches <span className="font-medium text-foreground">“{q}”</span>{filter !== "all" ? " in this type" : ""}.
            </p>
          )}

          {sections.map((s) => (
            <div key={s.id} role="group" aria-label={s.label || "More"} className={s.label ? "pb-1" : "mt-1 border-t border-border pt-1"}>
              {s.label && (
                <div className="flex items-center justify-between px-3 pb-1 pt-2">
                  <span className="text-xs font-medium text-muted">{s.label}</span>
                  {s.id === "recent" && (
                    <button type="button" onClick={clearRecents} className="text-xs text-muted hover:text-foreground">Clear</button>
                  )}
                </div>
              )}
              {s.options.map((o) => {
                const idx = flat.indexOf(o);
                const on = idx === current;
                return (
                  <div
                    key={o.id}
                    id={optionId(o.id)}
                    role="option"
                    aria-selected={on}
                    onMouseMove={() => idx !== current && setActive(idx)}
                    onClick={() => choose(o)}
                    className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 ${on ? "bg-surface" : ""}`}
                  >
                    <OptionBody o={o} q={q} />
                    {on && <CornerDownLeft aria-hidden className="hidden h-4 w-4 shrink-0 text-muted sm:block" />}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <div className="hidden items-center gap-4 border-t border-border bg-surface px-4 py-2 text-xs text-muted sm:flex">
          <span className="flex items-center gap-2"><Kbd>↑</Kbd><Kbd>↓</Kbd> navigate</span>
          <span className="flex items-center gap-2"><Kbd>↵</Kbd> open</span>
          {searchable && <span className="flex items-center gap-2"><Kbd>⇧ ↵</Kbd> all results</span>}
        </div>
        <p role="status" className="sr-only">{status}</p>
      </div>
    </div>
  );
}

function IconTile({ children }: { children: React.ReactNode }) {
  return <span aria-hidden className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-border bg-background text-muted [&>svg]:h-4 [&>svg]:w-4">{children}</span>;
}

function OptionBody({ o, q }: { o: Option; q: string }) {
  if (o.type === "recent") {
    return (
      <>
        <IconTile><History /></IconTile>
        <span className="min-w-0 flex-1 truncate text-sm">{o.label}</span>
      </>
    );
  }
  if (o.type === "all") {
    return (
      <>
        <IconTile><ArrowRight /></IconTile>
        <span className="min-w-0 flex-1 truncate text-sm">{o.label}</span>
      </>
    );
  }
  if (o.type === "command") {
    const Icon = COMMAND_ICON[o.command.icon];
    return (
      <>
        <IconTile><Icon /></IconTile>
        <span className="min-w-0 flex-1 truncate text-sm"><Highlight text={o.command.label} query={q} /></span>
        <span className="shrink-0 text-xs text-muted">{o.command.group === "action" ? "Action" : "Page"}</span>
      </>
    );
  }
  const r = o.result;
  const Icon = r.kind === "document" ? FileText : r.kind === "meeting" ? Video : Mic;
  const st = r.kind === "document" ? documentStatus({ status: r.status, failureReason: r.failureReason, editedByUser: r.editedByUser }) : captureStatus({ source: r.source ?? "", state: r.state ?? "", status: r.status });
  const notReady = st.label !== "Ready" && st.label !== "Edited";
  return (
    <>
      <IconTile><Icon /></IconTile>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-sm"><Highlight text={r.title} query={q} /></span>
          {notReady && <span className={`shrink-0 text-xs ${st.tone === "danger" ? "text-danger" : st.tone === "warning" ? "text-warning" : "text-muted"}`}>{st.label}</span>}
        </span>
        <span className="block truncate text-xs text-muted">{r.snippet ? <Highlight text={r.snippet} query={q} /> : KIND_LABEL[r.kind]}</span>
      </span>
      <span className="shrink-0 text-xs text-muted">{timeAgo(r.at)}</span>
    </>
  );
}
