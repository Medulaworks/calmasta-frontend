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
            <div className="space-y-6">
              {!nd.secretReplacementEnabled && <Notice tone="warning">Secret replacement disabled — ADMIN_SECRET_ENCRYPTION_KEY not configured. Requires operator restart for adoption.</Notice>}
              {!replace.allowed && <Notice>{replace.reason}</Notice>}
              <p className="text-xs text-muted">IDs: openrouter / recall / assemblyai — never display credential values. Effective adoption requires restart.</p>
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
              {editing && (
                <ActionDialog title={`Replace ${editing.id}`} description="Write-only encrypted replacement with optimistic version. Disabled without server encryption key." confirmLabel="Replace" fields={[{ name: "value", label: "Value", secret: true }, { name: "version", label: "Version", type: "number", defaultValue: String(editing.storedVersion) }]} onClose={() => setEditing(null)} onSubmit={async (v) => {
                  await adminPatch(`/api/admin/integrations/${editing.id}`, { value: v.value, version: Number(v.version), reason: v.reason }, { "Idempotency-Key": key() });
                  toasts.push({ tone: "success", message: "Stored — restart_required." }); setEditing(null); res.reload();
                }} />
              )}
              <ToastStack items={toasts.items} onDismiss={toasts.dismiss} />
            </div>
          );
        }
        return <div className="space-y-6"><p className="text-sm text-muted">No integrations.</p></div>;
      }}
    </ResourceBoundary>
  );
}
