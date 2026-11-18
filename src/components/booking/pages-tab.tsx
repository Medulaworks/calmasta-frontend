"use client";

import { CalendarIllustration } from "@/components/ui/illustrations";
import { Check, Copy, ExternalLink, Link2, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Confirm, ErrorBox, Field, field } from "@/components/booking/form-bits";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClass } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { type PageView } from "@/lib/booking-client";
import { useDeletePageM, useSavePageM } from "@/lib/mutations";
import { pagesQuery } from "@/lib/queries";

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);

export function PagesTab() {
  const pagesQ = useQuery(pagesQuery);
  const pages = pagesQ.data ?? null;
  const qError = pagesQ.error ? (pagesQ.error as Error).message : null;
  const saveM = useSavePageM();
  const delM = useDeletePageM();
  const [editing, setEditing] = useState<PageView | "new" | null>(null);
  const [form, setForm] = useState({ title: "", slug: "", description: "", active: true });
  const [localError, setLocalError] = useState<string | null>(null);
  const error = localError ?? qError;
  const busy = saveM.isPending || delM.isPending;
  const [confirmDelete, setConfirmDelete] = useState<PageView | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const origin = typeof window === "undefined" ? "" : window.location.origin;

  function open(p: PageView | "new") {
    setEditing(p);
    setLocalError(null);
    setForm(p === "new" ? { title: "", slug: "", description: "", active: true } : { title: p.title, slug: p.slug, description: p.description, active: p.active });
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setLocalError(null);
    try {
      await saveM.mutateAsync({ input: form, id: editing === "new" || !editing ? undefined : editing.id });
      setEditing(null);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "We couldn’t save. Please try again.");
    }
  }
  async function remove() {
    if (!confirmDelete) return;
    try {
      await delM.mutateAsync(confirmDelete.id);
      setConfirmDelete(null);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "We couldn’t delete. Please try again.");
    }
  }
  async function copy(slug: string) {
    try {
      await navigator.clipboard.writeText(`${origin}/book/${slug}`);
      setCopied(slug);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setLocalError("Couldn’t copy. Select the link and copy it yourself.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-sm text-muted">A booking page is a link you share. Guests choose a meeting type and a time, with no account needed.</p>
        {editing === null && <Button variant="primary" onClick={() => open("new")}>New page</Button>}
      </div>
      <ErrorBox message={editing ? null : error} />
      {confirmDelete && <Confirm title={`Delete “${confirmDelete.title}”?`} text="The link stops working and its meeting types are deleted. Bookings already made are kept." action="Delete page" busy={busy} onConfirm={() => void remove()} onCancel={() => setConfirmDelete(null)} />}

      {editing && (
        <Card>
          <CardHeader title={editing === "new" ? "New booking page" : "Edit booking page"} />
          <form onSubmit={save} className="space-y-5 p-5">
            <Field label="Title"><input value={form.title} maxLength={120} required onChange={(e) => setForm({ ...form, title: e.target.value, slug: editing === "new" && (!form.slug || form.slug === slugify(form.title)) ? slugify(e.target.value) : form.slug })} className={field} /></Field>
            <Field label="Link" hint="3 to 40 lowercase letters, numbers or hyphens. This is what you share.">
              <div className="mt-2 flex items-center rounded-xl border border-border bg-background text-sm shadow-sm focus-within:border-accent focus-within:ring-4 focus-within:ring-accent-solid/20">
                <span className="pl-4 text-muted">{origin.replace(/^https?:\/\//, "")}/book/</span>
                <input value={form.slug} maxLength={40} required onChange={(e) => setForm({ ...form, slug: slugify(e.target.value) })} className="min-h-10 min-w-0 flex-1 bg-transparent py-2 pr-4 outline-none" />
              </div>
            </Field>
            <Field label="Description" hint="Shown to guests above the times."><textarea value={form.description} maxLength={2000} rows={3} onChange={(e) => setForm({ ...form, description: e.target.value })} className={field} /></Field>
            <label className="flex items-start gap-3 rounded-xl bg-surface p-4 text-sm">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="mt-1 size-4 accent-[var(--accent-solid)]" />
              <span><span className="font-medium">Accepting bookings</span><span className="block text-xs text-muted">Switch off to hide the page.</span></span>
            </label>
            <ErrorBox message={error} />
            <div className="flex flex-wrap gap-3"><Button variant="primary" type="submit" disabled={busy}>{busy ? "Saving…" : "Save page"}</Button><Button variant="ghost" type="button" disabled={busy} onClick={() => setEditing(null)}>Cancel</Button></div>
          </form>
        </Card>
      )}

      {pages === null ? (
        <div aria-hidden className="grid gap-4 md:grid-cols-2">{[0, 1].map((i) => <div key={i} className="h-40 jb-skel rounded-2xl border border-border bg-surface" />)}</div>
      ) : pages.length === 0 ? (
        <Card><EmptyState illustration={<CalendarIllustration />} title="No booking pages yet" body="Create a page, add a meeting type and your hours, and share the link." action={<Button variant="primary" onClick={() => open("new")}>Create a page</Button>} /></Card>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {pages.map((p: import("@/lib/booking-client").PageView) => (
            <li key={p.id} className="flex flex-col gap-4 rounded-2xl border border-border bg-background p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-solid/15 text-accent"><Link2 className="size-5" /></span>
                  <p className="truncate text-base font-semibold">{p.title}</p>
                </div>
                <Badge tone={p.active ? "success" : "neutral"}>{p.active ? "Live" : "Off"}</Badge>
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-border bg-surface py-1 pl-4 pr-1">
                <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted">{origin.replace(/^https?:\/\//, "")}/book/{p.slug}</span>
                <Button size="sm" variant="secondary" onClick={() => void copy(p.slug)}>{copied === p.slug ? <Check aria-hidden className="size-4 text-success" strokeWidth={3} /> : <Copy aria-hidden className="size-4" />} {copied === p.slug ? "Copied" : "Copy"}</Button>
              </div>
              {p.active && p.activeMeetingTypes === 0 && <p className="rounded-xl bg-warning/10 px-4 py-3 text-xs text-warning">No active meeting types yet, so guests will see this page as unavailable. Add one in the Meeting types tab.</p>}
              <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-border pt-4">
                <a href={`/book/${p.slug}`} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary", "", "sm")}><ExternalLink aria-hidden className="size-4" /> Preview</a>
                <Button size="sm" variant="ghost" onClick={() => open(p)}><Pencil aria-hidden className="size-4" /> Edit</Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(p)} className="ml-auto text-danger"><Trash2 aria-hidden className="size-4" /> Delete</Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
