"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { type Json, adminPost, fmtUtc } from "@/lib/admin-client";
import type { Reconciliation } from "@/lib/admin-types";
import { ActionDialog, Metric, ResourceBoundary, useResource } from "./ui";

type Data = Json<Reconciliation>;

export function ReconciliationView() {
  const res = useResource<Data>("/api/admin/reconciliation");
  const [fixing, setFixing] = useState<Data["findings"][number] | null>(null);

  return (
    <ResourceBoundary resource={res}>
      {(d) => {
        const safe = d.findings.filter((f) => f.severity === "safe_to_fix");
        const review = d.findings.filter((f) => f.severity === "needs_review");
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              <Metric label="Safe to fix" value={safe.length} hint="Out-of-date records only" />
              <Metric label="Needs a person" value={review.length} tone={review.length > 0 ? "warning" : undefined} hint="Money or customer data involved" />
              <Metric label="Usage not yet matched" value={d.unreconciledUsage} hint="Older than 3 days, waiting for the provider's record" />
            </div>
            <p className="text-sm text-muted">Checked {fmtUtc(d.checkedAt)}. Differences between the store, what customers are entitled to, and what the provider says was used.</p>

            <Section title="Safe to fix" empty="Nothing out of date.">
              {safe.map((f) => (
                <Item key={f.key} f={f} action={<Button onClick={() => setFixing(f)}>Bring up to date…</Button>} />
              ))}
            </Section>
            <Section title="Needs a person" empty="Nothing needs review.">
              {review.map((f) => (
                <Item key={f.key} f={f} action={f.webhookId ? <Link href="/admin/webhooks?filter=attention" className="text-sm font-medium text-accent underline underline-offset-2">Open in Webhook health</Link> : f.userId ? <Link href={`/admin/customers/${f.userId}`} className="text-sm font-medium text-accent underline underline-offset-2">Open customer</Link> : null} />
              ))}
            </Section>
            <p className="text-xs text-muted">Nothing here changes amounts, charges, refunds or minutes by itself. The one automatic-style fix only updates a status that is already out of date.</p>
            {fixing && (
              <ActionDialog
                title="Bring this record up to date?"
                description={<>{fixing.detail} Only the stored plan status changes. No minutes, charges or refunds are affected.</>}
                confirmLabel="Update record"
                onClose={() => setFixing(null)}
                onSubmit={async (v) => {
                  await adminPost("/api/admin/reconciliation", { kind: fixing.kind, userId: fixing.userId, reason: v.reason });
                  res.reload();
                }}
              />
            )}
          </div>
        );
      }}
    </ResourceBoundary>
  );
}

function Section({ title, empty, children }: { title: string; empty: string; children: React.ReactNode[] }) {
  return (
    <section aria-label={title} className="space-y-3">
      <h2 className="text-sm font-semibold">{title}</h2>
      {children.length === 0 ? <Card><EmptyState title={empty} /></Card> : <ul className="space-y-3">{children}</ul>}
    </section>
  );
}

function Item({ f, action }: { f: Data["findings"][number]; action: React.ReactNode }) {
  return (
    <li className="rounded-xl border border-border bg-background p-4 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="flex flex-wrap items-center gap-2 font-medium">{f.summary} <Badge tone={f.severity === "safe_to_fix" ? "info" : "warning"}>{f.severity === "safe_to_fix" ? "Safe to fix" : "Needs review"}</Badge></p>
          {f.email && <p className="text-muted">{f.email}</p>}
          <p className="max-w-2xl text-muted">{f.detail}</p>
        </div>
        <div className="shrink-0">{action}</div>
      </div>
    </li>
  );
}
