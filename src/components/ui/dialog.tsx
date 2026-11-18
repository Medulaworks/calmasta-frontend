"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";

/**
 * A modal dialog: dims the page, keeps focus inside, closes on Escape or a click outside, and gives focus back to
 * whatever opened it. The first field (or the close button) takes focus when it opens.
 */
export function Dialog({ title, onClose, children, width = "max-w-lg" }: { title: string; onClose: () => void; children: React.ReactNode; width?: string }) {
  const titleId = useId();
  const box = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);
  // Latest close without re-subscribing: re-running the effect below for a new
  // onClose identity would yank focus out of the field being typed in on every
  // parent re-render.
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    opener.current = document.activeElement;
    const first = box.current?.querySelector<HTMLElement>("input, textarea, select, [data-autofocus]") ?? box.current?.querySelector<HTMLElement>("button");
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") return closeRef.current();
      if (e.key !== "Tab" || !box.current) return;
      const f = [...box.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')];
      if (f.length === 0) return;
      const i = f.indexOf(document.activeElement as HTMLElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
    };
    document.addEventListener("keydown", onKey);
    const o = opener.current;
    return () => {
      document.removeEventListener("keydown", onKey);
      if (o instanceof HTMLElement) o.focus();
    };
    // Mount-only: focus moves in once and is given back on unmount.
  }, []);

  // Rendered on the page body, outside whatever opened it. A dialog opened from the top bar (which has a blur effect) would
  // otherwise be positioned relative to the bar and not the screen.
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={box} role="dialog" aria-modal="true" aria-labelledby={titleId} className={`flex max-h-[90vh] w-full ${width} flex-col overflow-hidden rounded-3xl border border-border bg-background text-foreground shadow-2xl`}>
        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-3">
          <h2 id={titleId} className="text-lg font-semibold">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="grid size-10 place-items-center rounded-full text-muted hover:bg-surface hover:text-foreground">
            <X aria-hidden className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
