"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

export const field = "mt-2 block w-full min-h-10 rounded-xl border border-border bg-background px-4 py-2 text-sm shadow-sm placeholder:text-muted focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent-solid/20";

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="font-medium">{label}</span>
      {children}
      {hint && <span className="mt-2 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function ErrorBox({ message }: { message: string | null }) {
  return message ? <p role="alert" className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">{message}</p> : null;
}

export function Confirm({ title, text, action, busy, onConfirm, onCancel }: { title: string; text: string; action: string; busy: boolean; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div role="alertdialog" aria-label={title} className="rounded-2xl border border-danger/30 bg-danger/5 p-5 text-sm">
      <p className="text-base font-semibold">{title}</p>
      <p className="mt-1 text-muted">{text}</p>
      <div className="mt-4 flex flex-wrap gap-3">
        <Button variant="danger" disabled={busy} onClick={onConfirm}>{busy ? "Working…" : action}</Button>
        <Button variant="ghost" disabled={busy} onClick={onCancel}>Keep it</Button>
      </div>
    </div>
  );
}
