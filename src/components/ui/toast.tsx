"use client";

import { brandText } from "@/lib/brand";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from "lucide-react";
import { type Indicator, StatusIndicator } from "@/components/ui/status-indicator";
import { type SoundName, playSound } from "@/lib/sounds";

export type ToastTone = "info" | "success" | "warning" | "danger" | "recording";

export interface ToastInput {
  message: string;
  tone?: ToastTone;
  /** An animated mark instead of the plain icon (spinner, dots, recording dot, check). */
  indicator?: Indicator;
  /** An optional link, e.g. "Open" to go to a finished recording. */
  href?: string;
  actionLabel?: string;
  duration?: number;
}
export interface ToastItem extends ToastInput { id: number }

const ICONS = { info: Info, success: CircleCheck, warning: TriangleAlert, danger: CircleAlert, recording: Info } as const;
const COLOURS: Record<ToastTone, string> = {
  info: "text-accent",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
  recording: "text-danger",
};

/** The card itself, with no position: used on its own by `Toast` and in a list by `ToastStack`. */
function ToastCard({ message, tone = "info", indicator, href, actionLabel, duration = 7000, onClose }: ToastInput & { onClose: () => void }) {
  // Keep the latest onClose without restarting the timer every time the parent re-renders.
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; });
  useEffect(() => {
    const t = window.setTimeout(() => close.current(), duration);
    return () => window.clearTimeout(t);
  }, [message, duration]);

  const Icon = ICONS[tone];
  return (
    <div role="status" aria-live="polite" className="flex items-start gap-3 rounded-2xl border border-border bg-background shadow-sm px-4 py-3 text-sm shadow-[0_18px_44px_-14px_rgb(0_0_0/0.35)]">
      <span aria-hidden className={`mt-1 grid size-[18px] shrink-0 place-items-center ${COLOURS[tone]}`}>
        {indicator ? <StatusIndicator kind={indicator} className={indicator === "spinner" ? "size-4" : indicator === "check" ? "size-4" : ""} /> : <Icon className="size-[18px]" />}
      </span>
      <p className="min-w-0 flex-1 leading-5">
        {brandText(message)}
        {href && actionLabel && (
          <>
            {" "}
            <Link href={href} onClick={onClose} className="font-medium text-foreground underline underline-offset-2 hover:no-underline">{actionLabel}</Link>
          </>
        )}
      </p>
      <button type="button" onClick={onClose} aria-label="Dismiss" className="-mr-1 -mt-1 grid size-7 shrink-0 place-items-center rounded-md text-muted transition-colors hover:bg-surface hover:text-foreground">
        <X aria-hidden className="size-4" />
      </button>
    </div>
  );
}

/** A few toasts at once, newest at the bottom, each closing by itself. Use `useToasts` to drive it. */
export function ToastStack({ items, onDismiss }: { items: ToastItem[]; onDismiss: (id: number) => void }) {
  if (items.length === 0) return null;
  return (
    <div className="pointer-events-none fixed left-1/2 top-4 z-50 flex w-[min(30rem,calc(100vw-2rem))] -translate-x-1/2 flex-col gap-2">
      {items.map(({ id, ...t }) => (
        <div key={id} className="jb-toast-in pointer-events-auto">
          <ToastCard {...t} onClose={() => onDismiss(id)} />
        </div>
      ))}
    </div>
  );
}

/** State for a `ToastStack`: `push` adds a toast (the oldest drops off past three), `dismiss` removes one. */
/** A notice gets a matching soft sound: a rising chime when something finished, a low note for a problem. */
export function soundFor(t: ToastInput): SoundName {
  switch (t.tone) {
    case "danger": return "error";
    case "recording": return "recordStart";
    case "success": return /\bis ready\b|\bready\b/i.test(t.message) ? "success" : "done";
    default: return "notify";
  }
}

export function useToasts(scope = "list") {
  const [stack, setStack] = useState<{ scope: string; items: ToastItem[] }>({ scope, items: [] });
  const next = useRef(1);
  const push = useCallback((toast: ToastInput) => {
    const id = next.current++;
    playSound(soundFor(toast));
    setStack((cur) => ({ scope, items: [...(cur.scope === scope ? cur.items.slice(-2) : []), { id, ...toast }] }));
    return id;
  }, [scope]);
  const dismiss = useCallback((id: number) => setStack((cur) => ({ ...cur, items: cur.items.filter((t) => t.id !== id) })), []);
  // A reused capture-detail instance must not display the previous capture's notices.
  return { items: stack.scope === scope ? stack.items : [], push, dismiss };
}
