"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import StarterKit from "@tiptap/starter-kit";
import { EditorContent, useEditor } from "@tiptap/react";
import { type DocNode, docToMarkdown, docToText, exportFileName } from "@/lib/export";
import { countUncertain } from "@/lib/uncertainty";
import { UncertaintyHighlight } from "./uncertainty-highlight";
import {
  DocError,
  type DocumentView,
  type VersionItem,
  deleteDocument,
  getDocument,
  listVersions,
  regenerateDocument,
  regenerateSection,
  restoreVersion,
  saveDocument,
  templateLabel,
} from "@/lib/documents-client";
import { EditorToolbar } from "./editor-toolbar";

type SaveState = "saved" | "dirty" | "saving" | "error" | "conflict";

const SAVE_LABEL: Record<SaveState, string> = {
  saved: "Saved",
  dirty: "Unsaved changes",
  saving: "Saving…",
  error: "Couldn't save — retrying when you type",
  conflict: "Changed elsewhere",
};

const ORIGIN_LABEL: Record<VersionItem["origin"], string> = {
  ai_generated: "AI draft",
  user_edit: "Your edits",
  ai_regenerated_section: "AI rewrite",
};

// Only formats the server keeps are offered; the sanitiser would silently drop anything else.
const EXTENSIONS = [StarterKit.configure({ underline: false, link: false, trailingNode: false, heading: { levels: [1, 2, 3] } }), UncertaintyHighlight];

function readOutline(e: { getJSON: () => unknown; getText: () => string }) {
  const seen = new Map<string, number>();
  const sections: Array<{ heading: string; occurrence: number }> = [];
  for (const n of ((e.getJSON() as DocNode).content ?? [])) {
    if (n.type !== "heading" || Number(n.attrs?.level) !== 2) continue;
    const heading = (n.content ?? []).map((c) => c.text ?? "").join("").trim();
    if (!heading) continue;
    const key = heading.toLowerCase();
    const occurrence = seen.get(key) ?? 0;
    seen.set(key, occurrence + 1);
    sections.push({ heading, occurrence });
  }
  return { sections, uncertain: countUncertain(e.getText()) };
}

export function DocumentStudio({ id }: { id: string }) {
  const router = useRouter();
  const [doc, setDoc] = useState<DocumentView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [notice, setNotice] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<null | "rewrite" | "delete" | { section: string; occurrence: number }>(null);
  // The document's outline and how many places say "Not specified", kept current as the user types.
  const [outline, setOutline] = useState<{ sections: Array<{ heading: string; occurrence: number }>; uncertain: number }>({ sections: [], uncertain: 0 });
  const [versions, setVersions] = useState<VersionItem[] | null>(null);
  const [title, setTitle] = useState("");

  // Autosave bookkeeping lives in refs so the debounce timer never sees stale state.
  const baseVersion = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef<Promise<void> | null>(null);
  const pending = useRef<{ html?: string; title?: string }>({});
  const locked = useRef(false);
  // The editor's own serialisation of the content the server already has. An update event whose HTML
  // matches this is not a user edit (loading, toggling read-only, normalisation) and must never be saved.
  const knownHtml = useRef<string | null>(null);
  const idRef = useRef(id);

  const generating = doc?.status === "generating";
  const readOnly = generating || saveState === "conflict";
  locked.current = readOnly;

  const editor = useEditor({
    extensions: EXTENSIONS,
    content: "",
    immediatelyRender: false, // Next renders on the server first
    editorProps: { attributes: { class: "prose-doc min-h-[24rem] px-4 py-3 focus:outline-none", "aria-label": "Document" } },
    onUpdate: ({ editor: e }) => {
      setOutline(readOutline(e));
      if (locked.current) return;
      const html = e.getHTML();
      if (html === knownHtml.current) {
        delete pending.current.html; // edited back to what is already saved
        return;
      }
      pending.current.html = html;
      schedule();
    },
  });

  const flush = useCallback(async (): Promise<void> => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    // Wait for an in-flight save, then send whatever accumulated meanwhile.
    while (inFlight.current) await inFlight.current;
    const body = pending.current;
    if (body.html === undefined && body.title === undefined) return;
    pending.current = {};
    setSaveState("saving");
    const run = (async () => {
      try {
        const res = await saveDocument(idRef.current, { baseVersion: baseVersion.current, contentHtml: body.html, title: body.title });
        baseVersion.current = res.version;
        if (body.html !== undefined) knownHtml.current = body.html;
        setSaveState(pending.current.html !== undefined || pending.current.title !== undefined ? "dirty" : "saved");
      } catch (err) {
        // Keep the unsent edits so nothing the user typed is lost.
        pending.current = { html: pending.current.html ?? body.html, title: pending.current.title ?? body.title };
        if (err instanceof DocError && err.code === "conflict") {
          setSaveState("conflict");
          setNotice(err.message);
        } else if (err instanceof DocError && err.code === "generating") {
          setSaveState("dirty");
        } else {
          setSaveState("error");
          if (err instanceof DocError && err.status === 401) setNotice(err.message);
        }
      }
    })();
    inFlight.current = run;
    await run;
    inFlight.current = null;
    if (pending.current.html !== undefined || pending.current.title !== undefined) {
      if (saveStateRef.current !== "conflict" && saveStateRef.current !== "error") schedule();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveStateRef = useRef<SaveState>("saved");
  saveStateRef.current = saveState;

  function schedule() {
    setSaveState((s) => (s === "conflict" ? s : "dirty"));
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), 1200);
  }

  // Load, and poll while the document is being written.
  const loadOnce = useCallback(async () => {
    try {
      const d = await getDocument(idRef.current);
      setDoc(d);
      baseVersion.current = d.version;
      return d;
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Could not load this document.");
      return null;
    }
  }, []);

  useEffect(() => {
    void loadOnce();
  }, [loadOnce]);

  useEffect(() => {
    if (!generating) return;
    const t = setInterval(() => void loadOnce(), 1500);
    return () => clearInterval(t);
  }, [generating, loadOnce]);

  // Put server content into the editor whenever a new server version arrives (load, rewrite, restore).
  const shownVersion = useRef<number | null>(null);
  useEffect(() => {
    if (!editor || !doc || doc.status === "generating") return;
    if (shownVersion.current === doc.version && editor.getHTML() !== "<p></p>") return;
    shownVersion.current = doc.version;
    editor.commands.setContent(doc.contentHtml, { emitUpdate: false });
    knownHtml.current = editor.getHTML();
    setOutline(readOutline(editor));
    setTitle(doc.title);
  }, [editor, doc]);

  useEffect(() => {
    editor?.setEditable(!readOnly, false); // false: don't emit an update event
  }, [editor, readOnly]);

  // Don't lose typing if the tab is closed mid-save.
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (saveStateRef.current === "dirty" || saveStateRef.current === "saving" || saveStateRef.current === "error") e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  function onTitle(v: string) {
    setTitle(v);
    pending.current.title = v;
    schedule();
  }

  async function reload() {
    pending.current = {};
    shownVersion.current = null;
    setSaveState("saved");
    setNotice(null);
    await loadOnce();
  }

  async function rewrite(overwrite: boolean) {
    setNotice(null);
    await flush(); // include anything just typed, so it lands in history rather than being lost
    try {
      await regenerateDocument(id, overwrite);
      setConfirm(null);
      setVersions(null);
      await loadOnce();
    } catch (err) {
      if (err instanceof DocError && err.code === "has_edits") setConfirm("rewrite");
      else setNotice(err instanceof Error ? err.message : "Could not start the rewrite.");
    }
  }

  async function rewriteOneSection(section: { section: string; occurrence: number }, overwrite: boolean) {
    setNotice(null);
    await flush(); // what was just typed is saved first, so the rewrite works from the real current version
    try {
      await regenerateSection(id, { heading: section.section, occurrence: section.occurrence, baseVersion: baseVersion.current, overwrite });
      setConfirm(null);
      await loadOnce();
    } catch (err) {
      if (err instanceof DocError && err.code === "section_has_edits") setConfirm(section);
      else {
        setConfirm(null);
        setNotice(err instanceof Error ? err.message : "Could not start the rewrite.");
      }
    }
  }

  async function toggleVersions() {
    if (versions) return setVersions(null);
    try {
      setVersions(await listVersions(id));
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not load history.");
    }
  }

  async function restore(v: number) {
    setNotice(null);
    await flush();
    try {
      await restoreVersion(id, v);
      shownVersion.current = null;
      await loadOnce();
      setVersions(await listVersions(id));
      setNotice("Restored. The version you replaced is in history too.");
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not restore.");
    }
  }

  async function remove() {
    try {
      pending.current = {};
      await deleteDocument(id);
      router.push("/library");
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not delete.");
    }
  }

  async function copyText() {
    try {
      await navigator.clipboard.writeText(editor ? docToText(editor.getJSON() as DocNode) : "");
      setNotice("Copied as plain text.");
    } catch {
      setNotice("Couldn't copy. Select the text and copy it manually.");
    }
  }

  function saveFile(content: string, name: string, type: string) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }
  // Export stays in the browser: the user's own text goes to their own file, and nothing is shared or uploaded.
  function exportAs(kind: "md" | "txt") {
    if (!editor) return;
    const json = editor.getJSON() as DocNode;
    if (kind === "md") saveFile(docToMarkdown(json), exportFileName(title || "document", "md"), "text/markdown;charset=utf-8");
    else saveFile(docToText(json), exportFileName(title || "document", "txt"), "text/plain;charset=utf-8");
    setNotice(kind === "md" ? "Downloaded as Markdown." : "Downloaded as a text file.");
  }

  if (loadError) {
    return (
      <div className="max-w-2xl space-y-3">
        <p role="alert" className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">{loadError}</p>
        <Link href="/library" className="text-sm text-accent">Back to Library</Link>
      </div>
    );
  }
  if (!doc) return <p className="text-sm text-muted">Loading…</p>;

  const failedEmpty = doc.status === "failed";

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="flex flex-wrap items-center gap-x-3 text-sm">
          {doc.captureId ? (
            <Link href={`/captures/${doc.captureId}?tab=documents`} className="text-muted hover:text-foreground">&larr; Back to conversation</Link>
          ) : (
            <span className="text-muted">Source recording deleted</span>
          )}
          <Link href="/library" className="text-muted hover:text-foreground">Library</Link>
        </p>
        <p role="status" aria-live="polite" className={`text-xs ${saveState === "error" || saveState === "conflict" ? "text-red-700 dark:text-red-300" : "text-muted"}`}>
          {generating ? (doc.rewritingSection ? "Rewriting a section…" : "Writing…") : SAVE_LABEL[saveState]}
        </p>
      </div>

      <input
        value={title}
        onChange={(e) => onTitle(e.target.value)}
        disabled={readOnly || failedEmpty}
        maxLength={200}
        placeholder="Untitled"
        aria-label="Title"
        className="w-full bg-transparent text-2xl font-semibold tracking-tight outline-none placeholder:text-muted"
      />
      <p className="text-xs text-muted">
        {templateLabel(doc.template)}
        {doc.sourceTitle ? ` · from “${doc.sourceTitle}”` : ""}
        {doc.provider === "mock" && " · development draft (no AI used)"}
      </p>

      {notice && (
        <p role="status" className="rounded-md border border-border bg-surface px-3 py-2 text-sm">
          {notice}
          {saveState === "conflict" && (
            <button type="button" onClick={() => void reload()} className="ml-2 underline">Reload</button>
          )}
        </p>
      )}
      {doc.failureReason && (
        <p role="alert" className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {doc.failureReason}
        </p>
      )}

      {failedEmpty ? (
        <div className="rounded-lg border border-border p-5 text-sm">
          <p>This document couldn&rsquo;t be written.</p>
          <button type="button" onClick={() => void rewrite(false)} className="mt-3 rounded-md bg-accent-solid px-4 py-2 font-medium text-white">Try again</button>
        </div>
      ) : (
        <div className="relative rounded-lg border border-border">
          {editor && <EditorToolbar editor={editor} disabled={readOnly} />}
          <EditorContent editor={editor} />
          {generating && (
            <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-background/70 text-sm" role="status">
              {doc.rewritingSection ? `Rewriting “${doc.rewritingSection}”…` : "Writing your document…"}
            </div>
          )}
        </div>
      )}

      {!failedEmpty && outline.uncertain > 0 && (
        <p className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
          {outline.uncertain} {outline.uncertain === 1 ? "place is" : "places are"} marked <span className="font-medium">not specified</span> or to confirm. CalMasta leaves a gap rather than guess an owner, date or number: fill them in, or check them against the conversation.
        </p>
      )}

      {!failedEmpty && (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" disabled={readOnly} onClick={() => void rewrite(false)} className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-surface disabled:opacity-50">Rewrite with AI</button>
          {outline.sections.length > 0 && (
            <label className="inline-flex items-center">
              <span className="sr-only">Rewrite one section</span>
              <select
                value=""
                disabled={readOnly}
                onChange={(e) => {
                  const picked = outline.sections[Number(e.target.value)];
                  if (picked) void rewriteOneSection({ section: picked.heading, occurrence: picked.occurrence }, false);
                }}
                className="rounded-md border border-border bg-background px-3 py-1.5 text-sm hover:bg-surface disabled:opacity-50"
              >
                <option value="">Rewrite a section…</option>
                {outline.sections.map((sec, i) => <option key={i} value={i}>{sec.heading}</option>)}
              </select>
            </label>
          )}
          <details className="relative">
            <summary className="cursor-pointer list-none rounded-md border border-border px-3 py-1.5 text-sm hover:bg-surface">Export ▾</summary>
            <div className="absolute left-0 z-10 mt-1 w-56 rounded-lg border border-border bg-background p-1 text-sm shadow-lg">
              <button type="button" onClick={(e) => { void copyText(); e.currentTarget.closest("details")?.removeAttribute("open"); }} className="block w-full rounded-md px-3 py-2 text-left hover:bg-surface">Copy as text</button>
              <button type="button" onClick={(e) => { exportAs("md"); e.currentTarget.closest("details")?.removeAttribute("open"); }} className="block w-full rounded-md px-3 py-2 text-left hover:bg-surface">Download Markdown (.md)</button>
              <button type="button" onClick={(e) => { exportAs("txt"); e.currentTarget.closest("details")?.removeAttribute("open"); }} className="block w-full rounded-md px-3 py-2 text-left hover:bg-surface">Download text (.txt)</button>
              <p className="px-3 py-2 text-xs text-muted">Private: saved to your device only. Nothing is shared.</p>
            </div>
          </details>
          <button type="button" onClick={() => void toggleVersions()} className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-surface">{versions ? "Hide history" : "History"}</button>
          <button type="button" onClick={() => setConfirm("delete")} className="ml-auto rounded-md px-3 py-1.5 text-sm text-red-700 hover:bg-surface dark:text-red-300">Delete</button>
        </div>
      )}

      {confirm === "rewrite" && (
        <div role="alertdialog" aria-label="Confirm rewrite" className="rounded-lg border border-border bg-surface p-4 text-sm">
          <p className="font-medium">Replace your edits with a new AI draft?</p>
          <p className="mt-1 text-muted">Your current version is kept in History, so you can restore it.</p>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={() => void rewrite(true)} className="rounded-md bg-accent-solid px-3 py-1.5 font-medium text-white">Replace with new draft</button>
            <button type="button" onClick={() => setConfirm(null)} className="rounded-md px-3 py-1.5 text-muted hover:text-foreground">Keep my edits</button>
          </div>
        </div>
      )}
      {typeof confirm === "object" && confirm !== null && (
        <div role="alertdialog" aria-label="Confirm section rewrite" className="rounded-lg border border-border bg-surface p-4 text-sm">
          <p className="font-medium">Replace your edits to “{confirm.section}”?</p>
          <p className="mt-1 text-muted">Only this section is rewritten; the rest of the document is not touched. Your current version is kept in History, so you can restore it.</p>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={() => void rewriteOneSection(confirm, true)} className="rounded-md bg-accent-solid px-3 py-1.5 font-medium text-white">Rewrite this section</button>
            <button type="button" onClick={() => setConfirm(null)} className="rounded-md px-3 py-1.5 text-muted hover:text-foreground">Keep my edits</button>
          </div>
        </div>
      )}
      {confirm === "delete" && (
        <div role="alertdialog" aria-label="Confirm delete" className="rounded-lg border border-border bg-surface p-4 text-sm">
          <p className="font-medium">Delete this document?</p>
          <p className="mt-1 text-muted">This also deletes its history. The recording and transcript are not affected.</p>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={() => void remove()} className="rounded-md bg-red-600 px-3 py-1.5 font-medium text-white">Delete document</button>
            <button type="button" onClick={() => setConfirm(null)} className="rounded-md px-3 py-1.5 text-muted hover:text-foreground">Cancel</button>
          </div>
        </div>
      )}

      {versions && (
        <section aria-label="Version history" className="rounded-lg border border-border p-4 text-sm">
          <h2 className="font-medium">History</h2>
          {versions.length === 0 ? (
            <p className="mt-1 text-muted">Nothing here yet. A version is saved whenever your content is about to be replaced.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {versions.map((v) => (
                <li key={v.version} className="flex items-center justify-between gap-3">
                  <span>{ORIGIN_LABEL[v.origin]} <span className="text-xs text-muted">· {new Date(v.createdAt).toLocaleString()}</span></span>
                  <button type="button" disabled={readOnly} onClick={() => void restore(v.version)} className="rounded-md border border-border px-2.5 py-1 text-xs hover:bg-background disabled:opacity-50">Restore</button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
