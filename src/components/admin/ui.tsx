"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { adminQuery } from "@/lib/queries";
import { ApiError } from "@/lib/upload-client";

export interface Resource<T> {
  data: T | null;
  loading: boolean;
  error: ApiError | Error | null;
  reload: () => void;
}

/** Loads a staff endpoint. Keeps the old data on screen while reloading so tables don't flash. */
export function useResource<T>(url: string | null): Resource<T> {
  const q = useQuery({
    ...adminQuery<T>(url ?? "__none__"),
    enabled: !!url,
    placeholderData: (prev) => prev,
  });
  const data = url ? (q.data as T | undefined) ?? null : null;
  const error = url ? (q.error as Error | null) : null;
  const loading = !!url && q.isLoading && !q.data;
  return { data, loading, error, reload: () => void q.refetch() };
}

/** The standard loading / error / forbidden states for a staff page. */
export function ResourceBoundary<T>({ resource, children }: { resource: Resource<T>; children: (data: T) => React.ReactNode }) {
  const { data, loading, error, reload } = resource;
  if (error) {
    const forbidden = error instanceof ApiError && error.status === 403;
    return (
      <Card>
        <div role="alert" className="space-y-3 p-6 text-sm">
          <p className="font-medium">{forbidden ? "You don't have access to this." : "Couldn't load this."}</p>
          <p className="text-muted">{forbidden ? "Your account isn't on the staff list. Ask an administrator if you need access." : error.message}</p>
          {!forbidden && <Button onClick={reload}>Try again</Button>}
        </div>
      </Card>
    );
  }
  if (loading || !data) {
    return (
      <div role="status" aria-label="Loading" aria-busy="true" className="h-48 jb-skel rounded-xl border border-border bg-surface" />
    );
  }
  return <>{children(data)}</>;
}

/** Wide tables scroll sideways on small screens instead of breaking the page. */
export function DataTable({ children, label, narrow = false }: { children: React.ReactNode; label: string; narrow?: boolean }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-background" tabIndex={0} role="region" aria-label={label}>
      <table className={`w-full border-collapse text-left text-sm ${narrow ? "" : "min-w-[40rem]"}`}>{children}</table>
    </div>
  );
}
export const Th = ({ children }: { children?: React.ReactNode }) => <th scope="col" className="whitespace-nowrap border-b border-border bg-surface/50 px-4 py-2 text-xs font-medium text-muted">{children}</th>;
export const Td = ({ children, className = "" }: { children?: React.ReactNode; className?: string }) => <td className={`border-b border-border px-4 py-3 align-top last:border-b-0 ${className}`}>{children}</td>;

export function Metric({ label, value, hint, tone }: { label: string; value: React.ReactNode; hint?: string; tone?: "danger" | "warning" }) {
  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className={`mt-1 text-2xl font-medium tabular-nums ${tone === "danger" ? "text-danger" : tone === "warning" ? "text-warning" : ""}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "warning" | "danger"; children: React.ReactNode }) {
  const c = tone === "danger" ? "border-danger/40 bg-danger/10" : tone === "warning" ? "border-warning/40 bg-warning/10" : "border-accent/30 bg-accent/10";
  return (
    <div role={tone === "info" ? "note" : "alert"} className={`rounded-xl border px-4 py-3 text-sm ${c}`}>
      {children}
    </div>
  );
}

export interface ReasonField {
  name: string;
  label: string;
  type?: "number" | "date" | "text";
  hint?: string;
  min?: number;
  max?: number;
  defaultValue?: string;
}

/**
 * Every staff change goes through this: say what will happen, give a reason (and any extra details), confirm.
 * It is a real dialog: focus moves in, Escape closes, and the error from the server is shown where the person is looking.
 */
export function ActionDialog({
  title, description, confirmLabel, danger = false, fields = [], onClose, onSubmit,
}: {
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  danger?: boolean;
  fields?: ReasonField[];
  onClose: () => void;
  onSubmit: (values: Record<string, string>) => Promise<void>;
}) {
  const id = useId();
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(fields.map((f) => [f.name, f.defaultValue ?? ""])));
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const first = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  useEffect(() => {
    first.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  const submit = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await onSubmit({ ...values, reason });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't work.");
      setBusy(false);
    }
  }, [onSubmit, onClose, values, reason]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-t`}
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="max-h-[90vh] w-full max-w-md space-y-4 overflow-y-auto rounded-xl border border-border bg-background p-5 shadow-xl"
      >
        <div>
          <h2 id={`${id}-t`} className="text-base font-semibold">{title}</h2>
          <div className="mt-1.5 text-sm text-muted">{description}</div>
        </div>
        {fields.map((f, i) => (
          <label key={f.name} className="block text-sm">
            <span className="font-medium">{f.label}</span>
            <input
              ref={i === 0 ? (el) => { first.current = el; } : undefined}
              type={f.type ?? "text"}
              min={f.min}
              max={f.max}
              required
              value={values[f.name]}
              onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
              className="mt-1.5 block w-full rounded-lg border border-border bg-background px-3 py-2"
            />
            {f.hint && <span className="mt-1 block text-xs text-muted">{f.hint}</span>}
          </label>
        ))}
        <label className="block text-sm">
          <span className="font-medium">Reason</span>
          <textarea
            ref={fields.length === 0 ? (el) => { first.current = el; } : undefined}
            required
            minLength={8}
            maxLength={500}
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="mt-1.5 block w-full rounded-lg border border-border bg-background px-3 py-2"
          />
          <span className="mt-1 block text-xs text-muted">Saved with this action in the audit trail, with your name and the time.</span>
        </label>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type="submit" variant={danger ? "danger" : "primary"} disabled={busy || reason.trim().length < 8}>{busy ? "Working…" : confirmLabel}</Button>
        </div>
      </form>
    </div>
  );
}
