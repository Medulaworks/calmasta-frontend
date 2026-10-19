export function StatTile({ label, value, hint, icon }: { label: string; value: React.ReactNode; hint?: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-background p-5">
      <div className="flex items-center justify-between text-muted">
        <p className="text-sm">{label}</p>
        {icon && <span aria-hidden>{icon}</span>}
      </div>
      <p className="mt-3 text-3xl font-semibold tracking-tight tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function StatTileSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-background p-5" aria-hidden>
      <div className="h-3 w-24 animate-pulse rounded bg-border" />
      <div className="mt-4 h-8 w-16 animate-pulse rounded bg-border" />
      <div className="mt-3 h-2.5 w-28 animate-pulse rounded bg-border" />
    </div>
  );
}
