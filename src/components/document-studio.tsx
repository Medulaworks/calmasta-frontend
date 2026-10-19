"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import StarterKit from "@tiptap/starter-kit";
import { EditorContent, useEditor } from "@tiptap/react";
import {
  DocError,
  type DocumentView,
  type VersionItem,
  deleteDocument,
  getDocument,
  listVersions,
  regenerateDocument,
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
const EXTENSIONS = [StarterKit.configure({ underline: false, link: false, trailingNode: false, heading: { levels: [1, 2, 3] } })];

export function DocumentStudio({ id }: { id: string }) {
  const router = useRouter();
  const [doc, setDoc] = useState<DocumentView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [notice, setNotice] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<null | "rewrite" | "delete">(null);
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
      await navigator.clipboard.writeText(editor?.getText({ blockSeparator: "\n" }) ?? "");
      setNotice("Copied as plain text.");
    } catch {
      setNotice("Couldn't copy. Select the text and copy it manually.");
    }
  }

  function download() {
    const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(title || "Document")}</title></head><body>${editor?.getHTML() ?? ""}</body></html>`;
    const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(title || "document").replace(/[^A-Za-z0-9._ -]/g, "_").slice(0, 80)}.html`;
    a.click();
    URL.revokeObjectURL(url);
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
        <Link href="/library" className="text-sm text-muted hover:text-foreground">&larr; Library</Link>
        <p role="status" aria-live="polite" className={`text-xs ${saveState === "error" || saveState === "conflict" ? "text-red-700 dark:text-red-300" : "text-muted"}`}>
          {generating ? "Writing…" : SAVE_LABEL[saveState]}
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
        {doc.sourceTitle ? ` · from “${doc.sourceTitle}”` : doc.captureId ? "" : " · source recording deleted"}
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
              Writing your document…
            </div>
          )}
        </div>
      )}

      {!failedEmpty && (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" disabled={readOnly} onClick={() => void rewrite(false)} className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-surface disabled:opacity-50">Rewrite with AI</button>
          <button type="button" onClick={() => void copyText()} className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-surface">Copy text</button>
          <button type="button" onClick={download} className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-surface">Download .html</button>
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
