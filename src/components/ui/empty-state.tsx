export function EmptyState({ icon, title, body, action }: { icon?: React.ReactNode; title: string; body?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      {icon && <div aria-hidden className="mb-3 grid h-10 w-10 place-items-center rounded-full border border-border bg-surface text-muted [&>svg]:h-5 [&>svg]:w-5">{icon}</div>}
      <p className="text-sm font-medium">{title}</p>
      {body && <p className="mt-1 max-w-xs text-sm text-muted">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
