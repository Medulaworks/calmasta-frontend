"use client";

import type { ReactNode } from "react";

export const field = "mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm";

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="font-medium">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function ErrorBox({ message }: { message: string | null }) {
  return message ? <p role="alert" className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">{message}</p> : null;
}

export function Confirm({ title, text, action, busy, onConfirm, onCancel }: { title: string; text: string; action: string; busy: boolean; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div role="alertdialog" aria-label={title} className="rounded-xl border border-border bg-surface p-5 text-sm">
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-muted">{text}</p>
      <div className="mt-4 flex gap-2">
        <button type="button" disabled={busy} onClick={onConfirm} className="rounded-lg bg-danger-solid px-4 py-2 font-medium text-white disabled:opacity-60">{busy ? "Working…" : action}</button>
        <button type="button" disabled={busy} onClick={onCancel} className="rounded-lg px-4 py-2 text-muted hover:text-foreground">Cancel</button>
      </div>
    </div>
  );
}
