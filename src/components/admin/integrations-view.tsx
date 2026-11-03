"use client";

import { CircleCheck, KeyRound, PlugZap } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ToastStack, useToasts } from "@/components/ui/toast";
import { type Json, adminPatch, adminPost, fmtUtc } from "@/lib/admin-client";
import { capability } from "@/lib/admin-capabilities";
import type { Integration } from "@/lib/admin-types";
import type { Tone } from "@/lib/status";
import { ActionDialog, Notice, ResourceBoundary, useResource } from "./ui";

type Item = Json<Integration>;

const STATUS: Record<Item["status"], { label: string; tone: Tone }> = {
  verified: { label: "Working", tone: "success" },
  configured: { label: "Not tested yet", tone: "info" },
  not_configured: { label: "Not set up", tone: "neutral" },
  failing: { label: "Not working", tone: "danger" },
};
const ORDER: Item["category"][] = ["Sign-in", "Calendar", "Meetings", "Transcription", "Storage", "Email", "AI"];

export function IntegrationsView() {
  const res = useResource<Item[]>("/api/admin/integrations");
  const toasts = useToasts("integrations");
  const [editing, setEditing] = useState<Item | null>(null);
  const [checking, setChecking] = useState<string | null>(null);
  const replace = capability("integration_replace");
  const check = capability("integration_check");

  async function runCheck(i: Item) {
    setChecking(i.id);
    try {
      const r = await adminPost<{ ok: boolean; message: string }>(`/api/admin/integrations/${i.id}/check`, {});
      toasts.push({ tone: r.ok ? "success" : "danger", message: `${i.name}: ${r.message}` });
      res.reload();
    } catch (err) {
      toasts.push({ tone: "danger", message: err instanceof Error ? err.message : "The check didn't run." });
    } finally {
      setChecking(null);
    }
  }

  return (
    <ResourceBoundary resource={res}>
      {(items) => (
        <div className="space-y-6">
          {!replace.allowed && <Notice tone="warning">{replace.reason}</Notice>}
          {ORDER.filter((c) => items.some((i) => i.category === c)).map((cat) => (
            <section key={cat} aria-labelledby={`c-${cat}`} className="space-y-3">
              <h2 id={`c-${cat}`} className="text-sm font-semibold">{cat}</h2>
              <ul className="grid gap-3 md:grid-cols-2">
                {items.filter((i) => i.category === cat).map((i) => (
                  <li key={i.id}>
                    <Card>
                      <div className="space-y-3 p-4 text-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate font-medium">{i.name}</p>
                            <p className="mt-0.5 text-xs text-muted">{i.usedFor}</p>
                          </div>
                          <Badge tone={STATUS[i.status].tone} active={i.status === "failing"}>{STATUS[i.status].label}</Badge>
                        </div>
                        {i.lastError && <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger">{i.lastError}</p>}
                        <details className="group text-xs">
                        <summary className="cursor-pointer list-none text-muted marker:hidden [&::-webkit-details-marker]:hidden hover:text-foreground">What is set <span className="group-open:hidden">▸</span><span className="hidden group-open:inline">▾</span></summary>
                        <ul className="mt-2 space-y-1">
                          {i.fields.map((f) => (
                            <li key={f.key} className="flex items-center justify-between gap-3">
                              <span className="text-muted">{f.label}</span>
                              <span className="flex min-w-0 items-center gap-1.5">
                                {f.kind === "secret" ? (
                                  <>{f.configured ? <CircleCheck aria-hidden className="size-3.5 text-success" /> : null}{f.configured ? "Set" : "Not set"}</>
                                ) : (
                                  <span className="truncate" title={f.value || undefined}>{f.value || "Not set"}</span>
                                )}
                              </span>
                            </li>
                          ))}
                        </ul>
                        </details>
                        <p className="text-xs text-muted">{i.lastCheckedAt ? `Last tested ${fmtUtc(i.lastCheckedAt)}` : "Never tested"}{i.region ? ` · ${i.region}` : ""}</p>
                        <div className="flex flex-wrap gap-2 pt-1">
                          <Button disabled={!check.allowed || checking === i.id} title={check.reason ?? undefined} onClick={() => void runCheck(i)}><PlugZap aria-hidden className="size-4" /> {checking === i.id ? "Testing…" : "Test"}</Button>
                          <Button disabled={!replace.allowed} title={replace.reason ?? undefined} onClick={() => setEditing(i)}><KeyRound aria-hidden className="size-4" /> Change keys…</Button>
                        </div>
                      </div>
                    </Card>
                  </li>
                ))}
              </ul>
            </section>
          ))}

          {editing && (
            <ActionDialog
              danger
              title={`Change ${editing.name} keys`}
              description={<><p>{editing.impact}</p><p className="mt-2">Empty boxes stay as they are. Saved keys are never shown again.</p></>}
              confirmLabel="Save keys"
              fields={editing.fields.filter((f) => f.editable).map((f) => ({
                name: f.key,
                label: f.label,
                secret: f.kind === "secret",
                options: f.kind === "select" ? f.options : undefined,
                required: false,
                defaultValue: f.kind === "secret" ? "" : f.value ?? "",
                hint: f.reason,
              }))}
              onClose={() => setEditing(null)}
              onSubmit={async ({ reason, ...vals }) => {
                const current = Object.fromEntries(editing.fields.map((f) => [f.key, f.kind === "secret" ? "" : f.value ?? ""]));
                const fields = Object.fromEntries(Object.entries(vals).filter(([k, v]) => v !== "" && v !== current[k]));
                if (Object.keys(fields).length === 0) throw new Error("Enter at least one new value, or cancel.");
                await adminPatch(`/api/admin/integrations/${editing.id}`, { fields, reason });
                toasts.push({ tone: "success", message: `${editing.name} keys saved. Press Test to check they work.` });
                res.reload();
              }}
            />
          )}
          <ToastStack items={toasts.items} onDismiss={toasts.dismiss} />
        </div>
      )}
    </ResourceBoundary>
  );
}
