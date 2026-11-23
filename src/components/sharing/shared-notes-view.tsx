"use client";
import { CalendarDays, ChevronDown, Eye, FileText, Headphones, Video } from "lucide-react";
import Link from "next/link";
import { useResource, ResourceBoundary } from "@/components/admin/ui";
import { Brand } from "@/components/ui/brand";
import { buttonClass } from "@/components/ui/button";
import type { PublicNotes } from "@/lib/sharing-types";

function formatLabel(key: string) {
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/^./, (c) => c.toUpperCase());
}

/** "20 November 2026". Never a raw timestamp. */
function friendlyDate(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" }).format(d);
}

// Keys whose value is the content itself. They read as a paragraph or a list with no label, so a note isn't full of "TEXT" and "DETAILS".
const UNLABELLED = new Set(["text", "details", "summary", "content", "body", "description", "overview", "topics", "sections"]);

function Paragraph({ children }: { children: React.ReactNode }) {
  return <p className="whitespace-pre-wrap break-words text-[15px] leading-7 text-foreground/90">{children}</p>;
}

function renderValue(value: unknown, keyPrefix = "node"): React.ReactNode {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return <Paragraph>{String(value)}</Paragraph>;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return null;
    if (value.every((item) => typeof item === "string" || typeof item === "number")) {
      return (
        <ul className="space-y-2.5">
          {value.map((item, idx) => (
            <li key={`${keyPrefix}-${idx}`} className="flex gap-3 text-[15px] leading-7 text-foreground/90">
              <span aria-hidden className="mt-3 size-1.5 shrink-0 rounded-full bg-accent-solid" />
              <span className="min-w-0 whitespace-pre-wrap break-words">{String(item)}</span>
            </li>
          ))}
        </ul>
      );
    }
    return (
      <div className="space-y-6">
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
        <div className="space-y-2 rounded-xl border border-border bg-surface p-4">
          {q && <p className="text-sm font-semibold">{q}</p>}
          {a !== undefined && a !== null && <div className="text-sm text-muted">{renderValue(a, `${keyPrefix}-qa`)}</div>}
        </div>
      );
    }
    if ("heading" in obj || "title" in obj) {
      const heading = String(obj.heading ?? obj.title);
      const rest = Object.entries(obj).filter(([k]) => k !== "heading" && k !== "title" && k !== "formatVersion");
      return (
        <section className="space-y-3 border-l-2 border-accent-solid/70 pl-5">
          <h3 className="text-lg font-semibold tracking-tight">{heading}</h3>
          {rest.map(([k, v]) => (
            <div key={`${keyPrefix}-${k}`}>{renderValue(v, `${keyPrefix}-${k}`)}</div>
          ))}
        </section>
      );
    }
    const entries = Object.entries(obj).filter(([k, v]) => k !== "formatVersion" && v !== null && v !== undefined && (!Array.isArray(v) || v.length > 0));
    if (entries.length === 0) return null;
    return (
      <div className="space-y-4">
        {entries.map(([k, v]) => (
          <div key={`${keyPrefix}-${k}`} className="space-y-2">
            {!UNLABELLED.has(k.toLowerCase()) && <h4 className="text-xs font-semibold uppercase tracking-wider text-muted">{formatLabel(k)}</h4>}
            {renderValue(v, `${keyPrefix}-${k}`)}
          </div>
        ))}
      </div>
    );
  }
  return null;
}

/** A section of the page: a small icon and title, then the content on a clean card. */
function Block({ title, icon: Icon, children }: { title: string; icon?: typeof FileText; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-background shadow-sm">
      <h2 className="flex items-center gap-2.5 border-b border-border bg-surface/60 px-6 py-3.5 text-sm font-semibold">
        {Icon && <Icon aria-hidden className="size-4 text-accent" />}
        {title}
      </h2>
      <div className="p-6 sm:p-8">{children}</div>
    </section>
  );
}

/** The frame every shared-notes screen sits in: the Joobah header, a calm page, and a quiet footer. */
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <header className="border-b border-border bg-background px-4">
        <div className="mx-auto flex max-w-3xl items-center justify-between py-4">
          <Brand size={28} />
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-muted"><Eye aria-hidden className="size-3.5" /> View only</span>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:py-12">{children}</main>
      <footer className="border-t border-border bg-background px-4 py-6">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 text-sm text-muted">
          <span>Shared with Joobah</span>
          <Link href="/auth/register" className={buttonClass("secondary", "", "sm")}>Make your own meeting notes</Link>
        </div>
      </footer>
    </div>
  );
}

function Message({ title, text }: { title: string; text: string }) {
  return (
    <Shell>
      <div className="mx-auto max-w-md rounded-2xl border border-border bg-background p-8 text-center shadow-sm">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-muted">{text}</p>
      </div>
    </Shell>
  );
}

export function NotesRenderer({ data }: { data: PublicNotes }) {
  const shared = friendlyDate(data.publishedAt);
  return (
    <Shell>
      <div className="space-y-6">
        <header className="space-y-3 pb-2">
          <h1 className="break-words text-3xl font-semibold tracking-tight sm:text-4xl">{data.title ?? "Shared notes"}</h1>
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
            {shared && <span className="inline-flex items-center gap-1.5"><CalendarDays aria-hidden className="size-4" /> Shared {shared}</span>}
            <span>Version {data.publicationVersion}</span>
          </p>
          <p className="text-sm text-muted">This is a read-only copy. Changes made to the notes later aren’t shared automatically.</p>
        </header>

        {data.notes.map((n, i) => (
          <Block key={i} title={n.templateLabel || formatLabel(n.kind)} icon={FileText}>
            {renderValue(n.content, `note-${i}`) ?? <p className="text-sm text-muted">No content.</p>}
          </Block>
        ))}

        {data.transcript && (
          <section className="overflow-hidden rounded-2xl border border-border bg-background shadow-sm">
            <details className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 bg-surface/60 px-6 py-3.5 text-sm font-semibold marker:hidden [&::-webkit-details-marker]:hidden">
                <span className="flex items-center gap-2.5"><FileText aria-hidden className="size-4 text-accent" /> Transcript</span>
                <ChevronDown aria-hidden className="size-4 text-muted transition-transform group-open:rotate-180" />
              </summary>
              <div className="whitespace-pre-wrap break-words border-t border-border p-6 text-sm leading-7 text-foreground/90 sm:p-8">{data.transcript.text}</div>
            </details>
          </section>
        )}

        {data.media?.video && (
          <Block title="Video" icon={Video}>
            <div className="space-y-3">
              <video src={data.media.video.url} controls className="w-full rounded-xl bg-black" />
              <a href={data.media.video.url} download className="inline-block text-sm font-medium text-accent underline-offset-4 hover:underline">Download video</a>
            </div>
          </Block>
        )}
        {data.media?.audio && (
          <Block title="Audio" icon={Headphones}>
            <div className="space-y-3">
              <audio src={data.media.audio.url} controls className="w-full" />
              <a href={data.media.audio.url} download className="inline-block text-sm font-medium text-accent underline-offset-4 hover:underline">Download audio</a>
            </div>
          </Block>
        )}
        {data.notes.length === 0 && !data.transcript && (
          <div className="rounded-2xl border border-border bg-background p-8 text-center text-sm text-muted shadow-sm">No notes were shared here.</div>
        )}
      </div>
    </Shell>
  );
}

export function PublicSharedView({ token }: { token: string }) {
  const res = useResource<PublicNotes>(`/api/public/notes/${encodeURIComponent(token)}`);
  if (res.error) {
    return <Message title="This page isn’t available" text="The link may be wrong, switched off or expired. Ask the person who sent it for a new one." />;
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
    return <Message title="You don’t have access" text="This account can’t view these notes. Try signing in with the account the notes were shared with." />;
  }
  return (
    <ResourceBoundary resource={res}>
      {(d: PublicNotes) => <NotesRenderer data={d} />}
    </ResourceBoundary>
  );
}
