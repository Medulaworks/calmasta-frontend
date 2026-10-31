import type { ReactNode } from "react";

/**
 * Loading is always a skeleton: grey shapes with a soft light sweeping across (`.jb-skel` in globals.css), shaped like
 * what is about to appear. Never a "Loading…" line. `Loading` wraps a group so screen readers hear one message.
 */

/** One grey shape. Give it a size (`h-4 w-40`) and, if it isn't text, a radius. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <span aria-hidden className={`jb-skel block rounded bg-border ${className}`} />;
}

/** A panel-shaped skeleton (a card or chart that hasn't arrived yet). */
export function SkeletonPanel({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`jb-skel rounded-xl border border-border bg-surface ${className}`} />;
}

/** Marks a group of skeletons as one busy region with a single spoken label. */
export function Loading({ label = "Loading", className = "", children }: { label?: string; className?: string; children: ReactNode }) {
  return (
    <div role="status" aria-busy="true" aria-label={label} className={className}>
      {children}
      <span className="sr-only">{label}…</span>
    </div>
  );
}

/** Lines of text, the last one shorter. */
export function SkeletonLines({ lines = 3, className = "" }: { lines?: number; className?: string }) {
  return (
    <div aria-hidden className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={`h-3 ${i === lines - 1 && lines > 1 ? "w-2/3" : "w-full"}`} />
      ))}
    </div>
  );
}

/** The rows of a list: an icon tile and two lines each. The shape of Library, Capture and Home lists. */
export function SkeletonRows({ count = 4, label = "Loading", icon = true }: { count?: number; label?: string; icon?: boolean }) {
  return (
    <Loading label={label}>
      <ul aria-hidden className="divide-y divide-border">
        {Array.from({ length: count }, (_, i) => (
          <li key={i} className="flex items-center gap-3 px-5 py-3">
            {icon && <Skeleton className="size-9 shrink-0 rounded-lg" />}
            <span className="block flex-1 space-y-2">
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-2.5 w-1/4" />
            </span>
            <Skeleton className="h-5 w-16 rounded-full" />
          </li>
        ))}
      </ul>
    </Loading>
  );
}

/** A page title, a line of description and a body panel: the default while a page's content loads. */
export function SkeletonPage({ label = "Loading" }: { label?: string }) {
  return (
    <Loading label={label} className="space-y-6">
      <div aria-hidden className="space-y-2">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-3.5 w-80 max-w-full" />
      </div>
      <SkeletonPanel className="h-64" />
    </Loading>
  );
}

/** A detail page (a recording, a document): back link, title with a status, tabs, and a card. */
export function SkeletonDetail({ label = "Loading" }: { label?: string }) {
  return (
    <Loading label={label} className="space-y-6">
      <Skeleton className="h-4 w-20" />
      <div className="flex items-start gap-3">
        <Skeleton className="size-11 shrink-0 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-7 w-64 max-w-full" />
          <Skeleton className="h-4 w-48 max-w-full" />
        </div>
      </div>
      <div aria-hidden className="flex gap-6 border-b border-border pb-3">
        {["w-16", "w-20", "w-20", "w-14"].map((w, i) => <Skeleton key={i} className={`h-4 ${w}`} />)}
      </div>
      <SkeletonPanel className="h-56" />
    </Loading>
  );
}

/** The sign-in style form: a heading, a line of text, two fields and a button. */
export function SkeletonForm({ label = "Loading" }: { label?: string }) {
  return (
    <Loading label={label} className="space-y-5">
      <Skeleton className="h-10 w-4/5" />
      <SkeletonLines lines={2} />
      <div aria-hidden className="space-y-4 pt-4">
        <Skeleton className="h-11 w-full rounded-xl" />
        <Skeleton className="h-11 w-full rounded-xl" />
        <Skeleton className="h-11 w-full rounded-xl" />
      </div>
    </Loading>
  );
}

/** The public booking pages: a title and description beside a list of choices. */
export function SkeletonGuest({ label = "Loading" }: { label?: string }) {
  return (
    <Loading label={label} className="mx-auto grid max-w-4xl gap-8 py-10 md:grid-cols-[18rem_1fr]">
      <div aria-hidden className="space-y-4">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-8 w-64 max-w-full" />
        <SkeletonLines lines={3} />
      </div>
      <div aria-hidden className="space-y-3">
        {[0, 1, 2].map((i) => <SkeletonPanel key={i} className="h-20" />)}
      </div>
    </Loading>
  );
}
