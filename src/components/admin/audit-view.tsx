"use client";

import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ToastStack, useToasts } from "@/components/ui/toast";
import { type Json, fmtUtc } from "@/lib/admin-client";
import { actionLabel } from "@/lib/admin-words";
import type { AuditEntry, AuditPage } from "@/lib/admin-types";
import type { Tone } from "@/lib/status";
import { ClickRow, DetailsDialog } from "./row-menu";
import { AdminUnavailable, DataTable, FilterSelect, Notice, SearchField, Td, Th, usePaged } from "./ui";

type Page = Json<AuditPage>;
type Entry = Page["entries"][number];
const TONE: Record<AuditEntry["outcome"], Tone> = { success: "success", denied: "warning", failed: "danger" };
const RESULT: Record<AuditEntry["outcome"], string> = { success: "Done", denied: "Refused", failed: "Failed" };
const ACTIONS = ["Opened an account", "Added minutes", "Tried a task again", "Ran a store message again", "Changed settings", "Changed keys", "Suspended account", "Reactivated account", "Signed a user out everywhere", "Edited profile", "Sent a password reset email", "Sent a confirm email", "Tested a connection", "Invited an admin", "Resent an admin invite", "Cancelled an admin invite", "Removed an admin", "Changed a plan", "Changed a plan’s price", "Changed the yearly discount", "Added an extra-hours pack", "Changed an extra-hours pack", "Deleted an extra-hours pack"];
const friendly = (v: unknown) => {
  const d = v ? new Date(v as string) : null;
  return d && !Number.isNaN(d.getTime()) ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(d) : "Not recorded";
};
/** The server's field names have varied (at / createdAt, actor / actorEmail). Read whichever is there, never show a blank. */
const when = (e: Entry) => friendly(e.at ?? (e as unknown as { createdAt?: string; occurredAt?: string }).createdAt ?? (e as unknown as { occurredAt?: string }).occurredAt);
const who = (e: Entry) => e.actor ?? (e as unknown as { actorEmail?: string | null }).actorEmail ?? null;
const result = (e: Entry) => (e.outcome && RESULT[e.outcome] ? e.outcome : null);

/** Who did what, newest first. Click a row for the full note and the reference to quote when asking for help. */
export function AuditView() {
  const [q, setQ] = useState("");
  const [applied, setApplied] = useState({ q: "", outcome: "all", action: "all" });
  const [open, setOpen] = useState<Entry | null>(null);
  const toasts = useToasts("activity");

  const params = new URLSearchParams();
  if (applied.q) params.set("q", applied.q);
  if (applied.outcome !== "all") params.set("outcome", applied.outcome);
  if (applied.action !== "all") params.set("action", applied.action);
  const list = usePaged<Entry, Page & { items?: Entry[] }>(`/api/admin/audit${params.size ? `?${params}` : ""}`, (p) => (p as unknown as { items?: Entry[]; entries?: Entry[] }).items ?? (p as unknown as { entries: Entry[] }).entries ?? []);
  const { rows, status: state, message, more, hasMore, loadMore } = list;
  const filtered = applied.q !== "" || applied.outcome !== "all" || applied.action !== "all";


  if (state === "unavailable") return <AdminUnavailable />;
  return (
    <div className="space-y-4">
      <form role="search" aria-label="Search activity" onSubmit={(e) => { e.preventDefault(); setApplied((a) => ({ ...a, q: q.trim() })); }} className="flex flex-wrap items-center gap-2">
        <SearchField label="Search activity" placeholder="Search by person or what they did" value={q} onChange={setQ} />
        <FilterSelect label="Result" value={applied.outcome} onChange={(v) => setApplied((a) => ({ ...a, outcome: v }))} options={[{ value: "all", label: "Any" }, { value: "success", label: "Done" }, { value: "denied", label: "Refused" }, { value: "failed", label: "Failed" }]} />
        <FilterSelect label="Action" value={applied.action} onChange={(v) => setApplied((a) => ({ ...a, action: v }))} options={[{ value: "all", label: "Anything" }, ...ACTIONS.map((a) => ({ value: a, label: a }))]} />
        <Button type="submit" variant="primary" className="h-10">Search</Button>
        {filtered && <Button variant="ghost" className="h-10" onClick={() => { setQ(""); setApplied({ q: "", outcome: "all", action: "all" }); }}>Clear</Button>}
      </form>

      {state === "error" && <Notice tone="danger">{message}</Notice>}
      {state === "loading" && <div role="status" aria-label="Loading" aria-busy="true" className="h-48 jb-skel rounded-xl border border-border bg-surface" />}
      {state === "ready" && rows.length === 0 && <Card><EmptyState title="Nothing found" body="Try a different search, or clear the filters." /></Card>}
      {state === "ready" && rows.length > 0 && (
        <>
          <DataTable label="Activity">
            <thead><tr><Th>What happened</Th><Th>Who</Th><Th>When</Th><Th wide>Result</Th><Th><span className="sr-only">Details</span></Th></tr></thead>
            <tbody>
              {rows.map((e) => {
                const r = result(e);
                return (
                  <ClickRow key={e.id} onOpen={() => setOpen(e)}>
                    <Td className="font-medium">{actionLabel(e.action)}{e.target && <span className="block text-xs font-normal text-muted">{e.target}</span>}</Td>
                    <Td className="whitespace-nowrap">{who(e) ?? <span className="text-muted">Joobah (automatic)</span>}</Td>
                    <Td className="whitespace-nowrap text-muted">{when(e)}</Td>
                    <Td wide>{r ? <Badge tone={TONE[r]}>{RESULT[r]}</Badge> : <span className="text-muted">–</span>}</Td>
                    <td className="w-10 border-b border-border px-2 py-2 text-right align-middle">
                      <button type="button" onClick={() => setOpen(e)} aria-label={`See details: ${actionLabel(e.action)}`} className="grid size-8 place-items-center rounded-lg text-muted transition-colors hover:bg-surface hover:text-foreground"><ChevronRight aria-hidden className="size-4" /></button>
                    </td>
                  </ClickRow>
                );
              })}
            </tbody>
          </DataTable>
          <div className="flex items-center justify-between text-xs text-muted">
            <span>Showing the latest {rows.length}{hasMore ? " (more available)" : ""}. Select a row to see all of its details.</span>
            {hasMore && <Button onClick={() => void loadMore()} disabled={more}>{more ? "Loading…" : "Show more"}</Button>}
          </div>
        </>
      )}

      {open && (
        <DetailsDialog
          title={actionLabel(open.action)}
          onClose={() => setOpen(null)}
          rows={[
            ["When", `${when(open)}${open.at ? ` (${fmtUtc(open.at)})` : ""}`],
            ["Who", who(open) ?? "Joobah (automatic)"],
            ["Result", result(open) ? RESULT[result(open)!] : "Not recorded"],
            ["Technical name", <code key="a" className="text-xs">{open.action}</code>],
            ["About", open.customerId ? <code key="c" className="break-all text-xs">{open.customerId}</code> : open.target ?? "–"],
            ["Why", open.reason ?? "No reason given"],
            ...(open.correlationId ? [["Reference (quote this when asking for help)", <code key="r" className="break-all text-xs">{open.correlationId}</code>] as [string, React.ReactNode]] : []),
          ]}
          actions={open.customerId ? <a href={`/admin/customers/${open.customerId}`} className="inline-flex min-h-9 items-center rounded-lg border border-border px-4 text-sm font-medium hover:bg-surface">Open account</a> : null}
        />
      )}
      <ToastStack items={toasts.items} onDismiss={toasts.dismiss} />
    </div>
  );
}
