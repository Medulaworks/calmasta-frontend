import type { ReactNode } from "react";

/**
 * Nothing here yet. Give it an `illustration` (see components/ui/illustrations.tsx) for a friendly picture, or an `icon`
 * for the smaller version. Always say what to do next: an empty state is an invitation, not an error.
 */
export function EmptyState({ icon, illustration, title, body, action }: { icon?: ReactNode; illustration?: ReactNode; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-5 py-10 text-center">
      {illustration ? (
        <div aria-hidden className="mb-6 w-48 max-w-full">{illustration}</div>
      ) : icon ? (
        <div aria-hidden className="mb-4 grid size-12 place-items-center rounded-full border border-border bg-surface text-muted [&>svg]:size-6">{icon}</div>
      ) : null}
      <p className="text-base font-semibold">{title}</p>
      {body && <p className="mt-2 max-w-sm text-sm text-muted">{body}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
