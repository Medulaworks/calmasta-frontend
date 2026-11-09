"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { adminGet } from "@/lib/admin-client";
import { adminQuery } from "@/lib/queries";
import { ApiError } from "@/lib/upload-client";

export interface Resource<T> {
  data: T | null;
  loading: boolean;
  /** True while a reload is under way, even when the old data is still on screen. */
  fetching: boolean;
  error: ApiError | Error | null;
  reload: () => void;
}

/** Loads a staff endpoint. Keeps the old data on screen while reloading so tables don't flash. */
export function useResource<T>(url: string | null): Resource<T> {
  const q = useQuery({
    ...adminQuery<T>(url ?? "__none__"),
    enabled: !!url,
  });
  const data = url ? (q.data as T | undefined) ?? null : null;
  const error = url ? (q.error as Error | null) : null;
  const loading = !!url && q.isLoading && !q.data;
  return { data, loading, fetching: !!url && q.isFetching, error, reload: () => void q.refetch() };
}

/** A list that loads page by page with a cursor and restarts whenever the filters (the URL) change. */
export function usePaged<I, P extends { nextCursor: string | null }>(url: string | null, pick: (page: P) => I[]) {
  type Loaded = { url: string; rows: I[]; cursor: string | null; first: P | null; status: "ready" | "unavailable" | "error"; message: string };
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [more, setMore] = useState(false);
  const [tick, setTick] = useState(0);
  const pickRef = useRef(pick);
  useEffect(() => { pickRef.current = pick; });

  useEffect(() => {
    if (!url) return;
    let off = false;
    adminGet<P>(url).then(
      (page) => { if (!off) setLoaded({ url, rows: pickRef.current(page), cursor: page.nextCursor, first: page, status: "ready", message: "" }); },
      (err) => {
        if (off) return;
        const unavailable = err instanceof ApiError && err.code === "feature_unavailable";
        setLoaded({ url, rows: [], cursor: null, first: null, status: unavailable ? "unavailable" : "error", message: err instanceof Error ? err.message : "Couldn't load this." });
      },
    );
    return () => { off = true; };
  }, [url, tick]);

  // Anything loaded for a different URL (an older filter) counts as still loading.
  const current = loaded && loaded.url === url ? loaded : null;
  const loadMore = async () => {
    if (!current?.cursor || !url) return;
    setMore(true);
    try {
      const page = await adminGet<P>(`${url}${url.includes("?") ? "&" : "?"}cursor=${encodeURIComponent(current.cursor)}`);
      setLoaded((cur) => (cur && cur.url === url ? { ...cur, rows: [...cur.rows, ...pickRef.current(page)], cursor: page.nextCursor } : cur));
    } catch (err) {
      setLoaded((cur) => (cur ? { ...cur, message: err instanceof Error ? err.message : "Couldn't load more." } : cur));
    } finally {
      setMore(false);
    }
  };
  return { rows: current?.rows ?? [], first: current?.first ?? null, hasMore: !!current?.cursor, status: current?.status ?? "loading", message: current?.message ?? "", more, loadMore, reload: () => setTick((t) => t + 1) };
}

/** Shown instead of a screen whose server side doesn't exist yet. It says so plainly and never shows made-up numbers. */
export function AdminUnavailable({ title = "Not available yet", children }: { title?: string; children?: React.ReactNode }) {
  return (
    <Card>
      <div role="status" className="space-y-3 p-5 text-sm">
        <p className="font-medium">{title}</p>
        <p className="text-muted">
          Not connected yet. There is nothing to show.
        </p>
        {children}
      </div>
    </Card>
  );
}

/** The standard loading / error / forbidden states for a staff page. */
export function ResourceBoundary<T>({ resource, children }: { resource: Resource<T>; children: (data: T) => React.ReactNode }) {
  const { data, loading, error, reload } = resource;
  if (error) {
    if (error instanceof ApiError && error.code === "feature_unavailable") return <AdminUnavailable />;
    const forbidden = error instanceof ApiError && error.status === 403;
    return (
      <Card>
        <div role="alert" className="space-y-3 p-5 text-sm">
          <p className="font-medium">{forbidden ? "You don't have access to this." : "Couldn't load this."}</p>
          <p className="text-muted">{forbidden ? "Ask an admin for access." : error.message}</p>
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
      <table className={`w-full border-collapse text-left text-sm [&_tbody_tr:last-child_td]:border-b-0 ${narrow ? "" : "md:min-w-[40rem]"}`}>{children}</table>
    </div>
  );
}
/** `wide` columns are hidden on phones so the row's name, status and ⋯ menu always fit without sideways scrolling. */
export const Th = ({ children, wide = false }: { children?: React.ReactNode; wide?: boolean }) => <th scope="col" className={`${wide ? "hidden md:table-cell " : ""}whitespace-nowrap border-b border-border bg-surface/50 px-4 py-2 text-xs font-medium text-muted`}>{children}</th>;
export const Td = ({ children, className = "", wide = false }: { children?: React.ReactNode; className?: string; wide?: boolean }) => <td className={`${wide ? "hidden md:table-cell " : ""}border-b border-border px-4 py-3 align-middle ${className}`}>{children}</td>;

export function Metric({ label, value, hint, tone, trend }: { label: string; value: React.ReactNode; hint?: string; tone?: "danger" | "warning"; trend?: { text: string; good: boolean | null } }) {
  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className={`mt-1 text-2xl font-medium tabular-nums ${tone === "danger" ? "text-danger" : tone === "warning" ? "text-warning" : ""}`}>{value}</p>
      {trend && <p className={`mt-1 text-xs font-medium ${trend.good === null ? "text-muted" : trend.good ? "text-success" : "text-danger"}`}>{trend.text}</p>}
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
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
  type?: "number" | "date" | "text" | "email";
  /** Overrides the browser hint, e.g. "current-password" when asking someone to confirm their own password. */
  autoComplete?: string;
  /** A credential: masked while typing, never pre-filled, and cleared when the dialog closes. */
  secret?: boolean;
  /** A fixed list of choices instead of free text. */
  options?: string[];
  /** Fields are required unless this is false. */
  required?: boolean;
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
          <div className="mt-2 text-sm text-muted">{description}</div>
        </div>
        {fields.map((f, i) => (
          <label key={f.name} className="block text-sm">
            <span className="font-medium">{f.label}</span>
            {f.options ? (
              <select
                required={f.required !== false}
                value={values[f.name]}
                onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                className="mt-2 block w-full rounded-lg border border-border bg-background px-3 py-2"
              >
                {f.options.map((o) => <option key={o}>{o}</option>)}
              </select>
            ) : (
              <input
                ref={i === 0 ? (el) => { first.current = el; } : undefined}
                type={f.secret ? "password" : f.type ?? "text"}
                autoComplete={f.autoComplete ?? (f.secret ? "new-password" : undefined)}
                spellCheck={f.secret ? false : undefined}
                min={f.min}
                max={f.max}
                required={f.required !== false}
                value={values[f.name]}
                onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                className="mt-2 block w-full rounded-lg border border-border bg-background px-3 py-2"
              />
            )}
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
            className="mt-2 block w-full rounded-lg border border-border bg-background px-3 py-2"
          />
          <span className="mt-1 block text-xs text-muted">At least 8 characters. Saved in Activity.</span>
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

/**
 * A plain confirm dialog for actions that don't need a typed reason: say what will happen, then one clear button.
 * Focus goes to the first field (or the button), Enter submits, Escape closes, and a server error appears inside the dialog.
 */
export function SimpleDialog({
  title, description, confirmLabel, busyLabel = "Working…", danger = false, canSubmit = true, children, onClose, onSubmit,
}: {
  title: string;
  description?: React.ReactNode;
  confirmLabel: string;
  busyLabel?: string;
  danger?: boolean;
  canSubmit?: boolean;
  children?: React.ReactNode;
  onClose: () => void;
  onSubmit: () => Promise<void>;
}) {
  const id = useId();
  const form = useRef<HTMLFormElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    (form.current?.querySelector<HTMLElement>("input, textarea") ?? form.current?.querySelector<HTMLElement>("button[type=submit]"))?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <form
        ref={form}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-t`}
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy || !canSubmit) return;
          setBusy(true);
          setError(null);
          try {
            await onSubmit();
            onClose();
          } catch (err) {
            setError(err instanceof Error ? err.message : "That didn't work. Please try again.");
            setBusy(false);
          }
        }}
        className="max-h-[90vh] w-full max-w-md space-y-4 overflow-y-auto rounded-xl border border-border bg-background p-5 shadow-xl"
      >
        <div>
          <h2 id={`${id}-t`} className="text-base font-semibold">{title}</h2>
          {description && <div className="mt-2 text-sm text-muted">{description}</div>}
        </div>
        {children}
        {error && <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type="submit" variant={danger ? "danger" : "primary"} disabled={busy || !canSubmit}>{busy ? busyLabel : confirmLabel}</Button>
        </div>
      </form>
    </div>
  );
}
