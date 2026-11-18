"use client";

import { CalendarDays, LayoutGrid, List, Loader2, Mic, Search, X } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { RowStatus, statusFor } from "@/components/dashboard/item-row";
import { useDisplayTitle } from "@/components/shell/use-display-title";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Highlight } from "@/components/ui/highlight";
import { CaptureTile } from "@/components/ui/platform-logo";
import { SkeletonRows } from "@/components/ui/skeleton";
import { type LibraryQuery, type LibraryResult, searchLibraryPage } from "@/lib/library-client";
import { timeAgo } from "@/lib/status";

const TYPES = [
  { id: "all", label: "All" },
  { id: "recording", label: "Recordings" },
  { id: "meeting", label: "Meetings" },
] as const;

const STATUSES = [
  { id: "all", label: "Any status" },
  { id: "ready", label: "Ready" },
  { id: "in_progress", label: "In progress" },
  { id: "attention", label: "Needs attention" },
] as const;

type Layout = "list" | "cards";
type View = { key: string; results: LibraryResult[]; nextCursor: string | null; error: string | null };

const control = "h-10 rounded-xl border border-border bg-background px-4 text-sm shadow-sm focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent-solid/20";

function urlFor(f: LibraryQuery, layout: Layout) {
  const p = new URLSearchParams();
  if (layout === "list") p.set("view", "list");
  if (f.q.trim()) p.set("q", f.q.trim());
  if (f.type !== "all") p.set("type", f.type);
  if (f.status !== "all") p.set("status", f.status);
  if (f.from) p.set("from", f.from);
  if (f.to) p.set("to", f.to);
  return `/dashboard/library${p.size ? `?${p}` : ""}`;
}

/**
 * My Folder: everything captured, searchable by title or by what was said. The search, the type and the status filters all apply as
 * you go (the search a moment after you stop typing), and the address bar holds the filters so a view can be shared or reloaded.
 */
export function TranscriptLibrary() {
  const params = useSearchParams();
  const router = useRouter();
  const titleOf = useDisplayTitle();
  const filters: LibraryQuery = {
    q: params.get("q") ?? "",
    type: params.get("type") ?? "all",
    status: params.get("status") ?? "all",
    from: params.get("from") ?? "",
    to: params.get("to") ?? "",
  };
  const layout: Layout = params.get("view") === "list" ? "list" : "cards";
  const key = JSON.stringify(filters);
  const filtered = filters.q.trim() !== "" || filters.type !== "all" || filters.status !== "all" || !!filters.from || !!filters.to;

  const [view, setView] = useState<View | null>(null);
  const [loadingMore, setLoadingMore] = useState<string | null>(null);
  const more = useRef<AbortController | null>(null);
  useEffect(() => {
    const ctrl = new AbortController();
    const query = JSON.parse(key) as LibraryQuery;
    searchLibraryPage(query, ctrl.signal).then(
      (page) => { if (!ctrl.signal.aborted) setView({ key, ...page, error: null }); },
      (error) => { if (!ctrl.signal.aborted) setView({ key, results: [], nextCursor: null, error: error instanceof Error ? error.message : "We couldn’t load your folder. Please try again." }); },
    );
    return () => { ctrl.abort(); more.current?.abort(); };
  }, [key]);
  // While a new search loads, the previous results stay on screen, dimmed, instead of flashing to a skeleton.
  const current = view?.key === key ? view : null;
  const shown = current ?? view;
  const stale = !current && !!view;

  async function loadMore() {
    if (!current?.nextCursor || loadingMore === key) return;
    more.current?.abort();
    const ctrl = new AbortController();
    more.current = ctrl;
    setLoadingMore(key);
    try {
      const page = await searchLibraryPage(filters, ctrl.signal, current.nextCursor);
      if (!ctrl.signal.aborted) setView((prev) => prev?.key === key ? { key, results: [...prev.results, ...page.results.filter((r) => !prev.results.some((old) => old.id === r.id))], nextCursor: page.nextCursor, error: null } : prev);
    } catch (error) {
      if (!ctrl.signal.aborted) setView((prev) => prev?.key === key ? { ...prev, error: error instanceof Error ? error.message : "We couldn’t load more. Please try again." } : prev);
    } finally {
      setLoadingMore((v) => (v === key ? null : v));
    }
  }

  const update = (patch: Partial<LibraryQuery>) => router.replace(urlFor({ ...filters, ...patch }, layout), { scroll: false });
  const setLayout = (l: Layout) => router.replace(urlFor(filters, l), { scroll: false });
  const reset = () => { setTyped(null); setDates(false); router.replace(urlFor({ q: "", type: "all", status: "all", from: "", to: "" }, layout), { scroll: false }); };

  // What is being typed right now (null = show the address bar's value). The address bar follows shortly after, so a keystroke is not a request.
  const [typed, setTyped] = useState<string | null>(null);
  useEffect(() => {
    if (typed === null || typed === filters.q) return;
    const t = setTimeout(() => { update({ q: typed }); setTyped(null); }, 300);
    return () => clearTimeout(t);
  });
  const [dates, setDates] = useState(!!filters.from || !!filters.to);

  const count = shown?.results.length ?? 0;
  return (
    <div className="space-y-4">
      <form role="search" aria-label="Search your folder" onSubmit={(e) => e.preventDefault()} className="space-y-3">
        <div className="flex flex-col gap-3 md:flex-row">
          <label className="relative block flex-1">
            <span className="sr-only">Search titles and transcripts</span>
            <Search aria-hidden className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <input type="search" value={typed ?? filters.q} onChange={(e) => setTyped(e.target.value)} maxLength={200} placeholder="Search titles and what was said" className={`${control} w-full pl-11 placeholder:text-muted`} />
          </label>
          <label className="block">
            <span className="sr-only">Status</span>
            <select value={filters.status} onChange={(e) => update({ status: e.target.value })} className={`${control} w-full md:w-auto`}>
              {STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </label>
          <Button type="button" variant="secondary" aria-expanded={dates} aria-controls="date-range" onClick={() => setDates((v) => !v)} className="h-10 !min-h-10">
            <CalendarDays aria-hidden className="size-4" /> Dates{filters.from || filters.to ? " · on" : ""}
          </Button>
        </div>
        {dates && (
          <div id="date-range" className="jb-pop-soft flex flex-wrap items-center gap-3 text-sm text-muted">
            <label className="flex items-center gap-2">From <input type="date" value={filters.from} max={filters.to || undefined} onChange={(e) => update({ from: e.target.value })} className={control} /></label>
            <label className="flex items-center gap-2">To <input type="date" value={filters.to} min={filters.from || undefined} onChange={(e) => update({ to: e.target.value })} className={control} /></label>
          </div>
        )}
      </form>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Type" className="inline-flex rounded-xl bg-surface p-1 ring-1 ring-border">
          {TYPES.map((t) => (
            <button key={t.id} type="button" aria-pressed={filters.type === t.id} onClick={() => update({ type: t.id })} className={`h-9 rounded-lg px-4 text-sm font-medium transition-colors ${filters.type === t.id ? "bg-background text-foreground shadow-sm ring-1 ring-border" : "text-muted hover:text-foreground"}`}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 text-sm text-muted">
          <span role="status" aria-live="polite" className="tabular-nums">{shown && !stale ? `${count}${shown.nextCursor ? "+" : ""} ${count === 1 ? "item" : "items"}` : ""}</span>
          <div role="group" aria-label="Layout" className="inline-flex rounded-xl bg-surface p-1 ring-1 ring-border">
            {([["list", List, "List view"], ["cards", LayoutGrid, "Card view"]] as const).map(([id, Icon, label]) => (
              <button key={id} type="button" aria-pressed={layout === id} aria-label={label} title={label} onClick={() => setLayout(id)} className={`grid size-9 place-items-center rounded-lg transition-colors ${layout === id ? "bg-background text-foreground shadow-sm ring-1 ring-border" : "text-muted hover:text-foreground"}`}>
                <Icon aria-hidden className="size-4" />
              </button>
            ))}
          </div>
          {filtered && (
            <button type="button" onClick={reset} className="inline-flex h-9 items-center gap-1 rounded-lg px-3 font-medium hover:bg-surface hover:text-foreground">
              <X aria-hidden className="size-4" /> Clear all
            </button>
          )}
        </div>
      </div>

      {shown?.error && <p role="alert" className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">{shown.error}</p>}

      <div className={`transition-opacity duration-200 ${stale ? "opacity-60" : ""}`}>
        {!shown ? (
          layout === "cards" ? (
            <div role="status" aria-label="Loading your folder" aria-busy="true" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="h-48 jb-skel rounded-2xl border border-border bg-surface" />)}
            </div>
          ) : (
            <Card><SkeletonRows count={5} label="Loading your folder" /></Card>
          )
        ) : shown.results.length === 0 ? (
          <Card>
            {shown.error ? (
              <p className="p-5 text-sm text-muted">Your folder could not be loaded just now.</p>
            ) : filtered ? (
              <EmptyState
                icon={<Search className="size-5" />}
                title="No matches"
                body={filters.q.trim() ? `Nothing matches “${filters.q.trim()}” with these filters. Try fewer words, or clear the filters.` : "Nothing matches these filters."}
                action={<Button variant="secondary" onClick={reset}>Clear all</Button>}
              />
            ) : (
              <EmptyState icon={<Mic className="size-5" />} title="Your folder is empty" body="Record your voice, upload audio or send Joobah to a meeting. Everything you make is kept here." action={<ButtonLink href="/dashboard/voice" variant="primary">Start recording</ButtonLink>} />
            )}
          </Card>
        ) : layout === "cards" ? (
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {shown.results.map((r) => (
              <li key={r.id}>
                <Link href={`/dashboard/library/recordings/${r.id}`} className="group flex h-full flex-col rounded-2xl border border-border bg-background p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
                  <span className="flex items-start justify-between gap-3">
                    <CaptureTile kind={r.kind === "meeting" ? "meeting" : "recording"} hint={r.title} />
                    <RowStatus status={statusFor(r)} />
                  </span>
                  <span className="mt-4 line-clamp-2 text-base font-medium"><Highlight text={titleOf(r)} query={filters.q} /></span>
                  <span className="mt-2 line-clamp-3 flex-1 text-sm text-muted">
                    {r.snippet ? <Highlight text={r.snippet} query={filters.q} /> : r.kind === "meeting" ? "Open to read the transcript and summary." : "Open to read the transcript."}
                  </span>
                  <span className="mt-4 flex items-center justify-between border-t border-border pt-3 text-xs text-muted">
                    <span>{r.kind === "meeting" ? "Meeting" : "Recording"}</span>
                    <span>{timeAgo(r.at)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <Card>
            <ul className="divide-y divide-border">
              {shown.results.map((r) => (
                <li key={r.id}>
                  <Link href={`/dashboard/library/recordings/${r.id}`} className="group flex items-start gap-4 px-5 py-3 transition-colors hover:bg-surface">
                    <CaptureTile kind={r.kind === "meeting" ? "meeting" : "recording"} hint={r.title} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium"><Highlight text={titleOf(r)} query={filters.q} /></span>
                      <span className="block truncate text-xs text-muted">{r.kind === "meeting" ? "Meeting" : "Recording"} · {timeAgo(r.at)}</span>
                      {r.snippet && <span className="mt-2 line-clamp-2 text-sm text-muted"><Highlight text={r.snippet} query={filters.q} /></span>}
                    </span>
                    <RowStatus status={statusFor(r)} />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>

      {current?.nextCursor && (
        <div className="flex justify-center">
          <Button variant="secondary" size="lg" disabled={loadingMore === key} onClick={() => void loadMore()}>
            {loadingMore === key && <Loader2 aria-hidden className="size-4 animate-spin motion-reduce:animate-none" />}
            {loadingMore === key ? "Loading…" : "Load more"}
          </Button>
        </div>
      )}
    </div>
  );
}
