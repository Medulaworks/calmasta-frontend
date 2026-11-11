"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { type Json, adminPatch, adminPost, fmtUtc } from "@/lib/admin-client";
import { capability } from "@/lib/admin-capabilities";
import type { Integration } from "@/lib/admin-types";
import { ActionDialog, Notice, ResourceBoundary, useResource } from "./ui";
import { ToastStack, useToasts } from "@/components/ui/toast";

type Item = Json<Integration>;
type NewItem = { id: string; configured: boolean; storedVersion: number; effectiveVersion: number; effectiveStatus: string; providerConnectivity: string; lastConfigurationCheckAt: string | null };
type NewResp = { items: NewItem[]; secretReplacementEnabled: boolean };
const key = () => crypto.randomUUID().replace(/-/g, "").slice(0, 16).padEnd(8, "0");

export function IntegrationsView() {
  const res = useResource<Item[] & NewResp>("/api/admin/integrations");
  const toasts = useToasts("integrations");
  const [editing, setEditing] = useState<NewItem | null>(null);
  const replace = capability("integration_replace");
  const check = capability("integration_check");

  return (
    <ResourceBoundary resource={res}>
      {(data: Item[] & Partial<NewResp>) => {
        const isNew = Array.isArray((data as NewResp).items);
        if (isNew) {
          const nd = data as unknown as NewResp;
          return (
            <div className="space-y-5">
              {!nd.secretReplacementEnabled && <Notice tone="warning">Secret replacement disabled — ADMIN_SECRET_ENCRYPTION_KEY not configured. Requires operator restart for adoption.</Notice>}
              {!replace.allowed && <Notice>{replace.reason}</Notice>}
              <p className="text-xs text-muted">IDs: openrouter / recall / assemblyai / woo / smtp / google / calendar — never display credential values. Effective adoption requires restart.</p>
              <div className="grid gap-3 md:grid-cols-2">
                {nd.items.map((i) => (
                  <Card key={i.id}>
                    <div className="space-y-3 p-4 text-sm">
                      <p className="font-medium">{i.id}</p>
                      <p className="text-xs text-muted">{i.configured ? "Configured" : "Not configured"} · stored v{i.storedVersion} / effective v{i.effectiveVersion} · {i.effectiveStatus}</p>
                      <p className="text-xs text-muted">Connectivity {i.providerConnectivity} · last check {i.lastConfigurationCheckAt ? fmtUtc(i.lastConfigurationCheckAt) : "–"}</p>
                      <div className="flex gap-2">
                        <Button disabled={!check.allowed} title={check.reason ?? undefined} onClick={async () => { try { await adminPost(`/api/admin/integrations/${i.id}/check`, { reason: "Check integration" }, { "Idempotency-Key": key() }); toasts.push({ tone: "success", message: "Check: configuration_presence, not live provider verification." }); res.reload(); } catch (e) { toasts.push({ tone: "danger", message: e instanceof Error ? e.message : "Check failed" }); } }}>Test</Button>
                        <Button disabled={!replace.allowed || !nd.secretReplacementEnabled} title={replace.reason ?? undefined} onClick={() => setEditing(i)}>Replace secret…</Button>
                      </div>
                      {i.effectiveStatus === "restart_required" && <Badge tone="warning">restart_required — clear input after acknowledgement, no client persistence</Badge>}
                    </div>
                  </Card>
                ))}
              </div>
              {editing && (() => {
                const fieldMap: Record<string, Array<{ name: string; label: string; secret?: boolean; placeholder?: string }>> = {
                  recall: [{ name: "apiKey", label: "API Key", secret: true }, { name: "webhookSecret", label: "Webhook Secret", secret: true }, { name: "region", label: "Region", placeholder: "us-west-2" }],
                  assemblyai: [{ name: "apiKey", label: "API Key", secret: true }, { name: "webhookSecret", label: "Webhook Secret", secret: true }, { name: "region", label: "Region", placeholder: "us" }],
                  openrouter: [{ name: "apiKey", label: "API Key", secret: true }],
                  woo: [{ name: "storeUrl", label: "Store URL (https://...)" }, { name: "consumerKey", label: "Consumer Key", secret: true }, { name: "consumerSecret", label: "Consumer Secret", secret: true }, { name: "webhookSecret", label: "Webhook Secret", secret: true }, { name: "mode", label: "Mode (sandbox/production)" }],
                  mail: [{ name: "host", label: "SMTP Host" }, { name: "port", label: "SMTP Port" }, { name: "secure", label: "Secure (true/false)" }, { name: "user", label: "SMTP User" }, { name: "pass", label: "SMTP Pass", secret: true }, { name: "from", label: "From Email" }],
                  oauth_google: [{ name: "clientId", label: "Google Client ID" }, { name: "clientSecret", label: "Client Secret", secret: true }, { name: "redirectUri", label: "Redirect URI" }],
                  calendar_google: [{ name: "clientId", label: "Google Client ID" }, { name: "clientSecret", label: "Client Secret", secret: true }],
                  calendar_microsoft: [{ name: "clientId", label: "Microsoft Client ID" }, { name: "clientSecret", label: "Client Secret", secret: true }],
                };
                const extra = fieldMap[editing.id] ?? [{ name: "value", label: "Value", secret: true }];
                return (
                  <ActionDialog title={`Replace ${editing.id}`} description="Write-only encrypted replacement with optimistic version. Disabled without server encryption key. Blank = unchanged, empty = clear." confirmLabel="Replace" fields={[...extra, { name: "version", label: "Version", type: "number", defaultValue: String(editing.storedVersion) }]} onClose={() => setEditing(null)} onSubmit={async (v) => {
                    const changes: Record<string, string> = {};
                    for (const f of extra) if (v[f.name] !== undefined && String(v[f.name]).trim() !== "") changes[f.name] = String(v[f.name]).trim();
                    await adminPatch(`/api/admin/integrations/${editing.id}`, { expectedVersion: Number(v.version), changes, clearFields: [], reason: v.reason }, { "Idempotency-Key": key() });
                    toasts.push({ tone: "success", message: "Stored — restart_required." }); setEditing(null); res.reload();
                  }} />
                );
              })()}
              <ToastStack items={toasts.items} onDismiss={toasts.dismiss} />
            </div>
          );
        }
        return <div className="space-y-5"><p className="text-sm text-muted">No integrations.</p></div>;
      }}
    </ResourceBoundary>
  );
}
