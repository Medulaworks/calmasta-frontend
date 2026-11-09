export function StatTile({ label, value, hint, icon }: { label: string; value: React.ReactNode; hint?: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-background p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-center justify-between text-muted">
        <p className="text-sm">{label}</p>
        {icon && <span aria-hidden className="grid size-8 place-items-center rounded-lg bg-accent-solid/15 text-accent [&>svg]:size-4">{icon}</span>}
      </div>
      <p className="mt-4 text-3xl font-semibold tracking-tight tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function StatTileSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-background p-5" aria-hidden>
      <div className="h-4 w-24 jb-skel rounded bg-border" />
      <div className="mt-4 h-8 w-16 jb-skel rounded bg-border" />
      <div className="mt-4 h-3 w-28 jb-skel rounded bg-border" />
    </div>
  );
}
