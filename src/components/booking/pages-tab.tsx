"use client";

import { Copy, ExternalLink, Link2 } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Confirm, ErrorBox, Field, field } from "@/components/booking/form-bits";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
      setLocalError(err instanceof Error ? err.message : "Could not save.");
    }
  }
  async function remove() {
    if (!confirmDelete) return;
    try {
      await delM.mutateAsync(confirmDelete.id);
      setConfirmDelete(null);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Could not delete.");
    }
  }
  async function copy(slug: string) {
    try {
      await navigator.clipboard.writeText(`${origin}/book/${slug}`);
      setCopied(slug);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setLocalError("Couldn't copy. Select the link and copy it yourself.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted">A booking page is a link you share. Guests choose a meeting type and a time, with no account needed.</p>
        {editing === null && <Button variant="primary" onClick={() => open("new")}>New page</Button>}
      </div>
      <ErrorBox message={editing ? null : error} />
      {confirmDelete && <Confirm title={`Delete “${confirmDelete.title}”?`} text="The link stops working and its meeting types are deleted. Bookings already made are kept." action="Delete page" busy={busy} onConfirm={() => void remove()} onCancel={() => setConfirmDelete(null)} />}

      {editing && (
        <Card>
          <CardHeader title={editing === "new" ? "New booking page" : "Edit booking page"} />
          <form onSubmit={save} className="space-y-4 p-5">
            <Field label="Title"><input value={form.title} maxLength={120} required onChange={(e) => setForm({ ...form, title: e.target.value, slug: editing === "new" && (!form.slug || form.slug === slugify(form.title)) ? slugify(e.target.value) : form.slug })} className={field} /></Field>
            <Field label="Link" hint="3 to 40 lowercase letters, numbers or hyphens. This is what you share.">
              <div className="mt-1 flex items-center rounded-lg border border-border bg-background text-sm">
                <span className="px-3 text-muted">{origin.replace(/^https?:\/\//, "")}/book/</span>
                <input value={form.slug} maxLength={40} required onChange={(e) => setForm({ ...form, slug: slugify(e.target.value) })} className="min-w-0 flex-1 bg-transparent py-2 pr-3 outline-none" />
              </div>
            </Field>
            <Field label="Description" hint="Shown to guests above the times."><textarea value={form.description} maxLength={2000} rows={3} onChange={(e) => setForm({ ...form, description: e.target.value })} className={field} /></Field>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="h-4 w-4" /> Accepting bookings <span className="text-muted">(switch off to hide the page)</span></label>
            <ErrorBox message={error} />
            <div className="flex gap-2"><Button variant="primary" type="submit" disabled={busy}>{busy ? "Saving…" : "Save page"}</Button><Button variant="ghost" type="button" disabled={busy} onClick={() => setEditing(null)}>Cancel</Button></div>
          </form>
        </Card>
      )}

      <Card>
        {pages === null ? (
          <div aria-hidden className="p-5"><div className="h-4 w-1/3 jb-skel rounded bg-border" /></div>
        ) : pages.length === 0 ? (
          <EmptyState icon={<Link2 className="h-5 w-5" />} title="No booking pages yet" body="Create a page, add a meeting type and your hours, and share the link." action={<Button variant="primary" onClick={() => open("new")}>Create a page</Button>} />
        ) : (
          <ul className="divide-y divide-border">
            {pages.map((p: import("@/lib/booking-client").PageView) => (
              <li key={p.id} className="space-y-2 px-5 py-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2"><p className="font-medium">{p.title}</p><Badge tone={p.active ? "success" : "neutral"}>{p.active ? "Live" : "Off"}</Badge></div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" onClick={() => void copy(p.slug)}><Copy aria-hidden className="h-4 w-4" /> {copied === p.slug ? "Copied" : "Copy link"}</Button>
                    <a href={`/book/${p.slug}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-surface"><ExternalLink aria-hidden className="h-4 w-4" /> Preview</a>
                    <Button variant="ghost" onClick={() => open(p)}>Edit</Button>
                    <Button variant="ghost" onClick={() => setConfirmDelete(p)}>Delete</Button>
                  </div>
                </div>
                <p className="font-mono text-xs text-muted">{origin}/book/{p.slug}</p>
                {p.active && p.activeMeetingTypes === 0 && <p className="text-xs text-warning">This page has no active meeting types yet, so guests will see it as unavailable. Add one in the Meeting types tab.</p>}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
