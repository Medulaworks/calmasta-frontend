"use client";

import { useCallback, useRef, useState } from "react";
import { ChevronDown, Clock3, History } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { adminPatch, adminPost, fmtUtc } from "@/lib/admin-client";
import { ApiError } from "@/lib/upload-client";
import { capability } from "@/lib/admin-capabilities";
import { ActionDialog, Notice, ResourceBoundary, useResource, usePaged, DataTable, Th, Td } from "./ui";
import { ToastStack, useToasts } from "@/components/ui/toast";

const TITLE_MAP: Record<string, string> = {
  recall: "Recall",
  assemblyai: "AssemblyAI",
  openrouter: "OpenRouter",
  woo: "WooCommerce",
  mail: "Email",
  oauth_google: "Google Sign-in",
  oauth_microsoft: "Microsoft Sign-in",
  calendar_google: "Google Calendar",
  calendar_microsoft: "Microsoft Calendar",
};
const toTitle = (id: string) => TITLE_MAP[id] ?? id.split(/[_-]/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
const toStatusLabel = (s: string) => s.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

type AdoptionService = { service: string; state: string; managed?: boolean; errorCode?: string | null };
type CredentialCheckResult = { status: "pending" | "passed" | "failed" | "superseded"; code: string; version: number; checkedAt?: string | null; isCurrent?: boolean; scope?: string };
type CredentialTest = { supported: boolean; scope: string; kind: string; appliedVersion: number | null; canTest: boolean; reason: string | null; latest: CredentialCheckResult | null };
type Profile = { id: string; configured: boolean; version: number; activeVersion: number | null; updatedAt: string | null; effectiveStatus: string; providerConnectivity: string; adoption?: { services?: AdoptionService[] }; credentialTest?: CredentialTest };
type Profiles = { runtimeAvailable?: boolean; environment: string; replacementEnabled: boolean; items: Profile[] };
const TEST_MESSAGES: Record<string, string> = {
  smtp_authentication_verified: "SMTP connection and authentication succeeded. No email was sent.",
  smtp_connection_verified: "SMTP connection succeeded. No SMTP login is configured, so authentication was not tested.",
  smtp_delivery_accepted: "SMTP accepted the diagnostic email. Inbox placement is not guaranteed.",
  smtp_delivery_rejected: "SMTP rejected the sender or recipient. Check the applied sender and the sample recipient.",
  api_access_verified: "Read-only API access succeeded.", authentication_failed: "Authentication was rejected. Check the applied credentials.",
  access_denied: "These credentials do not have access to this API.", provider_unavailable: "The provider is unavailable. Try again later.",
  invalid_provider_response: "The provider returned an unexpected response.", check_timed_out: "Connection to the email server timed out after 5 seconds. Please check your SMTP host, port, and firewall.",
  connection_failed: "We couldn’t connect using the applied configuration. Please try again.", configuration_missing: "The applied configuration is incomplete.",
  applied_version_changed: "The version changed during this check. Test again after application finishes.", test_pending: "This test has not finished. Try again in 30 seconds.",
  applied_version_required: "Wait until the active version is applied to the API before testing.", integration_test_rate_limited: "Wait 30 seconds before starting another test for this service.",
};
const testLimit = (id: string) => id === "mail" ? "Sends one fixed diagnostic email to the sample recipient you provide. Success proves SMTP acceptance, not inbox placement." : id === "openrouter" ? "Checks API key authentication only. Does not generate content or verify model access and available credit." : "Checks read-only WooCommerce API access. Does not create a payment or verify checkout, subscriptions or webhook signing.";
const key = () => crypto.randomUUID().replace(/-/g, "").slice(0, 16).padEnd(8, "0");

export function IntegrationsView() {
  const [editing, setEditing] = useState<Profile | null>(null);
  const [activating, setActivating] = useState<Profile | null>(null);
  const [historyId, setHistoryId] = useState<string | null>(null);
  const [mailTest, setMailTest] = useState<Profile | null>(null);
  // No background poll while a dialog is open: it would churn the page under
  // half-typed values. Saving or closing reloads explicitly.
  const modalOpen = editing !== null || activating !== null || historyId !== null || mailTest !== null;
  const res = useResource<Profiles>("/api/admin/integration-profiles", modalOpen ? false : 5000);
  const toasts = useToasts("integrations");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggleCard = (id: string) => setExpanded(current => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const closeHistory = useCallback(() => setHistoryId(null), []);
  const replace = capability("integration_replace");
  const check = capability("integration_check");
  const [testing, setTesting] = useState<Set<string>>(new Set());
  const busyTests = useRef(new Set<string>());
  const runCredentialTest = async (profile: Profile, reason: string, recipientEmail?: string, keepDialogOnError = false) => {
    const appliedVersion = profile.credentialTest?.appliedVersion;
    if (!check.allowed || !profile.credentialTest?.canTest || !appliedVersion || busyTests.current.has(profile.id)) return;
    busyTests.current.add(profile.id);setTesting(current => new Set(current).add(profile.id));
    try {
      const result = await adminPost<CredentialCheckResult>(`/api/admin/integration-profiles/${profile.id}/test`, { expectedVersion: appliedVersion, reason, ...(recipientEmail ? { recipientEmail } : {}) }, { "Idempotency-Key": key() });
      const tone = result.status === "passed" && result.version === appliedVersion ? "success" : result.status === "pending" ? "info" : result.status === "superseded" ? "warning" : "danger";
      const outcome = result.status === "passed" && result.version === appliedVersion ? "test succeeded" : "test failed";
      toasts.push({ tone, message: `${toTitle(profile.id)} applied v${result.version} (${outcome}): ${TEST_MESSAGES[result.code] ?? "The credential check did not complete."}` });
      res.reload();
    } catch (error) {
      const message = error instanceof ApiError && error.code && TEST_MESSAGES[error.code] ? TEST_MESSAGES[error.code] : "We couldn’t run the credential check. Please try again.";
      toasts.push({ tone: "danger", message });
      if (keepDialogOnError) throw new Error(message);
    } finally {
      busyTests.current.delete(profile.id);setTesting(current => { const next = new Set(current);next.delete(profile.id);return next; });
    }
  };
  const testCredentials = (profile: Profile) => {
    if (profile.id === "mail") { setMailTest(profile); return; }
    void runCredentialTest(profile, `Test applied ${toTitle(profile.id)} credentials`);
  };

  return (
    <ResourceBoundary resource={res}>
      {(nd: Profiles) => {
          return (
            <div className="space-y-5">
              {!nd.replacementEnabled && <Notice tone="warning">Changing credentials is switched off. The tech team needs to add the server’s encryption key first.</Notice>}
              {nd.runtimeAvailable === false && <Notice tone="warning">Automatic application needs the server migration and updated API and worker processes. Contact your operator to finish the setup.</Notice>}
              {!replace.allowed && <Notice>{replace.reason}</Notice>}
              <p className="text-xs leading-relaxed text-muted">Environment <span className="font-medium text-foreground/70">{nd.environment}</span> · activation applies automatically with a graceful restart · refreshes every 5s · applied credential checks available on supported services.</p>
              <div className="grid items-start gap-3 md:grid-cols-2">
                {nd.items.map((i) => {
                  const open = expanded.has(i.id);
                  const pending = ["restart_required", "activation_pending", "applying", "awaiting_services"].includes(i.effectiveStatus);
                  const status = !i.configured ? "Not configured" : i.activeVersion === null ? "Staged" : toStatusLabel(i.effectiveStatus);
                  return <Card key={i.id} className="overflow-hidden">
                    <div className="space-y-3 px-5 py-4">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="min-w-0 flex-1">
                          <button type="button" id={`integration-toggle-${i.id}`} aria-expanded={open} aria-controls={`integration-details-${i.id}`} onClick={() => toggleCard(i.id)} className="flex w-full items-center gap-2 rounded-md text-left text-[13px] font-semibold tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-accent/40">
                            <ChevronDown aria-hidden className={`size-3.5 shrink-0 text-muted transition-transform motion-reduce:transition-none ${open ? "rotate-180" : ""}`} />
                            <span className="truncate">{toTitle(i.id)}</span>
                          </button>
                        </h3>
                        <Button variant="ghost" size="sm" aria-haspopup="dialog" onClick={() => setHistoryId(i.id)} className="min-h-6! shrink-0 gap-1 border border-accent/15 bg-accent/10 px-2 text-xs font-medium text-accent! hover:bg-accent/15!">
                          <History aria-hidden className="size-3" /> History
                        </Button>
                      </div>
                      <p className="flex items-center gap-1.5 text-xs text-muted"><Clock3 aria-hidden className="size-3 shrink-0 opacity-60" />Last updated {i.updatedAt ? fmtUtc(i.updatedAt) : "—"}</p>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge tone={i.effectiveStatus === "applied" ? "success" : i.effectiveStatus === "application_blocked" ? "warning" : "neutral"}>{status}</Badge>
                        {pending && <Badge tone="warning">Application pending</Badge>}
                      </div>
                    </div>
                    {open && <div id={`integration-details-${i.id}`} role="region" aria-labelledby={`integration-toggle-${i.id}`} className="flex flex-col gap-3 border-t border-border px-5 py-4">
                      <div className="space-y-1 text-xs leading-relaxed text-muted">
                        <p>{i.configured ? "Saved configuration" : "Not configured"} · <span className="tabular-nums">v{i.version}</span> saved / {i.activeVersion === null ? "not live" : <span className="tabular-nums">v{i.activeVersion} live</span>}</p>
                        <p>Full workflow {toStatusLabel(i.providerConnectivity)}</p>
                        {i.adoption?.services?.length ? <ul className="space-y-0.5" aria-label="Application status">
                          {i.adoption.services.map(s => <li key={s.service} className="flex gap-1.5">
                            <span className="font-medium text-foreground/60">{s.service === "calmasta-api" ? "API" : "Worker"}</span>
                            <span>{s.state === "not_running" ? "awaiting service" : s.state === "applied" ? "applied" : s.state === "blocked" ? "blocked" : "applying"}{s.errorCode === "profile_validation_failed" ? " — validation failed, kept previous" : s.errorCode === "supervisor_required" ? " — needs updated startup" : ""}</span>
                          </li>)}
                        </ul> : null}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <Button size="sm" disabled={!replace.allowed || !nd.replacementEnabled} title={replace.reason ?? undefined} onClick={() => setEditing(i)} className="text-xs">Replace credentials</Button>
                        <Button size="sm" disabled={!replace.allowed || !nd.replacementEnabled || i.version === 0 || i.activeVersion === i.version} onClick={() => setActivating(i)} className="text-xs">Activate</Button>
                      </div>
                      {i.credentialTest?.supported && <div className="space-y-2 border-t border-border/60 pt-3">
                        <p className="text-xs leading-relaxed text-muted">{i.credentialTest.appliedVersion ? `Tests API applied v${i.credentialTest.appliedVersion}.` : "No version is applied to this API yet."} {i.version !== i.activeVersion && `Draft v${i.version} is not tested.`} Worker adoption is separate.</p>
                        <p className="text-xs leading-relaxed text-muted">{testLimit(i.id)}</p>
                        <Button size="sm" className="text-xs" disabled={!check.allowed || !i.credentialTest.canTest || testing.has(i.id)} onClick={() => testCredentials(i)}>{testing.has(i.id) ? "Testing applied credentials…" : "Test applied credentials"}</Button>
                        {!i.credentialTest.canTest && <p className="text-xs text-muted">Wait for the active version to be applied to the API.</p>}
                        {!check.allowed && <p className="text-xs text-muted">An owner must run credential checks.</p>}
                        {i.credentialTest.latest && <div className="space-y-1 text-xs" role="status">
                          <div className="flex flex-wrap items-center gap-1.5"><Badge tone={!i.credentialTest.latest.isCurrent ? "warning" : i.credentialTest.latest.status === "passed" ? "success" : i.credentialTest.latest.status === "failed" ? "danger" : "info"}>{!i.credentialTest.latest.isCurrent ? "Older version" : toStatusLabel(i.credentialTest.latest.status)}</Badge><span className="text-muted">{`Tested API v${i.credentialTest.latest.version} · ${fmtUtc(i.credentialTest.latest.checkedAt)}`}</span></div>
                          <p className="text-muted">{!i.credentialTest.latest.isCurrent ? "This result does not validate the current applied version." : TEST_MESSAGES[i.credentialTest.latest.code] ?? "No final result available."}</p>
                        </div>}
                      </div>}
                    </div>}
                  </Card>;
                })}
              </div>
              {editing && (() => {
                const origin = typeof window !== "undefined" && window.location?.origin ? window.location.origin : "";
                const defaultRedirectUri = origin ? `${origin}/api/auth/callback` : undefined;
                const fieldMap: Record<string, Array<{ name: string; label: string; secret?: boolean; placeholder?: string; defaultValue?: string; options?: string[]; required?: boolean }>> = {
                  recall: [{ name: "apiKey", label: "API Key", secret: true }, { name: "webhookSecret", label: "Webhook Secret", secret: true }, { name: "region", label: "Region", placeholder: "us-west-2" }],
                  assemblyai: [{ name: "apiKey", label: "API Key", secret: true }, { name: "webhookSecret", label: "Webhook Secret", secret: true }, { name: "region", label: "Region", placeholder: "us" }],
                  openrouter: [{ name: "apiKey", label: "API Key", secret: true }],
                  woo: [{ name: "storeUrl", label: "Store URL (https://...)" }, { name: "consumerKey", label: "Consumer Key", secret: true }, { name: "consumerSecret", label: "Consumer Secret", secret: true }, { name: "webhookSecret", label: "Webhook Secret", secret: true }, { name: "mode", label: "Mode", options: ["sandbox", "production"], required: true }],
                  mail: [{ name: "host", label: "SMTP Host" }, { name: "port", label: "SMTP Port" }, { name: "secure", label: "Secure (true/false)" }, { name: "user", label: "SMTP User" }, { name: "pass", label: "SMTP Pass", secret: true }, { name: "from", label: "From Email" }],
                  oauth_google: [{ name: "clientId", label: "Google Client ID" }, { name: "clientSecret", label: "Client Secret", secret: true }, { name: "redirectUri", label: "Redirect URI", defaultValue: defaultRedirectUri, placeholder: defaultRedirectUri || "https://your-domain.com/api/auth/callback" }],
                  oauth_microsoft: [{ name: "clientId", label: "Microsoft Client ID" }, { name: "clientSecret", label: "Client Secret", secret: true }, { name: "redirectUri", label: "Redirect URI", defaultValue: defaultRedirectUri, placeholder: defaultRedirectUri || "https://your-domain.com/api/auth/callback" }],
                  calendar_google: [{ name: "clientId", label: "Google Client ID" }, { name: "clientSecret", label: "Client Secret", secret: true }],
                  calendar_microsoft: [{ name: "clientId", label: "Microsoft Client ID" }, { name: "clientSecret", label: "Client Secret", secret: true }],
                };
                const extra = fieldMap[editing.id] ?? [{ name: "value", label: "Value", secret: true }];
                return (
                  <ActionDialog title={`Replace ${toTitle(editing.id)}`} description={`Save version ${editing.version + 1} without activating it. Credentials are encrypted and never shown again. Leave a field blank to keep its saved value; new profiles require all mandatory fields.`} confirmLabel="Save staged version" fields={extra.map(f => ({ ...f, required: f.required ?? false, hint: f.placeholder ? `Example: ${f.placeholder}` : undefined }))} onClose={() => setEditing(null)} onSubmit={async (v) => {
                    const changes: Record<string, string> = {};
                    for (const f of extra) if (v[f.name] !== undefined && String(v[f.name]).trim() !== "") changes[f.name] = String(v[f.name]).trim();
                    await adminPatch(`/api/admin/integration-profiles/${editing.id}`, { expectedVersion: editing.version, changes, clearFields: [], reason: v.reason }, { "Idempotency-Key": key() });
                    toasts.push({ tone: "success", message: "Staged credentials saved. Activate the version when ready to apply it automatically." }); setEditing(null); res.reload();
                  }} />
                );
              })()}
              {activating && <ActionDialog title={`Activate ${toTitle(activating.id)} version ${activating.version}?`} description="Apply this saved version automatically. Each running API and worker finishes its current work, then restarts with the activated credentials. A brief reconnection may occur. Missing or blocked services remain pending. This does not test provider connectivity." confirmLabel="Activate version" onClose={() => setActivating(null)} onSubmit={async (v) => {
                await adminPost(`/api/admin/integration-profiles/${activating.id}/activate`, { expectedVersion: activating.version, reason: v.reason }, { "Idempotency-Key": key() });
                toasts.push({ tone: "success", message: "Version activated. Automatic application is pending; watch the API and worker status." }); setActivating(null); res.reload();
              }} />}
              {mailTest && <ActionDialog title="Send SMTP test email" description="Enter a sample recipient. CalMasta will send one fixed diagnostic message using the SMTP credentials currently applied to this API. SMTP acceptance does not guarantee inbox placement." confirmLabel="Send test email" fields={[{name:"recipientEmail",label:"Recipient email",type:"email",autoComplete:"email",required:true}]} hideReason onClose={() => setMailTest(null)} onSubmit={async v => {
                await runCredentialTest(mailTest,v.reason || `Test applied ${toTitle(mailTest.id)} credentials`,v.recipientEmail.trim().toLowerCase(),true);
              }} />}
              {historyId && <IntegrationHistory key={`${historyId}:${nd.items.find(i => i.id === historyId)?.version}:${nd.items.find(i => i.id === historyId)?.activeVersion}`} id={historyId} onClose={closeHistory} />}
              <ToastStack items={toasts.items} onDismiss={toasts.dismiss} />
            </div>
          );
      }}
    </ResourceBoundary>
  );
}


type HistoryItem = { id: string; actorId: string; actorName: string | null; actorEmail: string | null; action: string; version: number | null; reason: string; createdAt: string; changedFields?: string[]; testStatus?: string | null };
const FIELD_LABELS: Record<string, string> = {
  apiKey: "API key", webhookSecret: "Webhook secret", clientId: "Client ID", clientSecret: "Client secret", redirectUri: "Redirect URI",
  storeUrl: "Store URL", consumerKey: "Consumer key", consumerSecret: "Consumer secret", host: "SMTP host", port: "SMTP port",
  secure: "TLS", user: "SMTP username", pass: "SMTP password", from: "Sender email", region: "Region", mode: "Mode",
};
export function IntegrationHistory({ id, onClose }: { id: string; onClose: () => void }) {
  const history = usePaged<HistoryItem, { items: HistoryItem[]; nextCursor: string | null }>(`/api/admin/integration-profiles/${encodeURIComponent(id)}/history?limit=20`, page => page.items);
  const failed = history.status === "unavailable" || history.status === "error";
  return <Dialog title={`Version history — ${toTitle(id)}`} onClose={onClose} width="max-w-6xl">
    <div className="space-y-4">
      <p className="text-sm text-muted">Newest changes first. All times are UTC. Credential values stay private.</p>
      {failed && <Notice>{history.message || "History is unavailable."} <Button onClick={history.reload}>Try again</Button></Notice>}
      {!failed && <>
        {history.message && <Notice>{history.message}</Notice>}
        <DataTable label={`Change history for ${id}`}>
          <thead><tr>{["Changed at", "Administrator", "Action", "Version", "Fields changed", "Reason"].map(label => <Th key={label}>{label}</Th>)}</tr></thead>
          <tbody>
            {history.status === "loading" && <tr><td colSpan={6} className="px-4 py-12 text-center text-muted" role="status">Loading changes…</td></tr>}
            {history.status === "ready" && history.rows.length === 0 && <tr><td colSpan={6} className="px-4 py-12 text-center text-muted">No recorded changes for this service.</td></tr>}
            {history.rows.map(event => <tr key={event.id} className="transition-colors hover:bg-surface/40">
              <Td className="whitespace-nowrap text-xs text-muted">{fmtUtc(event.createdAt)}</Td>
              <Td className="min-w-40"><p className="font-medium">{event.actorName ?? event.actorEmail ?? event.actorId}</p>{event.actorName && event.actorEmail && <p className="mt-1 break-all text-xs text-muted">{event.actorEmail}</p>}</Td>
              <Td className="whitespace-nowrap"><Badge tone={event.action === "integration_profile.activate" ? "info" : "neutral"}>{event.action === "integration_profile.activate" ? "Activated" : event.action === "integration_profile.test" ? "Credential test" : "Saved draft"}</Badge>{event.action === "integration_profile.test" && event.testStatus && <span className="ml-1.5 text-xs text-muted">{toStatusLabel(event.testStatus)}</span>}</Td>
              <Td className="whitespace-nowrap font-medium">{event.version === null ? "—" : `v${event.version}`}</Td>
              <Td className="min-w-36 text-xs text-muted">{event.changedFields?.length ? event.changedFields.map(field => FIELD_LABELS[field] ?? field).join(", ") : "—"}</Td>
              <Td className="min-w-48 max-w-xs break-words">{event.reason}</Td>
            </tr>)}
          </tbody>
        </DataTable>
        {history.rows.length > 0 && <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-muted">{history.rows.length} {history.rows.length === 1 ? "change" : "changes"} shown</p>{history.hasMore && <Button disabled={history.more} onClick={() => { void history.loadMore(); }}>Load older changes</Button>}</div>}
      </>}
    </div>
  </Dialog>;
}
