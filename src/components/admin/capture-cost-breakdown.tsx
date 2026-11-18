"use client";
import { fmtUtc } from "@/lib/admin-client";
import type { CostSummary } from "@/lib/capture-admin-types";
import { DataTable, Metric, Td, Th } from "./ui";
import { stateLabel } from "./capture-stage-status";

function microsToUsd(micros: string | null): string {
  if (micros === null) return "–";
  try {
    const v = BigInt(micros);
    const dollars = Number(v) / 1_000_000;
    return `$${dollars.toFixed(6).replace(/0+$/, "").replace(/\.$/, ".0")}`;
  } catch { return "–"; }
}
const note = "rounded-xl border border-border bg-surface px-4 py-3 text-sm text-muted";

export function CaptureCostBreakdown({ costs, canRead }: { costs: CostSummary | null; canRead: boolean }) {
  if (!canRead) return <p className={note}>You don’t have permission to see costs.</p>;
  if (!costs) return <p className={note}>No cost figures yet. They appear once the providers report what they charged.</p>;
  const { completeness, missingComponentCount } = costs;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Metric label="Estimated" value={microsToUsd(costs.estimatedMicros)} />
        <Metric label="Set aside" value={microsToUsd(costs.reservedMicros)} />
        <Metric label="Reported by provider" value={microsToUsd(costs.providerReportedMicros)} />
        <Metric label="Final" value={microsToUsd(costs.reconciledMicros)} />
      </div>
      <p className="text-xs text-muted">{completeness === "complete" ? "All costs are in." : completeness === "partial" ? "Some costs are still missing." : "We can’t say yet whether all costs are in."}{missingComponentCount > 0 ? ` ${missingComponentCount} ${missingComponentCount === 1 ? "part is" : "parts are"} unknown.` : ""} As of {fmtUtc(costs.asOf)}. Estimates and amounts set aside are not final totals.</p>
      <DataTable label="Cost by step" narrow>
        <thead><tr><Th>Step</Th><Th>Provider</Th><Th>Status</Th><Th>Reported</Th><Th>Final</Th><Th>When</Th></tr></thead>
        <tbody>
          {costs.items.length === 0 ? <tr><td colSpan={6} className="px-4 py-8 text-center text-muted">Nothing has been charged yet.</td></tr> :
            costs.items.map((it) => (
              <tr key={it.attemptId}><Td>{stateLabel(it.kind)}{it.templateId ? ` · ${it.templateId}` : ""}</Td><Td>{it.provider}{it.model ? ` · ${it.model}` : ""}</Td><Td>{stateLabel(it.state)}</Td><Td className="tabular-nums">{microsToUsd(it.providerReportedMicros)}</Td><Td className="tabular-nums">{microsToUsd(it.reconciledMicros)}</Td><Td className="whitespace-nowrap text-xs text-muted">{fmtUtc(it.occurredAt)}</Td></tr>
            ))}
        </tbody>
      </DataTable>
    </div>
  );
}
