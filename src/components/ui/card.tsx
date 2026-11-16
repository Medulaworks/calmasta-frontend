export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-border bg-background shadow-sm ${className}`}>{children}</section>;
}

export function CardHeader({ title, description, action, id }: { title: string; description?: string; action?: React.ReactNode; id?: string }) {
  return (
    <div className="flex min-h-14 items-center justify-between gap-4 border-b border-border px-5 py-3">
      <div className="min-w-0">
        <h2 id={id} className="text-base font-semibold">
          {title}
        </h2>
        {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}
