export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-xl border border-border bg-background ${className}`}>{children}</section>;
}

export function CardHeader({ title, action, id }: { title: string; action?: React.ReactNode; id?: string }) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-3 border-b border-border px-5 py-3">
      <h2 id={id} className="text-sm font-semibold">
        {title}
      </h2>
      {action}
    </div>
  );
}
