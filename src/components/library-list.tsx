"use client";
import { SkeletonRows } from "@/components/ui/skeleton";

import { dashboardPath } from "@/lib/app-routes";

import { useQuery } from "@tanstack/react-query";
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
import { templateLabel } from "@/lib/documents-client";
import { captureStatus, documentStatus, timeAgo } from "@/lib/status";
import { EMPTY_QUERY, type LibraryQuery, type LibraryResult, isSearching } from "@/lib/library-client";
import { capturesQuery, documentsQuery, libraryQuery } from "@/lib/queries";

type Tab = "documents" | "recordings";

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

  const tooShort = filters.q.trim().length === 1;
  const {
    data: searchPage,
    error: searchErr,
  } = useQuery({
    ...libraryQuery(filters),
    enabled: isSearching(filters) && !tooShort,
  });
  const results: LibraryResult[] | null = !isSearching(filters) || tooShort ? [] : searchPage ? searchPage.results : null;
  const searchError = searchErr ? (searchErr instanceof Error ? searchErr.message : "Could not search your library.") : null;

  const {
    data: docsRaw,
    error: docsErr,
    isLoading: docsLoading,
  } = useQuery({
    ...documentsQuery,
    enabled: !searching,
  });
  const {
    data: capsRaw,
    error: capsErr,
    isLoading: capsLoading,
  } = useQuery({
    ...capturesQuery(50),
    enabled: !searching,
  });
  const docs = !searching ? (docsRaw ?? (docsLoading ? null : [])) : null;
  const caps = !searching ? (capsRaw ?? (capsLoading ? null : [])) : null;
  const errorRaw = docsErr ?? capsErr;
  const error = errorRaw ? (errorRaw instanceof Error ? errorRaw.message : "Could not load your library.") : null;

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
            <SkeletonRows count={5} label="Loading your library" />
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
            <SkeletonRows count={5} label="Loading your library" />
          ) : docs.length === 0 ? (
            <EmptyState icon={<FileText className="h-5 w-5" />} title="No documents yet" body="Open a recording and choose a template to write your first document." action={<ButtonLink href="/dashboard/voice" variant="primary">Record a thought</ButtonLink>} />
          ) : (
            <ul className="divide-y divide-border" role="tabpanel" id={tabPanelId("documents")} aria-labelledby={tabId("documents")}>
              {docs.map((d: import("@/lib/documents-client").DocumentListItem) => {
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
          <SkeletonRows count={5} label="Loading your library" />
        ) : caps.length === 0 ? (
          <EmptyState icon={<Mic className="h-5 w-5" />} title="No recordings yet" body="Record a thought, upload audio or capture a meeting." action={<ButtonLink href="/dashboard/voice" variant="primary">Record a thought</ButtonLink>} />
        ) : (
          <ul className="divide-y divide-border" role="tabpanel" id={tabPanelId("recordings")} aria-labelledby={tabId("recordings")}>
            {caps.map((c: import("@/lib/upload-client").CaptureListItem) => {
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
