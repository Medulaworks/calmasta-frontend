"use client";

import { FileText, Mic, Video } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { type DocumentListItem, listDocuments, templateLabel } from "@/lib/documents-client";
import { captureStatus, documentStatus, timeAgo } from "@/lib/status";
import { type CaptureListItem, listCaptures } from "@/lib/upload-client";

type Tab = "documents" | "recordings";

function Skeleton() {
  return (
    <ul className="divide-y divide-border" aria-hidden>
      {[0, 1, 2, 3].map((i) => (
        <li key={i} className="flex items-center gap-3 px-5 py-3.5">
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

export function LibraryList() {
  const router = useRouter();
  const tab: Tab = useSearchParams().get("tab") === "recordings" ? "recordings" : "documents";
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

  return (
    <div className="space-y-4">
      <div role="tablist" aria-label="Library" className="flex gap-1 border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={tab === t.id}
            onClick={() => router.replace(t.id === "documents" ? "/library" : "/library?tab=recordings")}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm transition-colors ${tab === t.id ? "border-accent font-medium text-foreground" : "border-transparent text-muted hover:text-foreground"}`}
          >
            {t.label}
            {t.count !== null && <span className="ml-2 rounded-full bg-surface px-2 py-0.5 text-xs text-muted">{t.count}</span>}
          </button>
        ))}
      </div>

      {error && <p role="alert" className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>}

      <Card>
        {tab === "documents" ? (
          docs === null ? (
            <Skeleton />
          ) : docs.length === 0 ? (
            <EmptyState icon={<FileText className="h-5 w-5" />} title="No documents yet" body="Open a recording and choose a template to write your first document." action={<ButtonLink href="/voice" variant="primary">Record a thought</ButtonLink>} />
          ) : (
            <ul className="divide-y divide-border" role="tabpanel">
              {docs.map((d) => {
                const st = documentStatus({ status: d.status, failureReason: d.failureReason });
                return (
                  <li key={d.id}>
                    <Link href={`/library/${d.id}`} className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-surface">
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
          <EmptyState icon={<Mic className="h-5 w-5" />} title="No recordings yet" body="Record a thought, upload audio or capture a meeting." action={<ButtonLink href="/voice" variant="primary">Record a thought</ButtonLink>} />
        ) : (
          <ul className="divide-y divide-border" role="tabpanel">
            {caps.map((c) => {
              const st = captureStatus({ source: c.source, state: c.state, status: c.status });
              const Icon = c.source === "meeting_url" ? Video : Mic;
              return (
                <li key={c.id}>
                  <Link href={`/captures/${c.id}`} className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-surface">
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
