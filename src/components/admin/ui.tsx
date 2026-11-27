"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ChevronDown, Eye, EyeOff, type LucideIcon, Search, X } from "lucide-react";
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
export function useResource<T>(url: string | null, refetchInterval?: number | false): Resource<T> {
  const q = useQuery({
    ...adminQuery<T>(url ?? "__none__"),
    enabled: !!url,
    refetchInterval,
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
        setLoaded({ url, rows: [], cursor: null, first: null, status: unavailable ? "unavailable" : "error", message: err instanceof Error ? err.message : "Couldn’t load this." });
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
      setLoaded((cur) => (cur ? { ...cur, message: err instanceof Error ? err.message : "Couldn’t load more." } : cur));
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
  const { data, loading, fetching, error, reload } = resource;
  if (data) {
    // A lost session or revoked access replaces stale staff data. Anything else
    // (for example a 503 while the API restarts after an activation) keeps the
    // last good screen with a slim refreshing signal instead of flashing the
    // full-page error.
    const authError = error instanceof ApiError && (error.status === 401 || error.status === 403);
    if (!authError) {
      // One stable wrapper in every state. Swapping the wrapper itself would
      // unmount the page (and any open dialog with half-typed values) on
      // every poll; only the contents inside switch.
      return (
        <div aria-busy={fetching || undefined}>
          {children(data)}
          {error && !fetching && (
            <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
              <span>Couldn&rsquo;t refresh just now &mdash; showing the last saved status.</span>
              <Button variant="ghost" size="sm" onClick={reload}>Try again</Button>
            </div>
          )}
        </div>
      );
    }
  }
  if (error) {
    if (error instanceof ApiError && error.code === "feature_unavailable") return <AdminUnavailable />;
    const forbidden = error instanceof ApiError && error.status === 403;
    return (
      <Card>
        <div role="alert" className="space-y-3 p-5 text-sm">
          <p className="font-medium">{forbidden ? "You don’t have access to this." : "Couldn’t load this."}</p>
          <p className="text-muted">{forbidden ? "Ask an admin for access." : error.message}</p>
          {!forbidden && <Button onClick={reload}>Try again</Button>}
        </div>
      </Card>
    );
  }
  if (loading || !data) {
    return (
      <div role="status" aria-label="Loading" aria-busy="true" className="h-48 jb-skel rounded-2xl border border-border bg-surface" />
    );
  }
  return <>{children(data)}</>;
}

/** Wide tables scroll sideways on small screens instead of breaking the page. */
export function DataTable({ children, label, narrow = false }: { children: React.ReactNode; label: string; narrow?: boolean }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-background shadow-sm" tabIndex={0} role="region" aria-label={label}>
      <table className={`w-full border-collapse text-left text-sm [&_tbody_tr:last-child_td]:border-b-0 ${narrow ? "" : "md:min-w-[40rem]"}`}>{children}</table>
    </div>
  );
}
/** `wide` columns are hidden on phones so the row's name, status and ⋯ menu always fit without sideways scrolling. */
export const Th = ({ children, wide = false }: { children?: React.ReactNode; wide?: boolean }) => <th scope="col" className={`${wide ? "hidden md:table-cell " : ""}whitespace-nowrap border-b border-border bg-surface/70 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted`}>{children}</th>;
export const Td = ({ children, className = "", wide = false }: { children?: React.ReactNode; className?: string; wide?: boolean }) => <td className={`${wide ? "hidden md:table-cell " : ""}border-b border-border px-4 py-3 align-middle ${className}`}>{children}</td>;

export function Metric({ label, value, hint, tone, trend, icon: Icon }: { label: string; value: React.ReactNode; hint?: string; tone?: "danger" | "warning"; trend?: { text: string; good: boolean | null }; icon?: LucideIcon }) {
  return (
    <div className="rounded-2xl border border-border bg-background p-5 shadow-sm">
      <div className="flex items-center gap-3">
        {Icon && <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent/10 text-accent"><Icon className="size-[18px]" /></span>}
        <p className="text-sm text-muted">{label}</p>
      </div>
      <p className={`mt-3 text-3xl font-semibold tracking-tight tabular-nums ${tone === "danger" ? "text-danger" : tone === "warning" ? "text-warning" : ""}`}>{value}</p>
      {trend && <p className={`mt-1 text-xs font-medium ${trend.good === null ? "text-muted" : trend.good ? "text-success" : "text-danger"}`}>{trend.text}</p>}
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "warning" | "danger"; children: React.ReactNode }) {
  const c = tone === "danger" ? "border-danger/40 bg-danger/5" : tone === "warning" ? "border-warning/40 bg-warning/5" : "border-accent/30 bg-accent/5";
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
  title, description, confirmLabel, danger = false, fields = [], hideReason = false, onClose, onSubmit,
}: {
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  danger?: boolean;
  fields?: ReasonField[];
  hideReason?: boolean;
  onClose: () => void;
  onSubmit: (values: Record<string, string>) => Promise<void>;
}) {
  const id = useId();
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(fields.map((f) => [f.name, f.defaultValue ?? ""])));
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [visible, setVisible] = useState<Record<string, boolean>>({});
  const first = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  // Stable callback: an inline ref would detach/re-attach on every keystroke.
  const setFirst = useCallback((el: HTMLInputElement | HTMLTextAreaElement | null) => {
    first.current = el;
  }, []);
  // Latest handlers without re-subscribing: focusing or closing on a parent
  // re-render (e.g. the 5s adoption poll) would yank focus out of the field
  // being typed in, so the key handler below subscribes only on mount.
  const closeRef = useRef(onClose);
  const busyRef = useRef(busy);
  useEffect(() => {
    closeRef.current = onClose;
    busyRef.current = busy;
  });
  useEffect(() => {
    first.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busyRef.current) closeRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const submit = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await onSubmit({ ...values, reason: reason.trim() || values.reason || "Test applied credentials" });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn’t work.");
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
        className="max-h-[90vh] w-full max-w-md space-y-4 overflow-y-auto rounded-2xl border border-border bg-background p-6 shadow-2xl"
      >
        <div>
          <h2 id={`${id}-t`} className="text-base font-semibold">{title}</h2>
          <div className="mt-2 text-sm text-muted">{description}</div>
        </div>
        {fields.map((f, i) => (
          <label key={f.name} className="block text-sm">
            <span className="font-medium">{f.label}{f.required !== false && <span aria-hidden="true" className="ml-1 text-danger">*</span>}</span>
            {f.options ? (
              <select
                required={f.required !== false}
                value={values[f.name]}
                onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                className="mt-2 block w-full rounded-xl border border-border bg-background px-3 py-2 shadow-sm focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent-solid/20"
              >
                <option value="" disabled>Select {f.label.toLowerCase()}</option>
                {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : f.secret ? (
              <div className="relative mt-2">
                <input
                  ref={i === 0 ? setFirst : undefined}
                  type={visible[f.name] ? "text" : "password"}
                  autoComplete={f.autoComplete ?? "new-password"}
                  spellCheck={false}
                  required={f.required !== false}
                  value={values[f.name]}
                  onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                  className="block w-full rounded-xl border border-border bg-background px-3 py-2 shadow-sm focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent-solid/20 pr-10"
                />
                <button
                  type="button"
                  aria-label={visible[f.name] ? `Hide ${f.label}` : `Show ${f.label}`}
                  aria-pressed={visible[f.name] ? "true" : "false"}
                  onClick={() => setVisible((v) => ({ ...v, [f.name]: !v[f.name] }))}
                  className="absolute inset-y-0 right-0 grid w-9 place-items-center rounded-r-lg text-muted hover:text-foreground"
                >
                  {visible[f.name] ? <EyeOff aria-hidden className="size-4" /> : <Eye aria-hidden className="size-4" />}
                </button>
              </div>
            ) : (
              <input
                ref={i === 0 ? setFirst : undefined}
                type={f.type ?? "text"}
                autoComplete={f.autoComplete}
                min={f.min}
                max={f.max}
                required={f.required !== false}
                value={values[f.name]}
                onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                className="mt-2 block w-full rounded-xl border border-border bg-background px-3 py-2 shadow-sm focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent-solid/20"
              />
            )}
            {f.hint && <span className="mt-1 block text-xs text-muted">{f.hint}</span>}
          </label>
        ))}
        {!hideReason && (
          <label className="block text-sm">
            <span className="font-medium">Reason</span>
            <textarea
              ref={fields.length === 0 ? setFirst : undefined}
              required
              minLength={8}
              maxLength={500}
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-2 block w-full rounded-xl border border-border bg-background px-3 py-2 shadow-sm focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent-solid/20"
            />
            <span className="mt-1 block text-xs text-muted">At least 8 characters. Saved in Activity.</span>
          </label>
        )}
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type="submit" variant={danger ? "danger" : "primary"} disabled={busy || (!hideReason && reason.trim().length < 8)}>{busy ? "Working…" : confirmLabel}</Button>
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
  const closeRef = useRef(onClose);
  const busyRef = useRef(busy);
  useEffect(() => {
    closeRef.current = onClose;
    busyRef.current = busy;
  });
  useEffect(() => {
    (form.current?.querySelector<HTMLElement>("input, textarea") ?? form.current?.querySelector<HTMLElement>("button[type=submit]"))?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busyRef.current) closeRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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
            setError(err instanceof Error ? err.message : "That didn’t work. Please try again.");
            setBusy(false);
          }
        }}
        className="max-h-[90vh] w-full max-w-md space-y-4 overflow-y-auto rounded-2xl border border-border bg-background p-6 shadow-2xl"
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

const control = "h-10 rounded-lg border border-border bg-background text-sm transition-[border-color,box-shadow] hover:border-muted/60 focus-within:border-accent focus-within:ring-4 focus-within:ring-accent-solid/20";

/** A search box: magnifier on the left, a clear (×) button once there is text. Pressing Enter submits the surrounding form. */
export function SearchField({ value, onChange, placeholder, label, className = "" }: { value: string; onChange: (v: string) => void; placeholder: string; label: string; className?: string }) {
  return (
    <label className={`relative flex min-w-52 flex-1 items-center sm:max-w-sm ${control} ${className}`}>
      <span className="sr-only">{label}</span>
      <Search aria-hidden className="pointer-events-none absolute left-3 size-4 text-muted" />
      <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} maxLength={100} autoComplete="off" className="h-full w-full appearance-none rounded-lg bg-transparent pl-9 pr-9 text-sm outline-none placeholder:text-muted [&::-webkit-search-cancel-button]:hidden" />
      {value && (
        <button type="button" onClick={() => onChange("")} aria-label="Clear search" className="absolute right-1.5 grid size-7 place-items-center rounded-md text-muted hover:bg-surface hover:text-foreground"><X aria-hidden className="size-4" /></button>
      )}
    </label>
  );
}

/** A filter: its name sits inside the control ("Plan  All plans ⌄") so you always know what you are filtering. */
export function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: ReadonlyArray<{ value: string; label: string }> }) {
  return (
    <label className={`relative inline-flex items-center ${control}`}>
      <span className="pl-3 text-muted">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="h-full cursor-pointer appearance-none rounded-lg bg-transparent pl-2 pr-9 text-sm font-medium outline-none">
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown aria-hidden className="pointer-events-none absolute right-3 size-4 text-muted" />
    </label>
  );
}

/** One look for every text box in the staff area. */
export const inputClass = "block h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none transition-[border-color,box-shadow] placeholder:text-muted hover:border-muted/60 focus:border-accent focus:ring-4 focus:ring-accent-solid/20 disabled:opacity-60 aria-[invalid=true]:border-danger";
/** And for every tick box or switch. */
export const checkClass = "size-4 shrink-0 accent-accent";

/** A drop-down inside a form: the same box as a text field, with our own arrow instead of the browser's. */
export function SelectField({ className = "", children, ...props }: React.ComponentPropsWithoutRef<"select">) {
  return (
    <span className="relative block">
      <select {...props} className={`${inputClass} cursor-pointer appearance-none pr-9 ${className}`}>{children}</select>
      <ChevronDown aria-hidden className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
    </span>
  );
}
