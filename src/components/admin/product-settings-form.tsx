"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { type Json, adminPatch, fmtUtc } from "@/lib/admin-client";
import { capability } from "@/lib/admin-capabilities";
import { isValidDuration } from "@/lib/capture-admin-types";
import { ApiError } from "@/lib/upload-client";
import { ActionDialog, Notice } from "./ui";

type ProductValues = {
  defaultMeetingDurationSeconds: number;
  maxMeetingDurationSeconds: number;
  botDefaultName: string;
  freeMonthlySeconds: number | null;
  globalDailyLimitMicros: string | null;
};

type Data = {
  environment: string;
  version: number;
  values: ProductValues;
  updatedAt: string | null;
  adoption: { apiVersion: string; workerVersion: string; healthy: boolean; asOf: string };
};

export function ProductSettingsForm({ data, reload }: { data: Json<Data>; reload: () => void }) {
  const can = capability("settings_edit");
  const [draftDefaultMin, setDraftDefaultMin] = useState(() => String((data.values.defaultMeetingDurationSeconds ?? 600) / 60));
  const [draftMaxMin, setDraftMaxMin] = useState(() => String((data.values.maxMeetingDurationSeconds ?? 1200) / 60));
  const [reason, setReason] = useState("");
  const [conflict, setConflict] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const defaultSec = Math.round(Number(draftDefaultMin) * 60);
  const maxSec = Math.round(Number(draftMaxMin) * 60);
  const validation = Number.isFinite(defaultSec) && Number.isFinite(maxSec) ? isValidDuration(defaultSec, maxSec) : "Enter valid numbers.";
  const changed = defaultSec !== data.values.defaultMeetingDurationSeconds || maxSec !== data.values.maxMeetingDurationSeconds;

  async function doPreview() {
    if (validation) { setError(validation); return; }
    setError(null);
    try {
      const res = await fetch("/api/admin/settings/product/preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ expectedVersion: data.version, changes: { defaultMeetingDurationSeconds: defaultSec, maxMeetingDurationSeconds: maxSec } }) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Preview failed");
      setPreview(`Preview: ${defaultSec}s default → ${maxSec}s max. Affected pending operations: ${body.affectedPending ?? "unknown"}.`);
    } catch (e) { setError(e instanceof Error ? e.message : "Preview unavailable."); }
  }

  async function save() {
    if (validation) { setError(validation); return; }
    if (!reason.trim()) { setError("Reason is required."); return; }
    setSaving(true);
    setError(null);
    try {
      await adminPatch("/api/admin/settings/product", { expectedVersion: data.version, changes: { defaultMeetingDurationSeconds: defaultSec, maxMeetingDurationSeconds: maxSec }, reason: reason.trim() }, { "Idempotency-Key": crypto.randomUUID() });
      reload();
    } catch (e) {
      if (e instanceof ApiError && e.code === "version_conflict") setConflict(true);
      setError(e instanceof Error ? e.message : "Save failed.");
    } finally { setSaving(false); }
  }

  return (
    <div className="space-y-5">
      <Card><CardHeader title="Capture durations" />
        <div className="space-y-4 p-5 text-sm">
          <p className="text-xs text-muted">Version {data.version} · {data.environment} · adoption API {data.adoption.apiVersion} worker {data.adoption.workerVersion} {data.adoption.healthy ? "healthy" : "pending"} · as of {fmtUtc(data.adoption.asOf)}</p>
          {!can.allowed && <Notice>{can.reason ?? "Not allowed."}</Notice>}
          {conflict && <Notice tone="warning">Version conflict — latest values were loaded; review and save again. <Button size="sm" onClick={() => { setConflict(false); reload(); }}>Reload</Button></Notice>}
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2"><span className="text-sm font-medium">Default meeting duration (minutes)</span><input type="number" step="0.5" min={0.5} max={120} value={draftDefaultMin} onChange={(e) => setDraftDefaultMin(e.target.value)} disabled={!can.allowed} className="block h-10 w-full rounded-lg border border-border bg-background px-3 text-sm disabled:opacity-60" /><span className="text-xs text-muted">30 seconds … 120 minutes (7200s). Must be ≤ maximum.</span></label>
            <label className="space-y-2"><span className="text-sm font-medium">Maximum meeting duration (minutes)</span><input type="number" step="0.5" min={0.5} max={120} value={draftMaxMin} onChange={(e) => setDraftMaxMin(e.target.value)} disabled={!can.allowed} className="block h-10 w-full rounded-lg border border-border bg-background px-3 text-sm disabled:opacity-60" /><span className="text-xs text-muted">No 30-minute floor; minimum is 30 seconds. Changing does not extend active meetings.</span></label>
          </div>
          {validation && changed && <p role="alert" className="text-xs text-danger">{validation}</p>}
          {preview && <p className="rounded-lg border border-border bg-surface px-3 py-2 text-xs">{preview}</p>}
          {error && <p role="alert" className="text-xs text-danger">{error}</p>}
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" disabled={!can.allowed || !changed || !!validation} onClick={() => void doPreview()}>Preview</Button>
            <input placeholder="Reason for change" value={reason} onChange={(e) => setReason(e.target.value)} className="h-10 min-w-48 flex-1 rounded-lg border border-border bg-background px-3 text-sm" />
            <Button variant="primary" disabled={!can.allowed || !changed || !!validation || !reason.trim() || saving} onClick={() => void save()}>{saving ? "Saving…" : "Save"}</Button>
            <Button variant="ghost" onClick={() => { setDraftDefaultMin(String(data.values.defaultMeetingDurationSeconds / 60)); setDraftMaxMin(String(data.values.maxMeetingDurationSeconds / 60)); setPreview(null); setError(null); }}>Discard</Button>
          </div>
          <p className="text-xs text-muted">Effect: new captures use new limits; active bots keep their accepted deadline. Emergency stop is separate.</p>
        </div>
      </Card>
    </div>
  );
}
