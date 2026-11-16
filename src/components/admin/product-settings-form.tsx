"use client";
import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { fmtUtc } from "@/lib/admin-client";
import { capability } from "@/lib/admin-capabilities";
import { updatePolicy } from "@/lib/product-policy-client";
import { validateDurationChange, type EffectiveProductPolicy, type PolicyChange } from "@/lib/product-policy-types";
import { ApiError } from "@/lib/upload-client";
import { qk } from "@/lib/queries";
import { Notice, ResourceBoundary, useResource } from "./ui";

export function RecordingSettings() {
  const [draftPolicy, setDraftPolicy] = useState<EffectiveProductPolicy | null>(null);
  const resource = useResource<EffectiveProductPolicy>("/api/admin/settings/product", draftPolicy ? false : 2000);
  const queryClient = useQueryClient();
  const reload = () => {
    setDraftPolicy(null);
    queryClient.removeQueries({ queryKey: qk.capturePolicy(), type: "inactive" });
    void queryClient.invalidateQueries({ queryKey: qk.capturePolicy() });
    resource.reload();
  };
  const shown = draftPolicy ?? resource.data;
  const authError = resource.error instanceof ApiError && (resource.error.status === 401 || resource.error.status === 403);
  if (!shown || authError) return <ResourceBoundary resource={resource}>{() => null}</ResourceBoundary>;
  return <div className="space-y-3">
    <ResourceBoundary resource={resource}>{() => null}</ResourceBoundary>
    <ProductSettingsForm key={`${shown.environment}:${shown.version}`} data={shown} reload={reload} onEdited={() => setDraftPolicy(shown)} />
  </div>;
}

export function ProductSettingsForm({ data, reload, onEdited }: { data: EffectiveProductPolicy; reload: () => void; onEdited?: () => void }) {
  const can = capability("settings_edit");
  const capture = data.values.capture;
  const sharing = data.values.sharing ?? {
    publicLinksEnabled: false,
    recipientGrantsEnabled: false,
    invitationsEnabled: false,
    maxExpiryDays: null,
  };
  const [defaultMinutes, setDefaultMinutes] = useState(() => String(capture.defaultMeetingDurationSeconds / 60));
  const [maxMinutes, setMaxMinutes] = useState(() => String(capture.maxMeetingDurationSeconds / 60));
  const [videoEnabled, setVideoEnabled] = useState(capture.videoEnabled);
  const [processingEnabled, setProcessingEnabled] = useState(data.values.operations.processingEnabled);
  const [liveProcessingEnabled, setLiveProcessingEnabled] = useState(data.values.operations.liveProcessingEnabled ?? false);
  const [publicLinksEnabled, setPublicLinksEnabled] = useState(sharing.publicLinksEnabled);
  const [recipientGrantsEnabled, setRecipientGrantsEnabled] = useState(sharing.recipientGrantsEnabled);
  const [invitationsEnabled, setInvitationsEnabled] = useState(sharing.invitationsEnabled);
  const [maxExpiryDays, setMaxExpiryDays] = useState(() => sharing.maxExpiryDays != null ? String(sharing.maxExpiryDays) : "");
  const [reason, setReason] = useState("");
  const [conflict, setConflict] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const operation = useRef<{ fingerprint: string; key: string } | null>(null);
  const reasonInput = useRef<HTMLInputElement | null>(null);
  const defaultSeconds = Number(defaultMinutes) * 60;
  const maxSeconds = Number(maxMinutes) * 60;
  const durationValidation = validateDurationChange(defaultSeconds, maxSeconds);
  const parsedMaxDays = maxExpiryDays.trim() === "" ? null : Number(maxExpiryDays);
  const expiryValidation =
    maxExpiryDays.trim() !== "" && (!Number.isInteger(parsedMaxDays) || parsedMaxDays! < 1 || parsedMaxDays! > 365)
      ? "Maximum link expiry must be between 1 and 365 days, or blank."
      : null;
  const validation = durationValidation ?? expiryValidation;
  const captureChanged = defaultSeconds !== capture.defaultMeetingDurationSeconds || maxSeconds !== capture.maxMeetingDurationSeconds || videoEnabled !== capture.videoEnabled;
  const admissionChanged = processingEnabled !== data.values.operations.processingEnabled;
  const liveChanged = liveProcessingEnabled !== (data.values.operations.liveProcessingEnabled ?? false);
  const operationsChanged = admissionChanged || liveChanged;
  const sharingChanged =
    publicLinksEnabled !== sharing.publicLinksEnabled ||
    recipientGrantsEnabled !== sharing.recipientGrantsEnabled ||
    invitationsEnabled !== sharing.invitationsEnabled ||
    parsedMaxDays !== sharing.maxExpiryDays;
  const changed = captureChanged || operationsChanged || sharingChanged;
  const disabled = !can.allowed || saving || conflict;
  const changes: PolicyChange = {
    ...(captureChanged ? { capture: { defaultMeetingDurationSeconds: defaultSeconds, maxMeetingDurationSeconds: maxSeconds, videoEnabled } } : {}),
    ...(operationsChanged ? { operations: { ...(admissionChanged ? { processingEnabled } : {}), ...(liveChanged ? { liveProcessingEnabled } : {}) } } : {}),
    ...(sharingChanged ? {
      sharing: {
        ...(publicLinksEnabled !== sharing.publicLinksEnabled ? { publicLinksEnabled } : {}),
        ...(recipientGrantsEnabled !== sharing.recipientGrantsEnabled ? { recipientGrantsEnabled } : {}),
        ...(invitationsEnabled !== sharing.invitationsEnabled ? { invitationsEnabled } : {}),
        ...(parsedMaxDays !== sharing.maxExpiryDays ? { maxExpiryDays: parsedMaxDays } : {}),
      },
    } : {}),
  };

  function edited() { onEdited?.();setError(null); setSaved(false); }
  function failed(cause: unknown) {
    if (cause instanceof ApiError && cause.code === "version_conflict") setConflict(true);
    if (cause instanceof ApiError && cause.code === "bounded_free_required") {
      setError("A positive, bounded Free recording allowance must be configured before processing can be enabled.");
      return;
    }
    setError(cause instanceof Error ? cause.message : "Could not update recording settings.");
  }
  async function save() {
    if (disabled || validation || !changed || saved) return;
    if (!reason.trim()) {
      setError("Enter a reason for this change before saving.");
      reasonInput.current?.focus();
      return;
    }
    setSaving(true); setError(null); setSaved(false);
    const fingerprint = JSON.stringify({ version: data.version, changes, reason: reason.trim() });
    if (operation.current?.fingerprint !== fingerprint) operation.current = { fingerprint, key: crypto.randomUUID() };
    try {
      await updatePolicy(data.version, changes, reason.trim(), operation.current.key);
      operation.current = null;
      setSaved(true);
      reload();
    } catch (cause) { failed(cause); }
    finally { setSaving(false); }
  }

  return (
    <div className="space-y-5">
      <div id="settings-recording" className="scroll-mt-20">
        <Card>
          <CardHeader title="Recording defaults" description="Control processing, duration and video options for this environment." />
          <div className="space-y-4 p-5 text-sm">
            <p className="text-xs text-muted">Applies to {data.environment} · Version {data.version}{data.updatedAt ? ` · Updated ${fmtUtc(data.updatedAt)}` : ""}</p>
            {!can.allowed && <Notice>{can.reason ?? "You do not have permission to change recording settings."}</Notice>}
            {conflict && <Notice tone="warning">These settings were changed elsewhere. Your draft has been kept. Reload the latest settings before editing again. <Button size="sm" onClick={reload}>Reload recording settings</Button></Notice>}
            <div className="space-y-4 rounded-lg border border-border p-4">
              <h3 className="font-medium">Recording processing</h3>
              <div className="space-y-1">
                <label htmlFor="recording-processing-enabled" className="inline-flex items-center gap-2 font-medium">
                  <input id="recording-processing-enabled" type="checkbox" role="switch" checked={processingEnabled} onChange={event => { setProcessingEnabled(event.target.checked); edited(); }} disabled={disabled} className="size-4" />
                  Enable recording processing
                </label>
                <p className="text-xs text-muted">Allow new recording and processing work in {data.environment}, subject to the configured allowance and budget limits.</p>
              </div>
              <div className="space-y-1">
                <label htmlFor="recording-live-processing-enabled" className="inline-flex items-center gap-2 font-medium">
                  <input id="recording-live-processing-enabled" type="checkbox" role="switch" checked={liveProcessingEnabled} onChange={event => { setLiveProcessingEnabled(event.target.checked); edited(); }} disabled={disabled} className="size-4" />
                  Live provider processing
                </label>
                <p className="text-xs text-muted">Allow the worker to send meeting bots and process queued work using the configured providers. Applies automatically within a few seconds after saving, under the existing allowance and budget limits.</p>
                {data.liveProcessing?.requested && !data.liveProcessing.api?.enabled && !data.liveProcessing.api?.errorCode && <p role="status" className="text-xs text-muted">Checking the saved live-processing configuration…</p>}
                {data.liveProcessing?.requested && data.liveProcessing.api?.errorCode && <p role="status" className="text-xs text-warning">{data.liveProcessing.api.errorCode === "policy_unavailable" ? "The runtime could not read the saved policy. Live processing is disabled until it can read it again." : "Live processing needs provider or storage configuration. Check the integrations and runtime settings."}</p>}
              </div>
              <p className="text-xs text-muted">The separate platform-wide “Pause new work” switch must also be off for new work to start.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label htmlFor="recording-default-minutes" className="space-y-2">
                <span className="text-sm font-medium">Default recording minutes</span>
                <input id="recording-default-minutes" type="number" step="0.5" min={0.5} max={120} value={defaultMinutes} onChange={event => { setDefaultMinutes(event.target.value); edited(); }} disabled={disabled} className="block h-10 w-full rounded-lg border border-border bg-background px-3 text-sm disabled:opacity-60" />
                <span className="text-xs text-muted">Prefilled when a user starts a meeting. Must not exceed the maximum.</span>
              </label>
              <label htmlFor="recording-max-minutes" className="space-y-2">
                <span className="text-sm font-medium">Maximum recording minutes</span>
                <input id="recording-max-minutes" type="number" step="0.5" min={0.5} max={120} value={maxMinutes} onChange={event => { setMaxMinutes(event.target.value); edited(); }} disabled={disabled} className="block h-10 w-full rounded-lg border border-border bg-background px-3 text-sm disabled:opacity-60" />
                <span className="text-xs text-muted">The longest a user can request. Allowed range: 30 seconds to 120 minutes.</span>
              </label>
            </div>
            <div className="space-y-1">
              <label htmlFor="recording-video-enabled" className="inline-flex items-center gap-2 font-medium">
                <input id="recording-video-enabled" type="checkbox" role="switch" checked={videoEnabled} onChange={event => { setVideoEnabled(event.target.checked); edited(); }} disabled={disabled} className="size-4" />
                Allow video recording
              </label>
              <p className="text-xs text-muted">Users can choose “Also record the video” for new meetings when enabled. Audio recording remains available.</p>
            </div>
          </div>
        </Card>
      </div>

      <div id="settings-sharing" className="scroll-mt-20">
        <Card>
          <CardHeader title="Note sharing" description="Control snapshot sharing capabilities for meetings in this environment." />
          <div className="space-y-4 p-5 text-sm">
            <div className="space-y-3">
              <div className="space-y-1">
                <label htmlFor="sharing-public-links-enabled" className="inline-flex items-center gap-2 font-medium">
                  <input id="sharing-public-links-enabled" type="checkbox" role="switch" checked={publicLinksEnabled} onChange={event => { setPublicLinksEnabled(event.target.checked); edited(); }} disabled={disabled} className="size-4" />
                  Allow public links
                </label>
                <p className="text-xs text-muted">Allow users to generate view-only web links (&ldquo;Anyone with link&rdquo;) for published note snapshots.</p>
              </div>
              <div className="space-y-1">
                <label htmlFor="sharing-recipient-grants-enabled" className="inline-flex items-center gap-2 font-medium">
                  <input id="sharing-recipient-grants-enabled" type="checkbox" role="switch" checked={recipientGrantsEnabled} onChange={event => { setRecipientGrantsEnabled(event.target.checked); edited(); }} disabled={disabled} className="size-4" />
                  Allow recipient sharing
                </label>
                <p className="text-xs text-muted">Allow users to share note snapshots with specific verified recipient email addresses.</p>
              </div>
              <div className="space-y-1">
                <label htmlFor="sharing-invitations-enabled" className="inline-flex items-center gap-2 font-medium">
                  <input id="sharing-invitations-enabled" type="checkbox" role="switch" checked={invitationsEnabled} onChange={event => { setInvitationsEnabled(event.target.checked); edited(); }} disabled={disabled} className="size-4" />
                  Allow email invitations
                </label>
                <p className="text-xs text-muted">Allow sending email notifications to recipients when notes are shared.</p>
              </div>
              <label htmlFor="sharing-max-expiry-days" className="block space-y-1 pt-2">
                <span className="text-sm font-medium">Maximum link expiry (days)</span>
                <input id="sharing-max-expiry-days" type="number" min={1} max={365} value={maxExpiryDays} onChange={event => { setMaxExpiryDays(event.target.value); edited(); }} disabled={disabled} placeholder="No maximum limit (blank)" className="block h-10 w-full max-w-xs rounded-lg border border-border bg-background px-3 text-sm disabled:opacity-60" />
                <span className="text-xs text-muted">Leave blank for no mandatory maximum (users can choose any expiry or none). Allowed range: 1 to 365 days.</span>
              </label>
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <div className="space-y-3 p-5 text-sm">
          {validation && changed && <p role="alert" className="text-xs text-danger">{validation}</p>}
          <label htmlFor="recording-change-reason" className="block space-y-2">
            <span className="text-sm font-medium">Reason for change (required)</span>
            <input ref={reasonInput} id="recording-change-reason" value={reason} onChange={event => { onEdited?.();setReason(event.target.value);setError(null); }} maxLength={500} aria-required={true} disabled={disabled} placeholder="Explain this update" className="block h-10 w-full rounded-lg border border-border bg-background px-3 text-sm disabled:opacity-60" />
          </label>
          {error && <p role="alert" className="text-xs text-danger">{error}</p>}
          {saved && <p role="status" className="text-xs text-success">Recording settings saved.</p>}
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary" disabled={disabled || !changed || !!validation || saved} onClick={save}>{saving ? "Saving…" : "Save recording settings"}</Button>
          </div>
          <p className="text-xs text-muted">Changes are saved to this environment. Meetings already recording keep their accepted duration and video choice.</p>
        </div>
      </Card>
    </div>
  );
}
