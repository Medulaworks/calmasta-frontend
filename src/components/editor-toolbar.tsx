"use client";

import type { Editor } from "@tiptap/react";
import { useEditorState } from "@tiptap/react";
import { Bold, Heading1, Heading2, Italic, List, ListOrdered, Quote, Redo2, Strikethrough, Undo2 } from "lucide-react";

function Btn({ label, active, disabled, onClick, children }: { label: string; active?: boolean; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()} // keep the editor selection
      onClick={onClick}
      className={`grid h-8 w-8 place-items-center rounded-md transition-colors disabled:opacity-40 ${active ? "bg-accent/10 text-accent" : "text-muted hover:bg-surface hover:text-foreground"}`}
    >
      {children}
    </button>
  );
}

const Sep = () => <span aria-hidden className="mx-1 h-4 w-px bg-border" />;
const icon = "h-4 w-4";

export function EditorToolbar({ editor, disabled }: { editor: Editor; disabled: boolean }) {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      strike: e.isActive("strike"),
      h1: e.isActive("heading", { level: 1 }),
      h2: e.isActive("heading", { level: 2 }),
      bullet: e.isActive("bulletList"),
      ordered: e.isActive("orderedList"),
      quote: e.isActive("blockquote"),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });
  const c = () => editor.chain().focus();
  return (
    <div role="toolbar" aria-label="Formatting" className="flex flex-wrap items-center gap-0.5 border-b border-border bg-surface/60 px-2 py-1.5">
      <Btn label="Bold" active={s.bold} disabled={disabled} onClick={() => c().toggleBold().run()}><Bold className={icon} /></Btn>
      <Btn label="Italic" active={s.italic} disabled={disabled} onClick={() => c().toggleItalic().run()}><Italic className={icon} /></Btn>
      <Btn label="Strikethrough" active={s.strike} disabled={disabled} onClick={() => c().toggleStrike().run()}><Strikethrough className={icon} /></Btn>
      <Sep />
      <Btn label="Heading 1" active={s.h1} disabled={disabled} onClick={() => c().toggleHeading({ level: 1 }).run()}><Heading1 className={icon} /></Btn>
      <Btn label="Heading 2" active={s.h2} disabled={disabled} onClick={() => c().toggleHeading({ level: 2 }).run()}><Heading2 className={icon} /></Btn>
      <Sep />
      <Btn label="Bulleted list" active={s.bullet} disabled={disabled} onClick={() => c().toggleBulletList().run()}><List className={icon} /></Btn>
      <Btn label="Numbered list" active={s.ordered} disabled={disabled} onClick={() => c().toggleOrderedList().run()}><ListOrdered className={icon} /></Btn>
      <Btn label="Quote" active={s.quote} disabled={disabled} onClick={() => c().toggleBlockquote().run()}><Quote className={icon} /></Btn>
      <Sep />
      <Btn label="Undo" disabled={disabled || !s.canUndo} onClick={() => c().undo().run()}><Undo2 className={icon} /></Btn>
      <Btn label="Redo" disabled={disabled || !s.canRedo} onClick={() => c().redo().run()}><Redo2 className={icon} /></Btn>
    </div>
  );
}
