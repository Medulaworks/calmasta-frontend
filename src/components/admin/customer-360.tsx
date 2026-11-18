"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { Tabs, tabId, tabPanelId } from "@/components/ui/tabs";
import { fmtUtc, shortId } from "@/lib/admin-client";
import { formatMinutes } from "@/lib/status";
import { DataTable, Td, Th, usePaged } from "./ui";

export type Workspace360 = {
  id: string; ownerId: string; plan: string; role: string; processingPaused: boolean; createdAt: string; memberCount: number;
  usage: { period: string; limitSeconds: number; usedSeconds: number; reservedSeconds: number } | null;
  credits: Array<{ id: string; orderId: string; sku: string; creditsSeconds: number; reservedSeconds: number; consumedSeconds: number; state: string; grantedAt: string; expiresAt: string }>;
  captureCounts: Array<{ source: string; state: string; count: number }>;
};
export type Customer360Data = {
  user: { id: string; name: string | null; email: string; emailVerified: boolean; timezone: string | null; isStaff: boolean; suspendedAt: string | null; createdAt: string; lastActiveAt?: string | null; profession?: string | null; onboarded?: boolean; outputsOnly?: boolean; audioRetentionDays?: number; meetingRecapEmailEnabled?: boolean; hasPassword?: boolean; providers?: Array<{ provider: string; providerEmail: string | null; createdAt: string }>; staffRole?: { role: string } | null };
  workspaces: Workspace360[];
  preferences: { botName: string | null; promptState: string; updatedAt: string } | null;
  sessions: { total: number; active: number; lastCreatedAt: string | null };
  deletion: { status: string; requestedAt: string; completedAt: string | null } | null;
  totals: { captures: number; meetings: number; uploads: number; transcriptImports: number; documents: number; insightsReady: number; bookings: number };
  connections: Array<{ id: string; provider: string; accountEmail: string; status: string; calendars: number; connectedAt: string }>;
  recentJobs: Array<{ id: string; captureId: string; kind: string; state: string; attempts: number; lastError: string | null; updatedAt: string }>;
  adminHistory: Array<{ id: string; action: string; reason: string; createdAt: string; actorEmail: string | null }>;
};

type Tab = "account" | "workspaces" | "activities" | "usage" | "processing" | "more";
const mins = (seconds: number) => formatMinutes(Math.round(seconds / 60));
const typeLabel = (source: string) => (source === "meeting" ? "Meeting bot" : source === "transcript" ? "Transcript import" : "Audio upload");

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="min-w-0"><dt className="text-xs text-muted">{label}</dt><dd className="mt-1 break-words">{children}</dd></div>;
}

function Activities({ id }: { id: string }) {
  const captures = usePaged(`/api/admin/captures?userId=${id}&limit=25`, (p: { items: never[]; nextCursor: string | null }) => p.items);
  const activity = usePaged(`/api/admin/customers/${id}/activity`, (p: { items: never[]; nextCursor: string | null }) => p.items);
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader title="Recordings, captures and uploads" />
        {captures.status === "loading" ? <p className="p-5 text-sm text-muted">Loading…</p> : captures.rows.length === 0 ? <p className="p-5 text-sm text-muted">No captures yet.</p> : (
          <DataTable label="Customer captures">
            <thead><tr><Th>When</Th><Th>Activity</Th><Th>Type</Th><Th>Status</Th><Th>Details</Th></tr></thead>
            <tbody>
              {(captures.rows as Array<{ id: string; displayKey: string; source: string; createdAt: string; meeting: { state: string }; transcription: { state: string }; video: { state: string }; audio: { state: string } }>).map((c) => (
                <tr key={c.id}>
                  <Td className="whitespace-nowrap">{fmtUtc(c.createdAt)}</Td>
                  <Td><Link className="font-mono text-xs text-accent hover:underline" href={`/admin/captures/${c.id}`}>{c.displayKey}</Link><span className="block font-mono text-xs text-muted">{shortId(c.id)}</span></Td>
                  <Td>{typeLabel(c.source)}</Td>
                  <Td><Badge tone={c.meeting.state === "failed" ? "danger" : c.meeting.state === "completed" ? "success" : "neutral"}>{c.meeting.state}</Badge></Td>
                  <Td className="text-xs">transcription {c.transcription.state} · audio {c.audio.state} · video {c.video.state}</Td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        )}
        {captures.hasMore && <button type="button" onClick={() => void captures.loadMore()} className="m-4 text-sm text-accent hover:underline">Load more captures</button>}
      </Card>
      <Card>
        <CardHeader title="User actions" />
        {activity.rows.length === 0 ? <p className="p-5 text-sm text-muted">No recorded actions yet.</p> : (
          <ol className="divide-y divide-border">
            {(activity.rows as Array<{ sequence: string; action: string; observedAt: string; source: string; captureId: string | null }>).map((a) => (
              <li key={a.sequence} className="px-5 py-3 text-sm">
                <p className="font-medium">{a.action} <span className="font-normal text-muted">· {a.source}</span></p>
                <p className="mt-1 text-xs text-muted">{fmtUtc(a.observedAt)}{a.captureId ? <> · <Link className="text-accent hover:underline" href={`/admin/captures/${a.captureId}`}>open capture</Link></> : null}</p>
              </li>
            ))}
          </ol>
        )}
        {activity.hasMore && <button type="button" onClick={() => void activity.loadMore()} className="m-4 text-sm text-accent hover:underline">Load more actions</button>}
      </Card>
    </div>
  );
}

export function Customer360({ id, data }: { id: string; data: Customer360Data }) {
  const [tab, setTab] = useState<Tab>("account");
  const u = data.user;
  const failedJobs = data.recentJobs.filter((j) => ["dead_letter", "unknown", "failed"].includes(j.state)).length;
  const items = [
    { id: "account" as Tab, label: "Account" },
    { id: "workspaces" as Tab, label: "Workspaces", count: data.workspaces.length },
    { id: "activities" as Tab, label: "Activities", count: data.totals.captures },
    { id: "usage" as Tab, label: "Usage & plan" },
    { id: "processing" as Tab, label: "Processing", count: failedJobs || undefined },
    { id: "more" as Tab, label: "More" },
  ];
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {([["Captures", data.totals.captures], ["Meetings", data.totals.meetings], ["Uploads", data.totals.uploads + data.totals.transcriptImports], ["Documents", data.totals.documents]] as const).map(([label, value]) => (
          <div key={label} className="rounded-xl border border-border p-4"><p className="text-xs text-muted">{label}</p><p className="mt-1 text-xl font-semibold tabular-nums">{value}</p></div>
        ))}
      </div>
      <Tabs label="Customer detail" items={items} active={tab} onChange={setTab} />
      <div id={tabPanelId(tab)} role="tabpanel" aria-labelledby={tabId(tab)}>
        {tab === "account" && (
          <Card><CardHeader title="Account" />
            <dl className="grid gap-x-6 gap-y-3 p-5 text-sm sm:grid-cols-2">
              <Row label="User id"><code className="break-all text-xs">{u.id}</code></Row>
              <Row label="Joined">{fmtUtc(u.createdAt)}</Row>
              <Row label="Last active">{u.lastActiveAt ? fmtUtc(u.lastActiveAt) : "Never"}</Row>
              <Row label="Time zone">{u.timezone ?? "–"}</Row>
              <Row label="Profession">{u.profession ?? "–"}</Row>
              <Row label="Onboarded">{u.onboarded ? "Yes" : "No"}</Row>
              <Row label="Sign-in providers">{u.providers?.length ? u.providers.map((p) => p.provider).join(", ") : u.hasPassword ? "email_password" : "–"}</Row>
              <Row label="Staff role">{u.staffRole?.role ?? (u.isStaff ? "staff" : "No")}</Row>
              <Row label="Sessions">{data.sessions.active} active of {data.sessions.total}{data.sessions.lastCreatedAt ? ` · last ${fmtUtc(data.sessions.lastCreatedAt)}` : ""}</Row>
              <Row label="Suspended">{u.suspendedAt ? fmtUtc(u.suspendedAt) : "No"}</Row>
              <Row label="Deletion">{data.deletion ? `${data.deletion.status} · requested ${fmtUtc(data.deletion.requestedAt)}` : "None"}</Row>
              <Row label="Recap emails">{u.meetingRecapEmailEnabled ? "On" : "Off"}</Row>
              <Row label="Audio retention">{u.audioRetentionDays !== undefined ? `${u.audioRetentionDays} days` : "–"}</Row>
              <Row label="Capture preferences">{data.preferences ? `${data.preferences.promptState} · bot ${data.preferences.botName ?? "default"}` : "Default"}</Row>
            </dl>
          </Card>
        )}
        {tab === "workspaces" && (
          <div className="space-y-4">{data.workspaces.length === 0 ? <p className="text-sm text-muted">No workspaces.</p> : data.workspaces.map((w) => (
            <Card key={w.id}><CardHeader title={`Workspace ${shortId(w.id)}`} />
              <dl className="grid gap-x-6 gap-y-3 p-5 text-sm sm:grid-cols-3">
                <Row label="Plan"><span className="capitalize">{w.plan}</span></Row>
                <Row label="Role">{w.role}{w.ownerId === id ? " · owner" : ""}</Row>
                <Row label="Members">{w.memberCount}</Row>
                <Row label="Created">{fmtUtc(w.createdAt)}</Row>
                <Row label="Processing"><Badge tone={w.processingPaused ? "warning" : "success"}>{w.processingPaused ? "paused" : "active"}</Badge></Row>
                <Row label="Captures">{w.captureCounts.reduce((n, c) => n + c.count, 0)}</Row>
              </dl>
              {w.captureCounts.length > 0 && <p className="border-t border-border px-5 py-3 text-xs text-muted">{w.captureCounts.map((c) => `${c.source}/${c.state}: ${c.count}`).join(" · ")}</p>}
            </Card>
          ))}</div>
        )}
        {tab === "activities" && <Activities id={id} />}
        {tab === "usage" && (
          <div className="space-y-4">{data.workspaces.map((w) => (
            <Card key={w.id}><CardHeader title={`Usage · workspace ${shortId(w.id)}`} />
              <dl className="grid gap-x-6 gap-y-3 p-5 text-sm sm:grid-cols-3">
                <Row label="Period">{w.usage?.period ?? "current"}</Row>
                <Row label="Used">{w.usage ? `${mins(w.usage.usedSeconds)} of ${mins(w.usage.limitSeconds)}` : "–"}</Row>
                <Row label="Reserved">{w.usage ? mins(w.usage.reservedSeconds) : "–"}</Row>
              </dl>
              {w.credits.length > 0 && <DataTable label="Credit packs"><thead><tr><Th>Order</Th><Th>Pack</Th><Th>Credits</Th><Th>Used / reserved</Th><Th>State</Th><Th>Expires</Th></tr></thead><tbody>{w.credits.map((c) => <tr key={c.id}><Td className="font-mono text-xs">{c.orderId}</Td><Td>{c.sku}</Td><Td>{mins(c.creditsSeconds)}</Td><Td>{mins(c.consumedSeconds)} / {mins(c.reservedSeconds)}</Td><Td>{c.state}</Td><Td className="whitespace-nowrap">{fmtUtc(c.expiresAt)}</Td></tr>)}</tbody></DataTable>}
            </Card>
          ))}</div>
        )}
        {tab === "processing" && (
          <Card><CardHeader title="Recent processing jobs" />
            {data.recentJobs.length === 0 ? <p className="p-5 text-sm text-muted">No jobs yet.</p> : <DataTable label="Recent jobs"><thead><tr><Th>Updated</Th><Th>Job</Th><Th>Kind</Th><Th>State</Th><Th>Attempts</Th><Th>Error</Th></tr></thead><tbody>{data.recentJobs.map((j) => <tr key={j.id}><Td className="whitespace-nowrap">{fmtUtc(j.updatedAt)}</Td><Td><Link className="font-mono text-xs text-accent hover:underline" href={`/admin/captures/${j.captureId}`}>{shortId(j.captureId)}</Link></Td><Td>{j.kind}</Td><Td><Badge tone={["dead_letter", "unknown"].includes(j.state) ? "danger" : j.state === "completed" ? "success" : "neutral"}>{j.state}</Badge></Td><Td>{j.attempts}</Td><Td className="max-w-xs break-words text-xs">{j.lastError ?? "–"}</Td></tr>)}</tbody></DataTable>}
          </Card>
        )}
        {tab === "more" && (
          <div className="space-y-4">
            <Card><CardHeader title="Calendars & booking" />
              <div className="space-y-3 p-5 text-sm">
                {data.connections.length === 0 ? <p className="text-muted">No calendars connected.</p> : data.connections.map((c) => <p key={c.id}>{c.provider} · {c.accountEmail} · {c.calendars} calendars <Badge tone={c.status === "connected" ? "success" : "warning"}>{c.status}</Badge></p>)}
                <p className="text-muted">Bookings: {data.totals.bookings} · Insights ready: {data.totals.insightsReady}</p>
              </div>
            </Card>
            <Card><CardHeader title="Admin history" />
              {data.adminHistory.length === 0 ? <p className="p-5 text-sm text-muted">No staff actions on this account.</p> : <DataTable label="Admin history"><thead><tr><Th>When</Th><Th>Action</Th><Th>By</Th><Th>Reason</Th></tr></thead><tbody>{data.adminHistory.map((h) => <tr key={h.id}><Td className="whitespace-nowrap">{fmtUtc(h.createdAt)}</Td><Td>{h.action}</Td><Td>{h.actorEmail ?? "–"}</Td><Td className="max-w-xs break-words">{h.reason}</Td></tr>)}</tbody></DataTable>}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
