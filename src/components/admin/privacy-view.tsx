"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type Json, adminPost, fmtUtc } from "@/lib/admin-client";
import type { PrivacyReport } from "@/lib/admin-types";
import { ActionDialog, DataTable, Notice, ResourceBoundary, Td, Th, useResource } from "./ui";

type Data = Json<PrivacyReport>;
const TONE: Record<string, "neutral" | "info" | "success" | "warning" | "danger"> = { requested: "info", in_progress: "info", partial_failure: "danger", completed: "success", cancelled: "neutral" };

export function PrivacyView() {
  const res = useResource<Data>("/api/admin/privacy");
  const [retrying, setRetrying] = useState<string | null>(null);
  return (
    <ResourceBoundary resource={res}>
      {(d) => (
        <div className="space-y-8">
          <Notice>
            A deletion is only shown as complete when every stored audio file is gone. We remove customer data from our own database and file storage. We don&rsquo;t promise instant removal from every provider or backup, so provider-side cleanup is outside what this page can confirm.
          </Notice>

          <section aria-labelledby="del" className="space-y-3">
            <h2 id="del" className="text-sm font-semibold">Deletion requests</h2>
            <DataTable label="Deletion requests">
              <thead><tr><Th>Requested</Th><Th>Customer</Th><Th>Status</Th><Th>Files</Th><Th>Tries</Th><Th>Problem</Th><Th><span className="sr-only">Action</span></Th></tr></thead>
              <tbody>
                {d.deletions.length === 0 && <tr><Td className="text-muted">No deletion requests.</Td><Td /><Td /><Td /><Td /><Td /><Td /></tr>}
                {d.deletions.map((x) => (
                  <tr key={x.id}>
                    <Td className="whitespace-nowrap">{fmtUtc(x.requestedAt)}{x.completedAt && <span className="block text-xs text-muted">Done {fmtUtc(x.completedAt)}</span>}</Td>
                    <Td>{x.customerId ? <Link href={`/dashboard/admin/customers/${x.customerId}`} className="text-accent underline underline-offset-2">{x.email}</Link> : <span title="The account is gone; only a fingerprint of the email remains">Removed · <code>{x.fingerprint}</code></span>}</Td>
                    <Td><Badge tone={TONE[x.status] ?? "neutral"}>{x.status.replace("_", " ")}</Badge></Td>
                    <Td className="tabular-nums">{x.filesRemoved} removed{x.filesFailed > 0 && <span className="block text-danger">{x.filesFailed} failed</span>}</Td>
                    <Td className="tabular-nums">{x.attempts}</Td>
                    <Td className="max-w-xs break-words text-muted">{x.lastError ?? "–"}{x.nextAttemptAt && x.status === "partial_failure" && <span className="block text-xs">Next try {fmtUtc(x.nextAttemptAt)}</span>}</Td>
                    <Td>{x.retry.allowed ? <Button onClick={() => setRetrying(x.id)}>Retry now</Button> : <span className="text-xs text-muted">{x.retry.reason}</span>}</Td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          </section>

          <section aria-labelledby="aud" className="space-y-3">
            <h2 id="aud" className="text-sm font-semibold">Staff action history</h2>
            <DataTable label="Staff actions">
              <thead><tr><Th>When</Th><Th>Who</Th><Th>Action</Th><Th>About</Th><Th>Reason</Th></tr></thead>
              <tbody>
                {d.audit.length === 0 && <tr><Td className="text-muted">No staff actions yet.</Td><Td /><Td /><Td /><Td /></tr>}
                {d.audit.map((a) => (
                  <tr key={a.id}>
                    <Td className="whitespace-nowrap">{fmtUtc(a.at)}</Td>
                    <Td>{a.actor ?? "–"}</Td>
                    <Td>{a.action.replace(/^admin_/, "").replaceAll("_", " ")}</Td>
                    <Td>{a.customerId ? <Link href={`/dashboard/admin/customers/${a.customerId}`} className="text-accent underline underline-offset-2"><code>{a.customerId.slice(0, 8)}</code></Link> : <code title={a.target ?? undefined}>{a.target ? a.target.slice(0, 8) : "–"}</code>}</Td>
                    <Td className="max-w-xs break-words text-muted">{a.reason ?? "–"}</Td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
            <p className="text-xs text-muted">Looking up a customer is recorded too. Entries stay when the person they were about deletes their account, without naming them.</p>
          </section>

          {retrying && (
            <ActionDialog
              title="Retry this deletion now?"
              description="It tries to remove the remaining files straight away instead of waiting for the next scheduled attempt. Nothing is reported as deleted until every file is gone."
              confirmLabel="Retry now"
              onClose={() => setRetrying(null)}
              onSubmit={async (v) => {
                await adminPost(`/api/admin/privacy/deletions/${retrying}/retry`, { reason: v.reason });
                res.reload();
              }}
            />
          )}
        </div>
      )}
    </ResourceBoundary>
  );
}
