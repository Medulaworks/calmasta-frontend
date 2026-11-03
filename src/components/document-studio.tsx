"use client";

import {
  Check,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  History,
  Loader2,
  Sparkles,
  Trash2,
} from "lucide-react";
import { NAV } from "@/lib/nav-labels";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import StarterKit from "@tiptap/starter-kit";
import { EditorContent, useEditor } from "@tiptap/react";
import {
  type DocNode,
  docToMarkdown,
  docToText,
  exportFileName,
} from "@/lib/export";
import { countUncertain } from "@/lib/uncertainty";
import { UncertaintyHighlight } from "./uncertainty-highlight";
import { DocError, type VersionItem, templateLabel } from "@/lib/documents-client";
import { documentQuery, documentVersionsQuery } from "@/lib/queries";
import { useDeleteDocumentM, useRegenerateDocument, useRegenerateSection, useRestoreVersion } from "@/lib/mutations";
import { saveDocument } from "@/lib/documents-client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDismiss } from "@/components/ui/use-dismiss";
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
const EXTENSIONS = [
  StarterKit.configure({
    underline: false,
    link: false,
    trailingNode: false,
    heading: { levels: [1, 2, 3] },
  }),
  UncertaintyHighlight,
];

function readOutline(e: { getJSON: () => unknown; getText: () => string }) {
  const seen = new Map<string, number>();
  const sections: Array<{ heading: string; occurrence: number }> = [];
  for (const n of (e.getJSON() as DocNode).content ?? []) {
    if (n.type !== "heading" || Number(n.attrs?.level) !== 2) continue;
    const heading = (n.content ?? [])
      .map((c) => c.text ?? "")
      .join("")
      .trim();
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
  const qc = useQueryClient();
  const docQ = useQuery({
    ...documentQuery(id),
    refetchInterval: (q) => (q.state.data?.status === "generating" ? 1500 : false),
  });
  const doc = docQ.data ?? null;
  const loadError = docQ.error ? (docQ.error as Error).message : null;
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [notice, setNotice] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<
    null | "rewrite" | "delete" | { section: string; occurrence: number }
  >(null);
  // The document's outline and how many places say "Not specified", kept current as the user types.
  const [outline, setOutline] = useState<{
    sections: Array<{ heading: string; occurrence: number }>;
    uncertain: number;
  }>({ sections: [], uncertain: 0 });
  const [versionsOpen, setVersionsOpen] = useState(false);
  const versionsQ = useQuery({ ...documentVersionsQuery(id), enabled: versionsOpen });
  const versions = versionsOpen ? (versionsQ.data ?? null) : null;
  const setVersions = (v: VersionItem[] | null) => {
    if (v === null) setVersionsOpen(false);
    else qc.setQueryData(["document", id, "versions"], v);
  };
  const [title, setTitle] = useState("");

  // Autosave bookkeeping lives in refs so the debounce timer never sees stale state.
  const baseVersion = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const regenM = useRegenerateDocument();
  const regenSectionM = useRegenerateSection();
  const restoreM = useRestoreVersion();
  const deleteM = useDeleteDocumentM();
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
    editorProps: {
      attributes: {
        class: "prose-doc min-h-[28rem] px-6 py-5 focus:outline-none",
        "aria-label": "Document",
      },
    },
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
        const res = await saveDocument(idRef.current, {
          baseVersion: baseVersion.current,
          contentHtml: body.html,
          title: body.title,
        });
        baseVersion.current = res.version;
        if (body.html !== undefined) knownHtml.current = body.html;
        setSaveState(
          pending.current.html !== undefined ||
            pending.current.title !== undefined
            ? "dirty"
            : "saved",
        );
      } catch (err) {
        // Keep the unsent edits so nothing the user typed is lost.
        pending.current = {
          html: pending.current.html ?? body.html,
          title: pending.current.title ?? body.title,
        };
        if (err instanceof DocError && err.code === "conflict") {
          setSaveState("conflict");
          setNotice(err.message);
        } else if (err instanceof DocError && err.code === "generating") {
          setSaveState("dirty");
        } else {
          setSaveState("error");
          if (err instanceof DocError && err.status === 401)
            setNotice(err.message);
        }
      }
    })();
    inFlight.current = run;
    await run;
    inFlight.current = null;
    if (
      pending.current.html !== undefined ||
      pending.current.title !== undefined
    ) {
      if (
        saveStateRef.current !== "conflict" &&
        saveStateRef.current !== "error"
      )
        schedule();
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

  // Keep baseVersion in sync with server
  useEffect(() => {
    if (doc) baseVersion.current = doc.version;
  }, [doc?.version]);

  // Put server content into the editor whenever a new server version arrives (load, rewrite, restore).
  const shownVersion = useRef<number | null>(null);
  useEffect(() => {
    if (!editor || !doc || doc.status === "generating") return;
    if (shownVersion.current === doc.version && editor.getHTML() !== "<p></p>")
      return;
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
      if (
        saveStateRef.current === "dirty" ||
        saveStateRef.current === "saving" ||
        saveStateRef.current === "error"
      )
        e.preventDefault();
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
    await qc.invalidateQueries({ queryKey: ["document", id] });
  }

  async function rewrite(overwrite: boolean) {
    setNotice(null);
    await flush();
    try {
      await regenM.mutateAsync({ id, overwrite });
      setConfirm(null);
      setVersionsOpen(false);
      await qc.invalidateQueries({ queryKey: ["document", id] });
    } catch (err) {
      if (err instanceof DocError && (err as DocError).code === "has_edits") setConfirm("rewrite");
      else setNotice(err instanceof Error ? err.message : "Could not start the rewrite.");
    }
  }

  async function rewriteOneSection(section: { section: string; occurrence: number }, overwrite: boolean) {
    setNotice(null);
    await flush();
    try {
      await regenSectionM.mutateAsync({ id, input: { heading: section.section, occurrence: section.occurrence, baseVersion: baseVersion.current, overwrite } });
      setConfirm(null);
      await qc.invalidateQueries({ queryKey: ["document", id] });
    } catch (err) {
      if (err instanceof DocError && (err as DocError).code === "section_has_edits") setConfirm(section);
      else {
        setConfirm(null);
        setNotice(err instanceof Error ? err.message : "Could not start the rewrite.");
      }
    }
  }

  async function toggleVersions() {
    if (versionsOpen) return setVersionsOpen(false);
    setVersionsOpen(true);
    // error handled via query error
    if (versionsQ.error) setNotice((versionsQ.error as Error).message);
  }

  async function restore(v: number) {
    setNotice(null);
    await flush();
    try {
      await restoreM.mutateAsync({ id, version: v });
      shownVersion.current = null;
      await qc.invalidateQueries({ queryKey: ["document", id] });
      await qc.invalidateQueries({ queryKey: ["document", id, "versions"] });
      setNotice("Restored. The version you replaced is in history too.");
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not restore.");
    }
  }

  async function remove() {
    try {
      pending.current = {};
      await deleteM.mutateAsync(id);
      router.push("/dashboard/library");
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not delete.");
    }
  }

  async function copyText() {
    try {
      await navigator.clipboard.writeText(
        editor ? docToText(editor.getJSON() as DocNode) : "",
      );
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
    if (kind === "md")
      saveFile(
        docToMarkdown(json),
        exportFileName(title || "document", "md"),
        "text/markdown;charset=utf-8",
      );
    else
      saveFile(
        docToText(json),
        exportFileName(title || "document", "txt"),
        "text/plain;charset=utf-8",
      );
    setNotice(
      kind === "md" ? "Downloaded as Markdown." : "Downloaded as a text file.",
    );
  }

  if (loadError) {
    return (
      <div className="max-w-2xl space-y-3">
        <p
          role="alert"
          className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {loadError}
        </p>
        <button
          type="button"
          onClick={() => {
            if (typeof window !== "undefined" && window.history.length > 1) router.back();
            else router.push("/dashboard/library");
          }}
          className="text-sm text-accent">
          Go back
        </button>
      </div>
    );
  }
  if (!doc) {
    return (
      <div
        role="status"
        aria-label="Loading document"
        className="max-w-4xl space-y-4"
        aria-busy="true">
        <div className="h-4 w-40 jb-skel rounded bg-border" />
        <div className="h-8 w-2/3 jb-skel rounded bg-border" />
        <div className="h-96 jb-skel rounded-xl border border-border bg-surface" />
      </div>
    );
  }

  const failedEmpty = doc.status === "failed";
  const saveTone =
    saveState === "error" || saveState === "conflict"
      ? "text-danger"
      : "text-muted";
  const SaveIcon =
    generating || saveState === "saving"
      ? Loader2
      : saveState === "error" || saveState === "conflict"
        ? CircleAlert
        : Check;

  return (
    <div className="max-w-4xl space-y-5">
      <div className="flex items-center justify-between gap-3">
        <nav
          aria-label="Breadcrumb"
          className="flex min-w-0 items-center gap-1 text-sm text-muted">
          <Link href="/dashboard/library" className="hover:text-foreground">
            {NAV.folder}
          </Link>
          <ChevronRight aria-hidden className="h-3.5 w-3.5 shrink-0" />
          {doc.captureId ? (
            <Link
              href={`/dashboard/captures/${doc.captureId}?tab=documents`}
              className="truncate hover:text-foreground">
              {doc.sourceTitle ?? "Conversation"}
            </Link>
          ) : (
            <span className="truncate">Source recording deleted</span>
          )}
        </nav>
        <p
          role="status"
          aria-live="polite"
          className={`flex shrink-0 items-center gap-1.5 text-xs ${saveTone}`}>
          <SaveIcon
            aria-hidden
            className={`h-3.5 w-3.5 ${SaveIcon === Loader2 ? "animate-spin" : ""}`}
          />
          {generating
            ? doc.rewritingSection
              ? "Rewriting a section…"
              : "Writing…"
            : SAVE_LABEL[saveState]}
        </p>
      </div>

      <header className="space-y-2">
        <input
          value={title}
          onChange={(e) => onTitle(e.target.value)}
          disabled={readOnly || failedEmpty}
          maxLength={200}
          placeholder="Untitled"
          aria-label="Title"
          className="h-auto min-h-0 w-full border-0 bg-transparent p-0 text-2xl font-semibold tracking-tight placeholder:text-muted focus-visible:shadow-none"
        />
        <p className="flex flex-wrap items-center gap-2 text-xs text-muted">
          <Badge>{templateLabel(doc.template)}</Badge>
          {doc.sourceTitle && <span>From “{doc.sourceTitle}”</span>}
          {doc.provider === "mock" && (
            <span>Development draft (no AI used)</span>
          )}
        </p>
      </header>

      {notice && (
        <p
          role="status"
          className="rounded-lg border border-border bg-surface px-4 py-3 text-sm">
          {notice}
          {saveState === "conflict" && (
            <button
              type="button"
              onClick={() => void reload()}
              className="ml-2 underline">
              Reload
            </button>
          )}
        </p>
      )}
      {doc.failureReason && (
        <p
          role="alert"
          className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {doc.failureReason}
        </p>
      )}

      {!failedEmpty && (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            disabled={readOnly}
            onClick={() => void rewrite(false)}>
            <Sparkles aria-hidden className="h-3.5 w-3.5" /> Rewrite with AI
          </Button>
          {outline.sections.length > 0 && (
            <label className="inline-flex items-center">
              <span className="sr-only">Rewrite one section</span>
              <select
                value=""
                disabled={readOnly}
                onChange={(e) => {
                  const picked = outline.sections[Number(e.target.value)];
                  if (picked)
                    void rewriteOneSection(
                      {
                        section: picked.heading,
                        occurrence: picked.occurrence,
                      },
                      false,
                    );
                }}
                className="min-h-8 rounded-lg border border-border bg-background px-3 text-xs hover:bg-surface disabled:opacity-50">
                <option value="">Rewrite a section…</option>
                {outline.sections.map((sec, i) => (
                  <option key={i} value={i}>
                    {sec.heading}
                  </option>
                ))}
              </select>
            </label>
          )}
          <span className="ml-auto flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => void toggleVersions()}
              aria-expanded={!!versions}>
              <History aria-hidden className="h-3.5 w-3.5" />{" "}
              {versions ? "Hide history" : "History"}
            </Button>
            <ExportMenu
              onCopy={() => void copyText()}
              onMarkdown={() => exportAs("md")}
              onText={() => exportAs("txt")}
            />
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setConfirm("delete")}
              aria-label="Delete document"
              title="Delete document"
              className="px-2 text-muted hover:text-danger">
              <Trash2 aria-hidden className="h-4 w-4" />
            </Button>
          </span>
        </div>
      )}

      {failedEmpty ? (
        <div className="rounded-xl border border-border p-6 text-sm">
          <p>This document couldn&rsquo;t be written.</p>
          <Button
            variant="primary"
            onClick={() => void rewrite(false)}
            className="mt-3">
            Try again
          </Button>
        </div>
      ) : (
        <div className="relative overflow-hidden rounded-xl border border-border bg-background">
          {editor && <EditorToolbar editor={editor} disabled={readOnly} />}
          <EditorContent editor={editor} />
          {generating && (
            <div
              className="absolute inset-0 flex items-center justify-center gap-2 bg-background/70 text-sm"
              role="status">
              <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
              {doc.rewritingSection
                ? `Rewriting “${doc.rewritingSection}”…`
                : "Writing your document…"}
            </div>
          )}
        </div>
      )}

      {!failedEmpty && outline.uncertain > 0 && (
        <p className="rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
          {outline.uncertain}{" "}
          {outline.uncertain === 1 ? "place is" : "places are"} marked{" "}
          <span className="font-medium">not specified</span> or to confirm.
          Jooba leaves a gap rather than guess an owner, date or number: fill
          them in, or check them against the conversation.
        </p>
      )}

      {confirm === "rewrite" && (
        <div
          role="alertdialog"
          aria-label="Confirm rewrite"
          className="rounded-xl border border-border bg-surface p-5 text-sm">
          <p className="font-medium">Replace your edits with a new AI draft?</p>
          <p className="mt-1 text-muted">
            Your current version is kept in History, so you can restore it.
          </p>
          <div className="mt-4 flex gap-2">
            <Button variant="primary" onClick={() => void rewrite(true)}>
              Replace with new draft
            </Button>
            <Button variant="ghost" onClick={() => setConfirm(null)}>
              Keep my edits
            </Button>
          </div>
        </div>
      )}
      {typeof confirm === "object" && confirm !== null && (
        <div
          role="alertdialog"
          aria-label="Confirm section rewrite"
          className="rounded-xl border border-border bg-surface p-5 text-sm">
          <p className="font-medium">
            Replace your edits to “{confirm.section}”?
          </p>
          <p className="mt-1 text-muted">
            Only this section is rewritten; the rest of the document is not
            touched. Your current version is kept in History, so you can restore
            it.
          </p>
          <div className="mt-4 flex gap-2">
            <Button
              variant="primary"
              onClick={() => void rewriteOneSection(confirm, true)}>
              Rewrite this section
            </Button>
            <Button variant="ghost" onClick={() => setConfirm(null)}>
              Keep my edits
            </Button>
          </div>
        </div>
      )}
      {confirm === "delete" && (
        <div
          role="alertdialog"
          aria-label="Confirm delete"
          className="rounded-xl border border-border bg-surface p-5 text-sm">
          <p className="font-medium">Delete this document?</p>
          <p className="mt-1 text-muted">
            This also deletes its history. The recording and transcript are not
            affected.
          </p>
          <div className="mt-4 flex gap-2">
            <Button variant="danger" onClick={() => void remove()}>
              Delete document
            </Button>
            <Button variant="ghost" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {versions && (
        <section
          aria-label="Version history"
          className="rounded-xl border border-border text-sm">
          <h2 className="border-b border-border px-5 py-3 font-medium">
            History
          </h2>
          {versions.length === 0 ? (
            <p className="px-5 py-4 text-muted">
              Nothing here yet. A version is saved whenever your content is
              about to be replaced.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {versions.map((v: VersionItem) => (
                <li
                  key={v.version}
                  className="flex items-center justify-between gap-3 px-5 py-3">
                  <span>
                    {ORIGIN_LABEL[v.origin]}{" "}
                    <span className="text-xs text-muted">
                      · {new Date(v.createdAt).toLocaleString()}
                    </span>
                  </span>
                  <Button
                    size="sm"
                    disabled={readOnly}
                    onClick={() => void restore(v.version)}>
                    Restore
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

/** Export stays in the browser: the user's own text goes to their own file. */
function ExportMenu({
  onCopy,
  onMarkdown,
  onText,
}: {
  onCopy: () => void;
  onMarkdown: () => void;
  onText: () => void;
}) {
  const [open, setOpen] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, close, panel, trigger);
  const item =
    "flex min-h-9 w-full items-center rounded-lg px-3 text-left text-sm transition-colors hover:bg-surface focus-visible:bg-surface";
  const pick = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };
  return (
    <div className="relative">
      <Button
        ref={trigger}
        size="sm"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}>
        Export{" "}
        <ChevronDown
          aria-hidden
          className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </Button>
      {open && (
        <div
          ref={panel}
          role="menu"
          aria-label="Export"
          className="absolute right-0 top-full z-20 mt-2 w-60 rounded-xl border border-border bg-background p-1 shadow-lg">
          <button
            type="button"
            role="menuitem"
            onClick={pick(onCopy)}
            className={item}>
            Copy as text
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={pick(onMarkdown)}
            className={item}>
            Download Markdown (.md)
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={pick(onText)}
            className={item}>
            Download text (.txt)
          </button>
          <p className="border-t border-border px-3 py-2 text-xs text-muted">
            Private: saved to your device only. Nothing is shared.
          </p>
        </div>
      )}
    </div>
  );
}
