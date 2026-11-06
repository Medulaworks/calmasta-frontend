"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { ToastStack, useToasts } from "@/components/ui/toast";
import { type Json, adminPatch, fmtUtc } from "@/lib/admin-client";
import { capability } from "@/lib/admin-capabilities";
import type { AdminSetting, AdminSettings } from "@/lib/admin-types";
import { formatSetting, fromDisplay, toDisplay, unitLabel } from "@/lib/admin-units";
import { ApiError } from "@/lib/upload-client";
import { ActionDialog, Notice, ResourceBoundary, useResource } from "./ui";

type Data = Json<AdminSettings>;
type Setting = Json<AdminSetting>;
type Value = string | number | boolean;

const APPLY: Record<Setting["applyMode"], { label: string; tone: "success" | "info" | "warning" | "neutral" }> = {
  live: { label: "Applies right away", tone: "success" },
  pending: { label: "Applies within a minute or so", tone: "info" },
  restart_required: { label: "Needs the tech team to restart", tone: "warning" },
  operator_only: { label: "Only the tech team can change this", tone: "neutral" },
};
const SOURCE: Record<Setting["source"], string> = { default: "Standard value", environment: "Set up by the tech team", admin: "Changed by an admin" };

const shown = (s: Setting, v: Value) => (typeof v === "number" ? formatSetting(s.unit, v) : typeof v === "boolean" ? (v ? "On" : "Off") : String(v));

export function SettingsView() {
  const res = useResource<Data>("/api/admin/settings");
  return <ResourceBoundary resource={res}>{(d) => <Editor key={d.version} data={d} reload={res.reload} />}</ResourceBoundary>;
}

type NewSettings = { version: number; processingPaused: boolean; updatedAt: string | null; scope: string; adoption: string; editableKeys: string[]; recordingLimitsOverride?: unknown; bootstrapSettingsEditable: boolean };
function Editor({ data, reload }: { data: Data; reload: () => void }) {
  const can = capability("settings_edit");
  const toasts = useToasts("settings");
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [reviewing, setReviewing] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [paused, setPaused] = useState((data as unknown as NewSettings).processingPaused ?? false);
  const settingsList = (data as unknown as Data).settings;
  const groups = useMemo(() => {
    const m = new Map<string, Setting[]>();
    if (!Array.isArray(settingsList)) return [...m] as Array<[string, Setting[]]>;
    for (const s of settingsList) m.set(s.group, [...(m.get(s.group) ?? []), s]);
    return [...m];
  }, [settingsList]);
  const isNew = !Array.isArray((data as unknown as NewSettings & Data).settings);
  if (isNew) {
    const ns = data as unknown as NewSettings;
    return (
      <div className="space-y-6">
        <p className="text-sm text-muted">Version {ns.version} · scope {ns.scope} · adoption {ns.adoption} {ns.updatedAt ? `· updated ${fmtUtc(ns.updatedAt)}` : ""}</p>
        {!can.allowed && <Notice>{can.reason}</Notice>}
        {conflict && <Notice tone="warning"><span className="flex flex-wrap items-center justify-between gap-3">Version conflict — refetch before another deliberate edit.<Button onClick={() => { setConflict(false); reload(); }}>Reload settings</Button></span></Notice>}
        <Card><CardHeader title="Processing pause (shared database)" />
          <div className="space-y-3 p-5 text-sm">
            <label className="inline-flex items-center gap-2"><input type="checkbox" checked={paused} disabled={!can.allowed || !ns.editableKeys.includes("processingPaused")} onChange={(e) => setPaused(e.target.checked)} className="size-4" /> Paused</label>
            <p className="text-xs text-muted">Deliberate operator pause, not a quota change. Reads/callbacks/cancel/settlement remain available.</p>
          </div>
        </Card>
        {can.allowed && paused !== ns.processingPaused && (
          <ActionDialog title={paused ? "Pause processing?" : "Resume processing?"} description={`Version ${ns.version} → ${ns.version + 1}. Shared DB policy.`} confirmLabel={paused ? "Pause" : "Resume"} onClose={() => setPaused(ns.processingPaused)} onSubmit={async (v) => {
            try { await adminPatch("/api/admin/settings", { version: ns.version, processingPaused: paused, reason: v.reason }, { "Idempotency-Key": crypto.randomUUID().replace(/-/g, "").slice(0, 16).padEnd(8, "0") }); toasts.push({ tone: "success", message: "Settings saved." }); reload(); } catch (err) { if (err instanceof ApiError && (err as unknown as { code?: string }).code === "settings_version_conflict") setConflict(true); throw err; }
          }} />
        )}
        <Button variant="primary" disabled={!can.allowed || paused === ns.processingPaused} onClick={() => setReviewing(true)}>Review and save…</Button>
        {reviewing && <ActionDialog title="Save?" description={`processingPaused ${String(ns.processingPaused)} → ${String(paused)}`} confirmLabel="Save" onClose={() => setReviewing(false)} onSubmit={async (v) => {
          try { await adminPatch("/api/admin/settings", { version: ns.version, processingPaused: paused, reason: v.reason }, { "Idempotency-Key": crypto.randomUUID().replace(/-/g, "").slice(0, 16).padEnd(8, "0") }); toasts.push({ tone: "success", message: "Saved." }); reload(); } catch (err) { if (err instanceof ApiError && (err as unknown as { code?: string }).code === "settings_version_conflict") setConflict(true); throw err; }
        }} />}
        <ToastStack items={toasts.items} onDismiss={toasts.dismiss} />
      </div>
    );
  }

  const parsed = (s: Setting): { value: Value } | { error: string } | null => {
    const t = draft[s.key];
    if (t === undefined) return null;
    if (s.kind === "boolean") return t === "true" ? (s.value === true ? null : { value: true }) : s.value === false ? null : { value: false };
    if (s.kind === "integer" || s.kind === "decimal") {
      const n = fromDisplay(s.unit, t);
      if (n === null) return { error: "Enter a number." };
      if (s.min !== undefined && n < s.min) return { error: `At least ${formatSetting(s.unit, s.min)}.` };
      if (s.max !== undefined && n > s.max) return { error: `At most ${formatSetting(s.unit, s.max)}.` };
      return n === s.value ? null : { value: n };
    }
    if (s.kind === "string" && (t.trim().length < (s.min ?? 0) || t.length > (s.max ?? Infinity))) return { error: `${s.min ?? 0} to ${s.max ?? "any"} characters.` };
    return t === s.value ? null : { value: t };
  };

  const changes = data.settings.flatMap((s) => { const p = parsed(s); return p && "value" in p ? [{ s, value: p.value }] : []; });
  const invalid = data.settings.some((s) => { const p = parsed(s); return p && "error" in p; });
  const set = (key: string, v: string) => setDraft((d) => ({ ...d, [key]: v }));

  async function save(v: Record<string, string>) {
    try {
      await adminPatch("/api/admin/settings", { version: data.version, changes: Object.fromEntries(changes.map((c) => [c.s.key, c.value])), reason: v.reason });
    } catch (err) {
      if (err instanceof ApiError && err.code === "version_conflict") setConflict(true);
      throw err;
    }
    toasts.push({ tone: "success", message: `Saved ${changes.length} ${changes.length === 1 ? "change" : "changes"}.` });
    setDraft({});
    reload();
  }

  return (
    <div className="space-y-6">
      {data.updatedAt && <p className="text-sm text-muted">Last changed {fmtUtc(data.updatedAt)}{data.updatedBy ? ` by ${data.updatedBy}` : ""}.</p>}
      {!can.allowed && <Notice>{can.reason}</Notice>}
      {conflict && (
        <Notice tone="warning">
          <span className="flex flex-wrap items-center justify-between gap-3">Someone else changed these settings. Reload to see their changes.<Button onClick={() => { setConflict(false); setDraft({}); reload(); }}>Reload settings</Button></span>
        </Notice>
      )}

      {groups.map(([group, items]) => (
        <Card key={group}>
          <CardHeader title={group} />
          <ul className="divide-y divide-border">
            {items.map((s) => {
              const p = parsed(s);
              const locked = !can.allowed || !s.editable;
              const id = `set-${s.key}`;
              const text = draft[s.key] ?? (s.kind === "boolean" ? String(s.value) : typeof s.value === "number" ? String(toDisplay(s.unit, s.value)) : String(s.value));
              const apply = APPLY[s.applyMode];
              return (
                <li key={s.key} className="grid gap-3 px-5 py-4 md:grid-cols-[1fr_16rem] md:gap-6">
                  <div className="min-w-0 space-y-1.5">
                    <label htmlFor={id} className="text-sm font-medium">{s.label}</label>
                    {s.help && <p className="text-xs text-muted">{s.help}</p>}
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                      <span>{apply.label}</span><span aria-hidden>·</span><span>{SOURCE[s.source]}</span>
                      {p && "value" in p && <Badge tone="info">Edited</Badge>}
                    </p>
                    {s.reason && <p className="text-xs text-warning">{s.reason}</p>}
                    {p && "value" in p && <p className="text-xs text-muted">From {shown(s, s.value)} to {shown(s, p.value)}.</p>}
                  </div>
                  <div className="space-y-1">
                    {s.kind === "boolean" ? (
                      <label className="inline-flex items-center gap-2 text-sm">
                        <input id={id} type="checkbox" role="switch" disabled={locked} checked={text === "true"} onChange={(e) => set(s.key, String(e.target.checked))} className="size-4" />
                        {text === "true" ? "On" : "Off"}
                      </label>
                    ) : s.kind === "enum" ? (
                      <select id={id} disabled={locked} value={text} onChange={(e) => set(s.key, e.target.value)} className="block h-9 w-full rounded-lg border border-border bg-background px-3 text-sm disabled:opacity-60">
                        {(s.options ?? []).map((o) => <option key={o}>{o}</option>)}
                      </select>
                    ) : (
                      <div className="flex items-center gap-2">
                        <input id={id} type={s.kind === "string" ? "text" : "number"} inputMode={s.kind === "string" ? undefined : "decimal"} step="any" disabled={locked} value={text} aria-invalid={!!(p && "error" in p)} aria-describedby={p && "error" in p ? `${id}-e` : undefined} onChange={(e) => set(s.key, e.target.value)} className="block h-9 w-full min-w-0 rounded-lg border border-border bg-background px-3 text-sm tabular-nums disabled:opacity-60" />
                        {s.unit && <span className="shrink-0 text-xs text-muted">{unitLabel(s.unit)}</span>}
                      </div>
                    )}
                    {p && "error" in p && <p id={`${id}-e`} role="alert" className="text-xs text-danger">{p.error}</p>}
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      ))}

      {can.allowed && (
        <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-background px-4 py-3 shadow-lg">
          <p className="text-sm text-muted">{changes.length === 0 ? "No changes." : `${changes.length} ${changes.length === 1 ? "change" : "changes"} ready.`}</p>
          <div className="flex gap-2">
            <Button variant="ghost" disabled={Object.keys(draft).length === 0} onClick={() => setDraft({})}>Discard</Button>
            <Button variant="primary" disabled={changes.length === 0 || invalid} onClick={() => setReviewing(true)}>Review and save…</Button>
          </div>
        </div>
      )}

      {reviewing && (
        <ActionDialog
          title="Save these changes?"
          description={<ul className="space-y-1">{changes.map(({ s, value }) => <li key={s.key}><span className="font-medium text-foreground">{s.label}</span>: {shown(s, s.value)} → {shown(s, value)}</li>)}</ul>}
          confirmLabel="Save changes"
          onClose={() => setReviewing(false)}
          onSubmit={save}
        />
      )}
      <ToastStack items={toasts.items} onDismiss={toasts.dismiss} />
    </div>
  );
}
