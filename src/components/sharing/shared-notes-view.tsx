"use client";
import { useResource, ResourceBoundary } from "@/components/admin/ui";
import { Card, CardHeader } from "@/components/ui/card";
import { fmtUtc } from "@/lib/admin-client";
import type { PublicNotes } from "@/lib/sharing-types";

function formatLabel(key: string) {
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (c) => c.toUpperCase());
}

function renderValue(value: unknown, keyPrefix = "node"): React.ReactNode {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{String(value)}</p>;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return null;
    if (value.every((item) => typeof item === "string" || typeof item === "number")) {
      return (
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {value.map((item, idx) => (
            <li key={`${keyPrefix}-${idx}`} className="whitespace-pre-wrap break-words">{String(item)}</li>
          ))}
        </ul>
      );
    }
    return (
      <div className="space-y-3">
        {value.map((item, idx) => (
          <div key={`${keyPrefix}-${idx}`}>{renderValue(item, `${keyPrefix}-${idx}`)}</div>
        ))}
      </div>
    );
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if ("question" in obj || "answer" in obj || "response" in obj) {
      const q = obj.question ? String(obj.question) : null;
      const a = obj.answer ?? obj.response ?? obj.text ?? obj.content;
      return (
        <div className="rounded-md border border-border/60 bg-muted/20 p-3 space-y-1">
          {q && <p className="text-sm font-medium">{q}</p>}
          {a !== undefined && a !== null && <div className="text-sm text-muted-foreground">{renderValue(a, `${keyPrefix}-qa`)}</div>}
        </div>
      );
    }
    if ("heading" in obj || "title" in obj) {
      const heading = String(obj.heading ?? obj.title);
      const rest = Object.entries(obj).filter(([k]) => k !== "heading" && k !== "title" && k !== "formatVersion");
      return (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">{heading}</h3>
          {rest.map(([k, v]) => (
            <div key={`${keyPrefix}-${k}`}>{renderValue(v, `${keyPrefix}-${k}`)}</div>
          ))}
        </div>
      );
    }
    const entries = Object.entries(obj).filter(([k, v]) => k !== "formatVersion" && v !== null && v !== undefined && (!Array.isArray(v) || v.length > 0));
    if (entries.length === 0) return null;
    return (
      <div className="space-y-4">
        {entries.map(([k, v]) => (
          <div key={`${keyPrefix}-${k}`} className="space-y-1.5">
            {entries.length > 1 && <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">{formatLabel(k)}</h4>}
            {renderValue(v, `${keyPrefix}-${k}`)}
          </div>
        ))}
      </div>
    );
  }
  return null;
}

function NotesRenderer({ data }: { data: PublicNotes }) {
  return (
    <div className="mx-auto max-w-3xl space-y-5 p-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">{data.title ?? "Shared notes"}</h1>
        <p className="text-sm text-muted">Shared {fmtUtc(data.publishedAt)} · version {data.publicationVersion}</p>
        <p className="text-xs text-muted">View only. Later edits you make to the notes aren’t shared automatically.</p>
      </header>
      {data.notes.map((n, i) => (
        <Card key={i}><CardHeader title={n.templateLabel || n.kind} />
          <div className="p-5">{renderValue(n.content, `note-${i}`) ?? <p className="text-sm text-muted">No content.</p>}</div>
        </Card>
      ))}
      {data.transcript && (
        <Card><CardHeader title="Transcript" />
          <div className="p-5 whitespace-pre-wrap text-sm">{data.transcript.text}</div>
        </Card>
      )}
      {data.media?.video && (
        <Card><CardHeader title="Video" />
          <div className="space-y-2 p-5"><video src={data.media.video.url} controls className="w-full rounded-lg" /><a href={data.media.video.url} download className="text-sm text-accent underline underline-offset-4">Download video</a></div>
        </Card>
      )}
      {data.media?.audio && (
        <Card><CardHeader title="Audio" />
          <div className="space-y-2 p-5"><audio src={data.media.audio.url} controls className="w-full" /><a href={data.media.audio.url} download className="text-sm text-accent underline underline-offset-4">Download audio</a></div>
        </Card>
      )}
      {data.notes.length === 0 && !data.transcript && <p className="text-sm text-muted">No notes were shared here.</p>}
    </div>
  );
}

export function PublicSharedView({ token }: { token: string }) {
  const res = useResource<PublicNotes>(`/api/public/notes/${encodeURIComponent(token)}`);
  if (res.error) {
    return <div className="mx-auto max-w-xl p-10 text-center"><h1 className="text-lg font-semibold">Not found</h1><p className="mt-2 text-sm text-muted">This link isn’t valid. It may have been turned off or expired.</p></div>;
  }
  return (
    <ResourceBoundary resource={res}>
      {(d: PublicNotes) => <NotesRenderer data={d} />}
    </ResourceBoundary>
  );
}

export function RecipientSharedView({ grantId }: { grantId: string }) {
  const res = useResource<PublicNotes>(`/api/shared-notes/${encodeURIComponent(grantId)}`);
  if (res.error) {
    return <div className="mx-auto max-w-xl p-10 text-center"><h1 className="text-lg font-semibold">Access denied</h1><p className="mt-2 text-sm text-muted">This account can’t view these notes. Try signing in with a different account.</p></div>;
  }
  return (
    <ResourceBoundary resource={res}>
      {(d: PublicNotes) => <NotesRenderer data={d} />}
    </ResourceBoundary>
  );
}
