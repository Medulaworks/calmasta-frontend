"use client";

import { dashboardPath } from "@/lib/app-routes";

import { FileText, Mic, Search, Video, X } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Highlight } from "@/components/ui/highlight";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, tabId, tabPanelId } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { type DocumentListItem, listDocuments, templateLabel } from "@/lib/documents-client";
import { captureStatus, documentStatus, timeAgo } from "@/lib/status";
import { EMPTY_QUERY, type LibraryQuery, type LibraryResult, isSearching, searchLibrary } from "@/lib/library-client";
import { type CaptureListItem, listCaptures } from "@/lib/upload-client";

type Tab = "documents" | "recordings";

function Skeleton() {
  return (
    <ul className="divide-y divide-border" aria-hidden>
      {[0, 1, 2, 3].map((i) => (
        <li key={i} className="flex items-center gap-3 px-5 py-3">
          <span className="h-9 w-9 animate-pulse rounded-lg bg-border" />
          <span className="flex-1 space-y-2">
            <span className="block h-3 w-1/2 animate-pulse rounded bg-border" />
            <span className="block h-2.5 w-1/4 animate-pulse rounded bg-border" />
          </span>
        </li>
      ))}
    </ul>
  );
}

const TYPE_OPTIONS = [["all", "Everything"], ["documents", "Documents"], ["recordings", "Recordings"], ["meetings", "Meetings"]] as const;
const STATUS_OPTIONS = [["all", "Any status"], ["ready", "Ready"], ["in_progress", "In progress"], ["attention", "Needs attention"]] as const;

function queryFrom(p: URLSearchParams): LibraryQuery {
  const pick = (key: string, allowed: readonly (readonly [string, string])[], fallback: string) => (allowed.some(([v]) => v === p.get(key)) ? (p.get(key) as string) : fallback);
  return { q: p.get("q") ?? "", type: pick("type", TYPE_OPTIONS, "all"), status: pick("status", STATUS_OPTIONS, "all"), from: p.get("from") ?? "", to: p.get("to") ?? "" };
}

function urlFor(f: LibraryQuery, tab: Tab) {
  const p = new URLSearchParams();
  if (tab === "recordings") p.set("tab", "recordings");
  if (f.q) p.set("q", f.q);
  if (f.type !== "all") p.set("type", f.type);
  if (f.status !== "all") p.set("status", f.status);
  if (f.from) p.set("from", f.from);
  if (f.to) p.set("to", f.to);
  const qs = p.toString();
  return qs ? `/dashboard/library?${qs}` : "/dashboard/library";
}

const KIND_LABEL = { document: "Document", recording: "Recording", meeting: "Meeting" } as const;

function ResultRow({ r, q }: { r: LibraryResult; q: string }) {
  const st = r.kind === "document" ? documentStatus({ status: r.status, failureReason: r.failureReason, editedByUser: r.editedByUser }) : captureStatus({ source: r.source ?? "", state: r.state ?? "", status: r.status });
  const Icon = r.kind === "document" ? FileText : r.kind === "meeting" ? Video : Mic;
  return (
    <li>
      <Link href={dashboardPath(r.href)} className="flex items-start gap-3 px-5 py-3 transition-colors hover:bg-surface">
        <span aria-hidden className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-surface text-muted"><Icon className="h-4 w-4" /></span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium"><Highlight text={r.title} query={q} /></span>
          <span className="block truncate text-xs text-muted">{KIND_LABEL[r.kind]} · {timeAgo(r.at)}</span>
          {r.snippet && <span className="mt-1 block text-sm text-muted"><Highlight text={r.snippet} query={q} /></span>}
        </span>
        <Badge tone={st.tone} active={st.active}>{st.label}</Badge>
      </Link>
    </li>
  );
}

export function LibraryList() {
  const router = useRouter();
  const params = useSearchParams();
  const tab: Tab = params.get("tab") === "recordings" ? "recordings" : "documents";
  const filters = queryFrom(new URLSearchParams(params.toString()));
  const searching = isSearching(filters);

  // `typed` is what is being typed right now (null = just show the address bar's value). The address bar follows a
  // moment later, so every keystroke is not a request.
  const [typed, setTyped] = useState<string | null>(null);
  const boxValue = typed ?? filters.q;
  useEffect(() => {
    if (typed === null || typed === filters.q) return;
    const t = setTimeout(() => {
      router.replace(urlFor({ ...filters, q: typed }, tab), { scroll: false });
      setTyped(null);
    }, 300);
    return () => clearTimeout(t);
  });
  const update = (patch: Partial<LibraryQuery>) => router.replace(urlFor({ ...filters, ...patch }, tab), { scroll: false });

  const [results, setResults] = useState<LibraryResult[] | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const tooShort = filters.q.trim().length === 1;
  const key = JSON.stringify(filters);
  useEffect(() => {
    if (!isSearching(filters) || tooShort) return;
    const ctrl = new AbortController();
    searchLibrary(filters, ctrl.signal).then(
      (r) => {
        setResults(r);
        setSearchError(null);
      },
      (err) => {
        if (ctrl.signal.aborted) return;
        setSearchError(err instanceof Error ? err.message : "Could not search your library.");
        setResults([]);
      },
    );
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const [docs, setDocs] = useState<DocumentListItem[] | null>(null);
  const [caps, setCaps] = useState<CaptureListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fail = (err: unknown) => {
      if (cancelled) return;
      setError(err instanceof Error ? err.message : "Could not load your library.");
      setDocs((d) => d ?? []);
      setCaps((c) => c ?? []);
    };
    listDocuments().then((d) => !cancelled && setDocs(d), fail);
    listCaptures(50).then((c) => !cancelled && setCaps(c), fail);
    return () => {
      cancelled = true;
    };
  }, []);

  const tabs: Array<{ id: Tab; label: string; count: number | null }> = [
    { id: "documents", label: "Documents", count: docs?.length ?? null },
    { id: "recordings", label: "Recordings", count: caps?.length ?? null },
  ];

  const control = "h-9 rounded-lg border border-border bg-background px-3 text-sm";
  const searchBar = (
    <form role="search" aria-label="Search your library" onSubmit={(e) => e.preventDefault()} className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="relative block flex-1">
          <span className="sr-only">Search</span>
          <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input type="search" value={boxValue} onChange={(e) => setTyped(e.target.value)} maxLength={100} placeholder="Search titles, transcripts and documents" className={`${control} w-full pl-9`} />
        </label>
        <label className="block">
          <span className="sr-only">Type</span>
          <select value={filters.type} onChange={(e) => update({ type: e.target.value })} className={`${control} w-full sm:w-auto`}>
            {TYPE_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="sr-only">Status</span>
          <select value={filters.status} onChange={(e) => update({ status: e.target.value })} className={`${control} w-full sm:w-auto`}>
            {STATUS_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-sm text-muted">
        <label className="flex items-center gap-2">From <input type="date" value={filters.from} max={filters.to || undefined} onChange={(e) => update({ from: e.target.value })} className={control} /></label>
        <label className="flex items-center gap-2">To <input type="date" value={filters.to} min={filters.from || undefined} onChange={(e) => update({ to: e.target.value })} className={control} /></label>
        {searching && (
          <button type="button" onClick={() => {
              setTyped(null);
              router.replace(urlFor(EMPTY_QUERY, tab), { scroll: false });
            }} className="inline-flex h-9 items-center gap-1 rounded-lg px-2 hover:bg-surface hover:text-foreground">
            <X aria-hidden className="h-4 w-4" /> Clear
          </button>
        )}
      </div>
      {tooShort && <p role="status" className="text-xs text-muted">Type at least 2 characters to search.</p>}
    </form>
  );

  if (searching) {
    const shown = tooShort ? [] : results;
    return (
      <div className="space-y-4">
        {searchBar}
        {searchError && <p role="alert" className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">{searchError}</p>}
        <p role="status" aria-live="polite" className="text-sm text-muted">
          {tooShort ? "" : shown === null ? "Searching…" : `${shown.length}${shown.length === 100 ? "+" : ""} ${shown.length === 1 ? "result" : "results"}`}
        </p>
        <Card>
          {shown === null ? (
            <Skeleton />
          ) : shown.length === 0 ? (
            <EmptyState
              icon={<Search className="h-5 w-5" />}
              title="No results"
              body={filters.q.trim() ? `Nothing in your library matches “${filters.q.trim()}” with these filters. Try fewer words, or clear the filters.` : "Nothing matches these filters."}
              action={<button type="button" onClick={() => router.replace("/dashboard/library", { scroll: false })} className="text-sm font-medium text-accent">Clear search and filters</button>}
            />
          ) : (
            <ul className="divide-y divide-border">{shown.map((r) => <ResultRow key={`${r.kind}-${r.id}`} r={r} q={filters.q} />)}</ul>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {searchBar}
      <Tabs
        label="Library"
        items={tabs.map((t) => ({ id: t.id, label: t.label, count: t.count ?? undefined }))}
        active={tab}
        onChange={(id) => router.replace(id === "documents" ? "/dashboard/library" : "/dashboard/library?tab=recordings")}
      />

      {error && <p role="alert" className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>}

      <Card>
        {tab === "documents" ? (
          docs === null ? (
            <Skeleton />
          ) : docs.length === 0 ? (
            <EmptyState icon={<FileText className="h-5 w-5" />} title="No documents yet" body="Open a recording and choose a template to write your first document." action={<ButtonLink href="/dashboard/voice" variant="primary">Record a thought</ButtonLink>} />
          ) : (
            <ul className="divide-y divide-border" role="tabpanel" id={tabPanelId("documents")} aria-labelledby={tabId("documents")}>
              {docs.map((d) => {
                const st = documentStatus({ status: d.status, failureReason: d.failureReason, editedByUser: d.editedByUser });
                return (
                  <li key={d.id}>
                    <Link href={`/dashboard/library/${d.id}`} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-surface">
                      <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-surface text-muted"><FileText className="h-4 w-4" /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{d.title}</span>
                        <span className="block truncate text-xs text-muted">{templateLabel(d.template)} · {timeAgo(d.updatedAt)}</span>
                      </span>
                      <Badge tone={st.tone} active={st.active}>{st.label}</Badge>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )
        ) : caps === null ? (
          <Skeleton />
        ) : caps.length === 0 ? (
          <EmptyState icon={<Mic className="h-5 w-5" />} title="No recordings yet" body="Record a thought, upload audio or capture a meeting." action={<ButtonLink href="/dashboard/voice" variant="primary">Record a thought</ButtonLink>} />
        ) : (
          <ul className="divide-y divide-border" role="tabpanel" id={tabPanelId("recordings")} aria-labelledby={tabId("recordings")}>
            {caps.map((c) => {
              const st = captureStatus({ source: c.source, state: c.state, status: c.status });
              const Icon = c.source === "meeting_url" ? Video : Mic;
              return (
                <li key={c.id}>
                  <Link href={`/dashboard/captures/${c.id}`} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-surface">
                    <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-surface text-muted"><Icon className="h-4 w-4" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{c.title}</span>
                      <span className="block truncate text-xs text-muted">{c.source === "meeting_url" ? "Meeting" : c.source === "voice_recording" ? "Recorded in browser" : "Upload"} · {timeAgo(c.createdAt)}</span>
                    </span>
                    <Badge tone={st.tone} active={st.active}>{st.label}</Badge>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
