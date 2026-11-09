"use client";

import { EllipsisVertical } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useDismiss } from "@/components/ui/use-dismiss";

export interface MenuItem {
  label: string;
  /** Runs on choose. Use `href` instead to go somewhere. */
  onSelect?: () => void;
  href?: string;
  external?: boolean;
  danger?: boolean;
  disabled?: boolean;
  /** Why it is disabled. Shown under the label so nobody wonders. */
  reason?: string | null;
  /** A thin line above this item, to separate kinds of action. */
  divider?: boolean;
}

const MENU_W = 256;

/**
 * The "⋯" at the end of a table row (or beside a heading) that holds that row's actions. The menu is fixed-positioned, so
 * a table that scrolls sideways never clips it. Arrow keys move, Escape closes and returns focus.
 */
export function RowMenu({ label, items, align = "end", trigger }: { label: string; items: MenuItem[]; align?: "end" | "start"; trigger?: React.ReactNode }) {
  const [at, setAt] = useState<{ top: number; left: number } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const id = useId();
  const close = useCallback(() => setAt(null), []);
  useDismiss(!!at, close, panel, btn);

  useEffect(() => {
    if (!at) return;
    panel.current?.querySelector<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])')?.focus();
    const off = () => setAt(null);
    window.addEventListener("scroll", off, true);
    window.addEventListener("resize", off);
    return () => {
      window.removeEventListener("scroll", off, true);
      window.removeEventListener("resize", off);
    };
  }, [at]);

  function toggle() {
    if (at) return close();
    const r = btn.current?.getBoundingClientRect();
    if (!r) return;
    const left = align === "end" ? Math.max(8, r.right - MENU_W) : Math.min(r.left, window.innerWidth - MENU_W - 8);
    // Open upwards when there is no room below.
    const room = window.innerHeight - r.bottom;
    setAt({ top: room < items.length * 40 + 24 ? Math.max(8, r.top - items.length * 40 - 16) : r.bottom + 4, left });
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp" && e.key !== "Home" && e.key !== "End") return;
    const els = [...(panel.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])') ?? [])];
    if (!els.length) return;
    e.preventDefault();
    const i = els.indexOf(document.activeElement as HTMLElement);
    els[e.key === "Home" ? 0 : e.key === "End" ? els.length - 1 : e.key === "ArrowDown" ? (i + 1) % els.length : (i - 1 + els.length) % els.length]?.focus();
  }

  const row = "flex w-full flex-col items-start px-3 py-2 text-left text-sm outline-none transition-colors focus-visible:bg-surface";
  return (
    <>
      {trigger ? (
        <Button ref={btn} aria-label={label} aria-haspopup="menu" aria-expanded={!!at} aria-controls={at ? id : undefined} onClick={toggle}>{trigger}</Button>
      ) : (
        <button ref={btn} type="button" aria-label={label} aria-haspopup="menu" aria-expanded={!!at} aria-controls={at ? id : undefined} onClick={toggle} className="grid size-8 place-items-center rounded-lg text-muted transition-colors hover:bg-surface hover:text-foreground aria-expanded:bg-surface aria-expanded:text-foreground">
          <EllipsisVertical aria-hidden className="size-4" />
        </button>
      )}
      {at && (
        <div ref={panel} id={id} role="menu" aria-label={label} onKeyDown={onKeyDown} style={{ top: at.top, left: at.left, width: MENU_W }} className="fixed z-50 max-h-[70vh] overflow-y-auto rounded-xl border border-border bg-background py-1 text-foreground shadow-xl">
          {items.map((it, i) => {
            const tone = it.disabled ? "cursor-not-allowed opacity-50" : it.danger ? "text-danger hover:bg-danger/10" : "hover:bg-surface";
            const body = (
              <>
                <span className="font-medium">{it.label}</span>
                {it.disabled && it.reason && <span className="mt-1 text-xs font-normal text-muted">{it.reason}</span>}
              </>
            );
            const sep = it.divider && i > 0 ? "border-t border-border" : "";
            if (it.href && !it.disabled) {
              return it.external ? (
                <a key={it.label} role="menuitem" href={it.href} target="_blank" rel="noopener noreferrer" onClick={close} className={`${row} ${tone} ${sep}`}>{body}</a>
              ) : (
                <Link key={it.label} role="menuitem" href={it.href} onClick={close} className={`${row} ${tone} ${sep}`}>{body}</Link>
              );
            }
            return (
              <button
                key={it.label}
                type="button"
                role="menuitem"
                aria-disabled={it.disabled || undefined}
                onClick={() => {
                  if (it.disabled) return;
                  close();
                  it.onSelect?.();
                }}
                className={`${row} ${tone} ${sep}`}
              >
                {body}
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}

/** The text in a row's first cell that opens it. A real link or button, so it works with a keyboard and reads well to a screen reader. */
export function RowOpen({ href, onOpen, children }: { href?: string; onOpen?: () => void; children: React.ReactNode }) {
  const cls = "text-left font-medium text-foreground outline-none hover:underline hover:underline-offset-2 focus-visible:underline";
  return href ? <Link href={href} className={cls}>{children}</Link> : <button type="button" onClick={onOpen} className={cls}>{children}</button>;
}

/**
 * A table row you can click anywhere to open it. The first cell holds a <RowOpen> for keyboards and screen readers; clicks
 * on a link, button or menu inside the row do their own thing instead.
 */
export function ClickRow({ href, onOpen, children }: { href?: string; onOpen?: () => void; children: React.ReactNode }) {
  const router = useRouter();
  return (
    <tr
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("a, button, input, select, textarea, [role='menu']")) return;
        if (window.getSelection()?.toString()) return;
        if (href) router.push(href);
        else onOpen?.();
      }}
      className="cursor-pointer transition-colors hover:bg-surface/60"
    >
      {children}
    </tr>
  );
}

/** The cell that holds a row's "⋯" menu. */
export const MenuTd = ({ children }: { children: React.ReactNode }) => <td className="w-12 border-b border-border px-2 py-2 text-right align-middle">{children}</td>;

/** A read-only summary of one row: the details that don't fit in the table, plus the actions that apply. */
export function DetailsDialog({ title, rows, actions, onClose }: { title: string; rows: Array<[string, React.ReactNode]>; actions?: React.ReactNode; onClose: () => void }) {
  const id = useId();
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    close.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby={`${id}-t`} className="max-h-[90vh] w-full max-w-md space-y-4 overflow-y-auto rounded-xl border border-border bg-background p-5 shadow-xl">
        <h2 id={`${id}-t`} className="text-base font-semibold">{title}</h2>
        <dl className="space-y-3 text-sm">
          {rows.map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs text-muted">{k}</dt>
              <dd className="mt-1 break-words">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="flex flex-wrap justify-end gap-2">
          {actions}
          <Button ref={close} variant="ghost" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  );
}
