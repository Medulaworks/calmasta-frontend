"use client";
import { useResource, ResourceBoundary } from "@/components/admin/ui";
import { Card, CardHeader } from "@/components/ui/card";
import { fmtUtc } from "@/lib/admin-client";
import type { PublicNotes } from "@/lib/sharing-types";

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
          <div className="prose prose-sm max-w-none p-5 whitespace-pre-wrap break-words">{n.content}</div>
        </Card>
      ))}
      {data.transcript && (
        <Card><CardHeader title="Transcript" />
          <div className="p-5 whitespace-pre-wrap text-sm">{data.transcript.text}</div>
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
