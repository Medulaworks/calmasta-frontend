"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { type Json, adminPost, fmtUtc, shortId } from "@/lib/admin-client";
import { formatMinutes } from "@/lib/status";
import type { CustomerDetail, CustomerRow } from "@/lib/admin-types";
import { ActionDialog, DataTable, Notice, ResourceBoundary, Td, Th, useResource } from "./ui";

export function CustomerSearch({ basePath }: { basePath: string }) {
  const [q, setQ] = useState("");
  const [submitted, setSubmitted] = useState("");
  const res = useResource<{ customers: Json<CustomerRow>[] }>(submitted.trim().length >= 2 ? `/api/admin/customers?q=${encodeURIComponent(submitted.trim())}` : null);
  return (
    <div className="space-y-4">
      <form
        role="search"
        aria-label="Find a customer"
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitted(q);
        }}
        className="flex max-w-xl gap-2"
      >
        <label className="flex-1">
          <span className="sr-only">Email, name or customer id</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Email, name or customer id" maxLength={100} className="block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
        </label>
        <button type="submit" className="rounded-lg bg-accent-solid px-4 py-2 text-sm font-medium text-white hover:opacity-90">Search</button>
      </form>
      {submitted.trim().length === 1 && <p className="text-sm text-muted">Type at least two characters.</p>}
      {submitted.trim().length >= 2 && (
        <ResourceBoundary resource={res}>
          {({ customers }) =>
            customers.length === 0 ? (
              <Card><EmptyState title="No customers match" body="Check the spelling, or try the customer id." /></Card>
            ) : (
              <DataTable label="Matching customers">
                <thead><tr><Th>Customer</Th><Th>Plan</Th><Th>Joined</Th><Th>Id</Th></tr></thead>
                <tbody>
                  {customers.map((c) => (
                    <tr key={c.id}>
                      <Td><Link href={`${basePath}/${c.id}`} className="font-medium text-accent underline underline-offset-2">{c.email}</Link>{c.name && <span className="block text-xs text-muted">{c.name}</span>}</Td>
                      <Td className="capitalize">{c.plan}{c.planStatus === "none" ? "" : ` · ${c.planStatus.replace("_", " ")}`}</Td>
                      <Td className="whitespace-nowrap">{fmtUtc(c.createdAt)}</Td>
                      <Td><code title={c.id}>{shortId(c.id)}</code></Td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            )
          }
        </ResourceBoundary>
      )}
    </div>
  );
}

type Customer = Json<CustomerDetail>;
type Action = "grant" | "correct" | "grant_pro" | "clear_pro";

const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

export function CustomerDetail({ id }: { id: string }) {
  const res = useResource<Customer>(`/api/admin/customers/${id}`);
  const [action, setAction] = useState<Action | null>(null);

  const run = (a: Action) => async (v: Record<string, string>) => {
    const body: Record<string, unknown> = { action: a, reason: v.reason };
    if (v.minutes) body.minutes = Number(v.minutes);
    // Dates are picked as a day; the grant runs to the end of that day, UTC.
    if (v.expiresAt) body.expiresAt = `${v.expiresAt}T23:59:59.000Z`;
    await adminPost(`/api/admin/entitlements/${id}`, body);
    res.reload();
  };

  return (
    <ResourceBoundary resource={res}>
      {(c) => (
        <div className="space-y-6">
          {c.deletion && <Notice tone="warning">Deletion {c.deletion.status.replace("_", " ")}. Entitlement changes are disabled while an account is being deleted.</Notice>}
          <Card>
            <CardHeader title="Account" />
            <dl className="grid gap-x-6 gap-y-3 p-5 text-sm sm:grid-cols-2">
              <Row label="Email">{c.email} {c.emailVerified ? <Badge tone="success">Verified</Badge> : <Badge tone="warning">Unverified</Badge>}</Row>
              <Row label="Name">{c.name ?? "–"}</Row>
              <Row label="Customer id"><code className="break-all">{c.id}</code></Row>
              <Row label="Joined">{fmtUtc(c.createdAt)}</Row>
              <Row label="Time zone">{c.timezone}</Row>
              <Row label="Onboarding">{c.onboarded ? "Done" : "Not finished"}{c.outputsOnly ? " · outputs only" : ""}</Row>
              <Row label="Recordings">{c.counts.captures}</Row>
              <Row label="Documents">{c.counts.documents}</Row>
              <Row label="Booking pages / bookings">{c.counts.pages} / {c.counts.bookings}</Row>
            </dl>
            <p className="border-t border-border px-5 py-3 text-xs text-muted">Recordings, transcripts and documents are not shown here, and there is no way to sign in as a customer.</p>
          </Card>

          <Card>
            <CardHeader id="entitlements" title="Plan and minutes" />
            <div className="space-y-4 p-5 text-sm">
              <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                <Row label="Plan"><span className="capitalize">{c.plan.plan}</span>{c.plan.status === "none" ? " (no paid plan)" : ` · ${c.plan.status.replace("_", " ")}`}{c.plan.source ? ` · from ${c.plan.source}` : ""}</Row>
                <Row label="Store reference">{c.plan.storeReference ?? "–"}</Row>
                <Row label="Ends or renews">{fmtUtc(c.plan.graceUntil ?? c.plan.renewsAt)}</Row>
                <Row label="Used this month">{formatMinutes(c.allowance.usedMinutes)} of {formatMinutes(c.allowance.allowanceMinutes)}</Row>
                <Row label="Extra minutes left">{formatMinutes(c.allowance.purchasedMinutes)}</Row>
                <Row label="Can still use">{formatMinutes(c.allowance.remainingMinutes)} (resets {fmtUtc(c.allowance.resetsAt)})</Row>
              </dl>
              <Notice>These change what the customer can <strong>use</strong>. They never charge or refund anything: payments live in the store.</Notice>
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={!!c.deletion} onClick={() => setAction("grant")} className="rounded-lg border border-border px-4 py-2 font-medium hover:bg-surface disabled:opacity-50">Add minutes…</button>
                <button type="button" disabled={!!c.deletion} onClick={() => setAction("correct")} className="rounded-lg border border-border px-4 py-2 font-medium hover:bg-surface disabled:opacity-50">Take minutes back…</button>
                {c.plan.source === "staff" && c.plan.plan === "pro" ? (
                  <button type="button" onClick={() => setAction("clear_pro")} className="rounded-lg border border-danger/40 px-4 py-2 font-medium text-danger hover:bg-danger/10">End staff Pro grant…</button>
                ) : (
                  <button type="button" disabled={!!c.deletion || (c.plan.source !== "staff" && c.plan.plan === "pro")} onClick={() => setAction("grant_pro")} className="rounded-lg border border-border px-4 py-2 font-medium hover:bg-surface disabled:opacity-50" title={c.plan.plan === "pro" && c.plan.source !== "staff" ? "Pro comes from the store for this customer" : undefined}>Grant Pro until a date…</button>
                )}
              </div>
              <h3 className="pt-2 font-medium">Recent grants and corrections</h3>
              <DataTable label="Grants and corrections">
                <thead><tr><Th>When</Th><Th>Minutes</Th><Th>Kind</Th><Th>Ends</Th><Th>Reason or reference</Th></tr></thead>
                <tbody>
                  {c.grants.length === 0 && <tr><Td className="text-muted">None yet.</Td><Td /><Td /><Td /><Td /></tr>}
                  {c.grants.map((g) => (
                    <tr key={g.id}><Td className="whitespace-nowrap">{fmtUtc(g.createdAt)}</Td><Td className="tabular-nums">{g.minutes > 0 ? "+" : ""}{g.minutes}</Td><Td>{g.kind.replace("_", " ")}</Td><Td className="whitespace-nowrap">{fmtUtc(g.expiresAt)}</Td><Td className="max-w-xs break-words">{g.reason ?? g.reference ?? "–"}</Td></tr>
                  ))}
                </tbody>
              </DataTable>
            </div>
          </Card>

          <Card>
            <CardHeader title="Connections and recent activity" />
            <div className="space-y-4 p-5 text-sm">
              <div>
                <h3 className="font-medium">Calendar connections</h3>
                {c.connections.length === 0 ? <p className="text-muted">None.</p> : (
                  <ul className="mt-1 space-y-1">{c.connections.map((k) => <li key={k.id} className="flex items-center gap-2">{k.provider} · {k.calendars} calendars <Badge tone={k.status === "connected" ? "success" : "warning"}>{k.status === "connected" ? "Healthy" : "Needs reconnecting"}</Badge></li>)}</ul>
                )}
              </div>
              <div>
                <h3 className="font-medium">Recent jobs</h3>
                {c.recentJobs.length === 0 ? <p className="text-muted">None.</p> : (
                  <ul className="mt-1 space-y-1">{c.recentJobs.map((j) => <li key={j.id}><code title={j.id}>{shortId(j.id)}</code> {j.kind.replace("_", " ")} · {j.status.replace("_", " ")} · {fmtUtc(j.updatedAt)}</li>)}</ul>
                )}
              </div>
              <div>
                <h3 className="font-medium">Recent store events</h3>
                {c.recentStoreEvents.length === 0 ? <p className="text-muted">None.</p> : (
                  <ul className="mt-1 space-y-1">{c.recentStoreEvents.map((e) => <li key={e.id}>{fmtUtc(e.receivedAt)} · {e.note ?? "received"} · <code>{e.reference.slice(0, 12)}</code></li>)}</ul>
                )}
              </div>
            </div>
          </Card>

          {action === "grant" && <ActionDialog title="Add minutes" description="Adds minutes the customer can use until the end date. No charge is made." confirmLabel="Add minutes" fields={[{ name: "minutes", label: "Minutes", type: "number", min: 1, max: 6000 }, { name: "expiresAt", label: "Ends on", type: "date", defaultValue: inDays(30), hint: "Up to a year ahead. Ends at the end of that day, UTC." }]} onClose={() => setAction(null)} onSubmit={run("grant")} />}
          {action === "correct" && <ActionDialog danger title="Take minutes back" description="Removes minutes from what the customer can use, for example after a grant made by mistake. It does not refund anything." confirmLabel="Take minutes back" fields={[{ name: "minutes", label: "Minutes to remove", type: "number", min: 1, max: 6000 }]} onClose={() => setAction(null)} onSubmit={run("correct")} />}
          {action === "grant_pro" && <ActionDialog title="Grant Pro until a date" description="The customer gets the Pro allowance until the end date, then returns to Free with all their work. The store isn't involved and nothing is charged." confirmLabel="Grant Pro" fields={[{ name: "expiresAt", label: "Ends on", type: "date", defaultValue: inDays(30), hint: "Up to a year ahead. Ends at the end of that day, UTC." }]} onClose={() => setAction(null)} onSubmit={run("grant_pro")} />}
          {action === "clear_pro" && <ActionDialog danger title="End the staff Pro grant" description="The customer returns to Free straight away and keeps all their work." confirmLabel="End grant" onClose={() => setAction(null)} onSubmit={run("clear_pro")} />}
        </div>
      )}
    </ResourceBoundary>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 break-words">{children}</dd>
    </div>
  );
}
