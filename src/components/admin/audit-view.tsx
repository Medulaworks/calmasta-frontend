"use client";

import { Search } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ToastStack, useToasts } from "@/components/ui/toast";
import { type Json, fmtUtc } from "@/lib/admin-client";
import type { AuditEntry, AuditPage } from "@/lib/admin-types";
import type { Tone } from "@/lib/status";
import { ClickRow, DetailsDialog, MenuTd, RowMenu, RowOpen } from "./row-menu";
import { AdminUnavailable, DataTable, Notice, Td, Th, usePaged } from "./ui";

type Page = Json<AuditPage>;
type Entry = Page["entries"][number];
const TONE: Record<AuditEntry["outcome"], Tone> = { success: "success", denied: "warning", failed: "danger" };
const RESULT: Record<AuditEntry["outcome"], string> = { success: "Done", denied: "Refused", failed: "Failed" };
const ACTIONS = ["Opened an account", "Added minutes", "Tried a task again", "Ran a store message again", "Changed settings", "Changed keys", "Suspended account", "Reactivated account", "Signed a user out everywhere", "Edited profile", "Sent a password reset email", "Sent a confirm email", "Tested a connection", "Invited an admin", "Resent an admin invite", "Cancelled an admin invite", "Removed an admin", "Changed a plan", "Changed a plan's price", "Changed the yearly discount", "Added an extra-hours pack", "Changed an extra-hours pack", "Deleted an extra-hours pack"];
const field = "h-9 rounded-lg border border-border bg-background px-3 text-sm";

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

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toasts.push({ tone: "success", message: "Copied." });
    } catch {
      toasts.push({ tone: "warning", message: "Couldn’t copy. Select it from the details instead." });
    }
  }
  const menu = (e: Entry) => [
    { label: "See details", onSelect: () => setOpen(e) },
    ...(e.customerId ? [{ label: "Open account", href: `/admin/customers/${e.customerId}` }] : []),
    { label: "Copy reference", onSelect: () => void copy(e.correlationId), divider: true },
  ];

  if (state === "unavailable") return <AdminUnavailable />;
  return (
    <div className="space-y-4">
      <form role="search" aria-label="Search activity" onSubmit={(e) => { e.preventDefault(); setApplied((a) => ({ ...a, q: q.trim() })); }} className="flex flex-wrap items-center gap-2">
        <label className="min-w-48 flex-1 sm:max-w-sm">
          <span className="sr-only">Search activity</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by person or what they did" maxLength={100} className={`${field} block w-full`} />
        </label>
        <label><span className="sr-only">Result</span>
          <select value={applied.outcome} onChange={(e) => setApplied((a) => ({ ...a, outcome: e.target.value }))} className={field}>
            <option value="all">Any result</option><option value="success">Done</option><option value="denied">Refused</option><option value="failed">Failed</option>
          </select>
        </label>
        <label><span className="sr-only">What was done</span>
          <select value={applied.action} onChange={(e) => setApplied((a) => ({ ...a, action: e.target.value }))} className={field}>
            <option value="all">Anything</option>{ACTIONS.map((a) => <option key={a}>{a}</option>)}
          </select>
        </label>
        <Button type="submit"><Search aria-hidden className="size-4" /> Search</Button>
        {filtered && <Button variant="ghost" onClick={() => { setQ(""); setApplied({ q: "", outcome: "all", action: "all" }); }}>Clear</Button>}
      </form>

      {state === "error" && <Notice tone="danger">{message}</Notice>}
      {state === "loading" && <div role="status" aria-label="Loading" aria-busy="true" className="h-48 jb-skel rounded-xl border border-border bg-surface" />}
      {state === "ready" && rows.length === 0 && <Card><EmptyState title="Nothing found" body="Try a different search, or clear the filters." /></Card>}
      {state === "ready" && rows.length > 0 && (
        <>
          <DataTable label="Activity">
            <thead><tr><Th>When</Th><Th wide>Who</Th><Th>What</Th><Th>Result</Th><Th><span className="sr-only">Actions</span></Th></tr></thead>
            <tbody>
              {rows.map((e) => (
                <ClickRow key={e.id} onOpen={() => setOpen(e)}>
                  <Td className="whitespace-nowrap"><RowOpen onOpen={() => setOpen(e)}>{fmtUtc(e.at)}</RowOpen></Td>
                  <Td wide>{e.actor ?? "System"}</Td>
                  <Td>{e.action}</Td>
                  <Td><Badge tone={TONE[e.outcome]}>{RESULT[e.outcome]}</Badge></Td>
                  <MenuTd><RowMenu label="Actions for this entry" items={menu(e)} /></MenuTd>
                </ClickRow>
              ))}
            </tbody>
          </DataTable>
          <div className="flex items-center justify-between text-xs text-muted">
            <span>Showing {rows.length}{hasMore ? " so far" : ""}</span>
            {hasMore && <Button onClick={() => void loadMore()} disabled={more}>{more ? "Loading…" : "Show more"}</Button>}
          </div>
        </>
      )}

      {open && (
        <DetailsDialog
          title={open.action}
          onClose={() => setOpen(null)}
          rows={[
            ["When", fmtUtc(open.at)],
            ["Who", open.actor ?? "System"],
            ["Result", RESULT[open.outcome]],
            ["About", open.customerId ? <code key="c" className="break-all text-xs">{open.customerId}</code> : open.target ?? "–"],
            ["Why", open.reason ?? "No reason given"],
            ["Reference (quote this when asking for help)", <code key="r" className="break-all text-xs">{open.correlationId}</code>],
          ]}
          actions={open.customerId ? <a href={`/admin/customers/${open.customerId}`} className="inline-flex min-h-9 items-center rounded-lg border border-border px-4 text-sm font-medium hover:bg-surface">Open account</a> : null}
        />
      )}
      <ToastStack items={toasts.items} onDismiss={toasts.dismiss} />
    </div>
  );
}
