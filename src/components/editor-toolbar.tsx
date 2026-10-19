"use client";

import type { Editor } from "@tiptap/react";
import { useEditorState } from "@tiptap/react";

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
      className={`rounded px-2 py-1 text-sm disabled:opacity-40 ${active ? "bg-surface font-semibold text-foreground" : "text-muted hover:text-foreground"}`}
    >
      {children}
    </button>
  );
}

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
    <div role="toolbar" aria-label="Formatting" className="flex flex-wrap items-center gap-1 border-b border-border px-2 py-1.5">
      <Btn label="Bold" active={s.bold} disabled={disabled} onClick={() => c().toggleBold().run()}><b>B</b></Btn>
      <Btn label="Italic" active={s.italic} disabled={disabled} onClick={() => c().toggleItalic().run()}><i>I</i></Btn>
      <Btn label="Strikethrough" active={s.strike} disabled={disabled} onClick={() => c().toggleStrike().run()}><s>S</s></Btn>
      <span aria-hidden className="mx-1 h-4 w-px bg-border" />
      <Btn label="Heading 1" active={s.h1} disabled={disabled} onClick={() => c().toggleHeading({ level: 1 }).run()}>H1</Btn>
      <Btn label="Heading 2" active={s.h2} disabled={disabled} onClick={() => c().toggleHeading({ level: 2 }).run()}>H2</Btn>
      <Btn label="Bulleted list" active={s.bullet} disabled={disabled} onClick={() => c().toggleBulletList().run()}>• List</Btn>
      <Btn label="Numbered list" active={s.ordered} disabled={disabled} onClick={() => c().toggleOrderedList().run()}>1. List</Btn>
      <Btn label="Quote" active={s.quote} disabled={disabled} onClick={() => c().toggleBlockquote().run()}>&ldquo; Quote</Btn>
      <span aria-hidden className="mx-1 h-4 w-px bg-border" />
      <Btn label="Undo" disabled={disabled || !s.canUndo} onClick={() => c().undo().run()}>Undo</Btn>
      <Btn label="Redo" disabled={disabled || !s.canRedo} onClick={() => c().redo().run()}>Redo</Btn>
    </div>
  );
}
