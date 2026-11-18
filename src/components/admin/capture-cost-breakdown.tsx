"use client";
import { fmtUtc } from "@/lib/admin-client";
import type { CostSummary } from "@/lib/capture-admin-types";

function microsToUsd(micros: string | null): string {
  if (micros === null) return "–";
  try {
    const v = BigInt(micros);
    const dollars = Number(v) / 1_000_000;
    return `$${dollars.toFixed(6).replace(/0+$/, "").replace(/\.$/, ".0")}`;
  } catch { return "–"; }
}

export function CaptureCostBreakdown({ costs, canRead }: { costs: CostSummary | null; canRead: boolean }) {
  if (!canRead) return <p className="rounded-lg border border-border bg-surface px-4 py-3 text-sm text-muted">Cost breakdown requires cost_read permission.</p>;
  if (!costs) return <p className="rounded-lg border border-border bg-surface px-4 py-3 text-sm text-muted">No cost data yet. Costs are shown only when the capture has provider-reported or reconciled amounts — not invented.</p>;
  const { completeness, missingComponentCount } = costs;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
        <div><p className="text-muted">Estimated</p><p className="font-medium tabular-nums">{microsToUsd(costs.estimatedMicros)}</p></div>
        <div><p className="text-muted">Reserved</p><p className="font-medium tabular-nums">{microsToUsd(costs.reservedMicros)}</p></div>
        <div><p className="text-muted">Provider reported</p><p className="font-medium tabular-nums">{microsToUsd(costs.providerReportedMicros)}</p></div>
        <div><p className="text-muted">Reconciled</p><p className="font-medium tabular-nums">{microsToUsd(costs.reconciledMicros)}</p></div>
      </div>
      <p className="text-xs text-muted">Completeness: {completeness} {missingComponentCount > 0 ? `· ${missingComponentCount} unknown components` : ""} · as of {fmtUtc(costs.asOf)}</p>
      <p className="text-xs text-muted">Estimates and reservations are not totals. Failed billable attempts remain shown; cached reopens add no generation. Refund/credit adjustments are labelled per row.</p>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface text-xs text-muted"><tr><th className="px-3 py-2">Kind</th><th className="px-3 py-2">Provider</th><th className="px-3 py-2">State</th><th className="px-3 py-2">Reported</th><th className="px-3 py-2">Reconciled</th><th className="px-3 py-2">At</th></tr></thead>
          <tbody className="divide-y divide-border">
            {costs.items.length === 0 ? <tr><td colSpan={6} className="px-3 py-6 text-center text-muted">No attempts yet.</td></tr> :
              costs.items.map((it) => (
                <tr key={it.attemptId}><td className="px-3 py-2">{it.kind}{it.templateId ? ` · ${it.templateId}` : ""}</td><td className="px-3 py-2">{it.provider}{it.model ? ` · ${it.model}` : ""}</td><td className="px-3 py-2">{it.state}</td><td className="px-3 py-2 tabular-nums">{microsToUsd(it.providerReportedMicros)}</td><td className="px-3 py-2 tabular-nums">{microsToUsd(it.reconciledMicros)}</td><td className="px-3 py-2 text-xs text-muted">{fmtUtc(it.occurredAt)}</td></tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
