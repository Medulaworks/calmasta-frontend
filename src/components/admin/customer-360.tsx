"use client";

import { FileText, FileUp, Lock, Mic, Video } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { Tabs, tabId, tabPanelId } from "@/components/ui/tabs";
import { fmtUtc, shortId } from "@/lib/admin-client";
import { formatMinutes } from "@/lib/status";
import { DataTable, Metric, Td, Th, usePaged } from "./ui";

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
  return <div className="min-w-0"><dt className="text-xs font-medium text-muted">{label}</dt><dd className="mt-1 break-words text-sm text-foreground">{children}</dd></div>;
}
const none = <span className="text-muted">–</span>;
const providerLabel = (p: string) => ({ email_password: "Email and password", google: "Google", microsoft: "Microsoft", apple: "Apple" } as Record<string, string>)[p] ?? p.replace(/_/g, " ");
const YesNo = ({ yes }: { yes: boolean }) => <Badge tone={yes ? "success" : "neutral"}>{yes ? "Yes" : "No"}</Badge>;
function Group({ title, description, children, cols = "sm:grid-cols-2 lg:grid-cols-3" }: { title: string; description?: string; children: React.ReactNode; cols?: string }) {
  return (
    <Card>
      <CardHeader title={title} />
      {description && <p className="px-5 pt-4 text-sm text-muted">{description}</p>}
      <dl className={`grid gap-x-8 gap-y-5 p-5 ${cols}`}>{children}</dl>
    </Card>
  );
}

function Activities({ id }: { id: string }) {
  const captures = usePaged(`/api/admin/captures?userId=${id}&limit=25`, (p: { items: never[]; nextCursor: string | null }) => p.items);
  const activity = usePaged(`/api/admin/customers/${id}/activity`, (p: { items: never[]; nextCursor: string | null }) => p.items);
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader title="Recordings and uploads" />
        {captures.status === "loading" ? <p className="p-5 text-sm text-muted">Loading…</p> : captures.rows.length === 0 ? <p className="p-5 text-sm text-muted">No recordings yet.</p> : (
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
        {captures.hasMore && <button type="button" onClick={() => void captures.loadMore()} className="m-4 text-sm text-accent hover:underline">Show more</button>}
      </Card>
      <Card>
        <CardHeader title="What this person did" />
        {activity.rows.length === 0 ? <p className="p-5 text-sm text-muted">Nothing recorded yet.</p> : (
          <ol className="divide-y divide-border">
            {(activity.rows as Array<{ sequence: string; action: string; observedAt: string; source: string; captureId: string | null }>).map((a) => (
              <li key={a.sequence} className="px-5 py-3 text-sm">
                <p className="font-medium">{a.action} <span className="font-normal text-muted">· {a.source}</span></p>
                <p className="mt-1 text-xs text-muted">{fmtUtc(a.observedAt)}{a.captureId ? <> · <Link className="text-accent hover:underline" href={`/admin/captures/${a.captureId}`}>open capture</Link></> : null}</p>
              </li>
            ))}
          </ol>
        )}
        {activity.hasMore && <button type="button" onClick={() => void activity.loadMore()} className="m-4 text-sm text-accent hover:underline">Show more</button>}
      </Card>
    </div>
  );
}

export function Customer360({ id, data }: { id: string; data: Customer360Data }) {
  const [tab, setTab] = useState<Tab>("account");
  const u = data.user;
  const failedJobs = data.recentJobs.filter((j) => ["dead_letter", "unknown", "failed"].includes(j.state)).length;
  const items = [
    { id: "account" as Tab, label: "Profile" },
    { id: "workspaces" as Tab, label: "Workspaces", count: data.workspaces.length },
    { id: "activities" as Tab, label: "Activity", count: data.totals.captures },
    { id: "usage" as Tab, label: "Plan and minutes" },
    { id: "processing" as Tab, label: "Processing", count: failedJobs || undefined },
    { id: "more" as Tab, label: "Calendars and history" },
  ];
  return (
    <div className="space-y-5">
      <p className="flex items-center gap-2 text-sm text-muted"><Lock aria-hidden className="size-4 shrink-0" /> Recordings and documents aren&rsquo;t visible to admins. You only see counts and settings.</p>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Metric icon={Video} label="Recordings" value={data.totals.captures ?? 0} />
        <Metric icon={Mic} label="Meetings" value={data.totals.meetings ?? 0} />
        <Metric icon={FileUp} label="Uploads" value={(data.totals.uploads ?? 0) + (data.totals.transcriptImports ?? 0)} />
        <Metric icon={FileText} label="Documents" value={data.totals.documents ?? 0} />
      </div>
      <Tabs label="Customer detail" items={items} active={tab} onChange={setTab} variant="pill" />
      <div id={tabPanelId(tab)} role="tabpanel" aria-labelledby={tabId(tab)}>
        {tab === "account" && (
          <div className="space-y-4">
            <Group title="About this person">
              <Row label="Joined">{fmtUtc(u.createdAt)}</Row>
              <Row label="Last seen">{u.lastActiveAt ? fmtUtc(u.lastActiveAt) : "Never"}</Row>
              <Row label="Time zone">{u.timezone ?? none}</Row>
              <Row label="Profession">{u.profession ?? none}</Row>
              <Row label="Finished setup"><YesNo yes={!!u.onboarded} /></Row>
              <Row label="Role">{u.staffRole?.role ?? (u.isStaff ? "Admin" : "Customer")}</Row>
            </Group>
            <Group title="Sign-in and security">
              <Row label="Signs in with">{u.providers?.length ? u.providers.map((p) => providerLabel(p.provider)).join(", ") : u.hasPassword ? "Email and password" : none}</Row>
              <Row label="Devices signed in">{data.sessions.active} of {data.sessions.total}{data.sessions.lastCreatedAt ? <span className="block text-xs text-muted">Last sign-in {fmtUtc(data.sessions.lastCreatedAt)}</span> : null}</Row>
              <Row label="Account status">{u.suspendedAt ? <span>Suspended on {fmtUtc(u.suspendedAt)}</span> : "Active"}</Row>
              <Row label="Deletion request">{data.deletion ? `${data.deletion.status.replace(/_/g, " ")}, asked ${fmtUtc(data.deletion.requestedAt)}` : "None"}</Row>
            </Group>
            <Group title="Settings">
              <Row label="Meeting recap emails"><YesNo yes={!!u.meetingRecapEmailEnabled} /></Row>
              <Row label="Keeps audio for">{u.audioRetentionDays !== undefined ? `${u.audioRetentionDays} days` : none}</Row>
              <Row label="Meeting bot">{data.preferences ? `${data.preferences.botName ?? "Default name"}` : "Default"}</Row>
            </Group>
            <p className="px-1 text-xs text-muted">Account ID: <code className="break-all">{u.id}</code></p>
          </div>
        )}
        {tab === "workspaces" && (
          <div className="space-y-4">{data.workspaces.length === 0 ? <p className="text-sm text-muted">No workspaces.</p> : data.workspaces.map((w) => (
            <Card key={w.id}><CardHeader title={`Workspace ${shortId(w.id)}`} />
              <dl className="grid gap-x-8 gap-y-5 p-5 sm:grid-cols-3">
                <Row label="Plan"><span className="capitalize">{w.plan}</span></Row>
                <Row label="Role"><span className="capitalize">{w.role}</span>{w.ownerId === id ? " (owner)" : ""}</Row>
                <Row label="Members">{w.memberCount}</Row>
                <Row label="Created">{fmtUtc(w.createdAt)}</Row>
                <Row label="Processing"><Badge tone={w.processingPaused ? "warning" : "success"}>{w.processingPaused ? "Paused" : "Running"}</Badge></Row>
                <Row label="Recordings">{w.captureCounts.reduce((n, c) => n + c.count, 0)}</Row>
              </dl>
              {w.captureCounts.length > 0 && <p className="border-t border-border px-5 py-3 text-xs text-muted">{w.captureCounts.map((c) => `${c.source}/${c.state}: ${c.count}`).join(" · ")}</p>}
            </Card>
          ))}</div>
        )}
        {tab === "activities" && <Activities id={id} />}
        {tab === "usage" && (
          <div className="space-y-4">{data.workspaces.map((w) => (
            <Card key={w.id}><CardHeader title={`Minutes used · workspace ${shortId(w.id)}`} />
              <dl className="grid gap-x-8 gap-y-5 p-5 sm:grid-cols-3">
                <Row label="Month">{w.usage?.period ?? "This month"}</Row>
                <Row label="Used">{w.usage ? `${mins(w.usage.usedSeconds)} of ${mins(w.usage.limitSeconds)}` : "–"}</Row>
                <Row label="Reserved">{w.usage ? mins(w.usage.reservedSeconds) : "–"}</Row>
              </dl>
              {w.credits.length > 0 && <DataTable label="Credit packs"><thead><tr><Th>Order</Th><Th>Pack</Th><Th>Credits</Th><Th>Used / reserved</Th><Th>State</Th><Th>Expires</Th></tr></thead><tbody>{w.credits.map((c) => <tr key={c.id}><Td className="font-mono text-xs">{c.orderId}</Td><Td>{c.sku}</Td><Td>{mins(c.creditsSeconds)}</Td><Td>{mins(c.consumedSeconds)} / {mins(c.reservedSeconds)}</Td><Td>{c.state}</Td><Td className="whitespace-nowrap">{fmtUtc(c.expiresAt)}</Td></tr>)}</tbody></DataTable>}
            </Card>
          ))}</div>
        )}
        {tab === "processing" && (
          <Card><CardHeader title="Recent processing" />
            {data.recentJobs.length === 0 ? <p className="p-5 text-sm text-muted">Nothing processed yet.</p> : <DataTable label="Recent jobs"><thead><tr><Th>Updated</Th><Th>Job</Th><Th>Kind</Th><Th>State</Th><Th>Attempts</Th><Th>Error</Th></tr></thead><tbody>{data.recentJobs.map((j) => <tr key={j.id}><Td className="whitespace-nowrap">{fmtUtc(j.updatedAt)}</Td><Td><Link className="font-mono text-xs text-accent hover:underline" href={`/admin/captures/${j.captureId}`}>{shortId(j.captureId)}</Link></Td><Td>{j.kind}</Td><Td><Badge tone={["dead_letter", "unknown"].includes(j.state) ? "danger" : j.state === "completed" ? "success" : "neutral"}>{j.state}</Badge></Td><Td>{j.attempts}</Td><Td className="max-w-xs break-words text-xs">{j.lastError ?? "–"}</Td></tr>)}</tbody></DataTable>}
          </Card>
        )}
        {tab === "more" && (
          <div className="space-y-4">
            <Card><CardHeader title="Calendars and bookings" />
              <div className="space-y-3 p-5 text-sm">
                {data.connections.length === 0 ? <p className="text-muted">No calendar connected.</p> : data.connections.map((c) => <p key={c.id}>{c.provider} · {c.accountEmail} · {c.calendars} calendars <Badge tone={c.status === "connected" ? "success" : "warning"}>{c.status}</Badge></p>)}
                <p className="text-muted">Bookings: {data.totals.bookings ?? 0} · Meeting insights ready: {data.totals.insightsReady ?? 0}</p>
              </div>
            </Card>
            <Card><CardHeader title="What admins have done on this account" />
              {data.adminHistory.length === 0 ? <p className="p-5 text-sm text-muted">No admin has changed anything on this account.</p> : <DataTable label="Admin history"><thead><tr><Th>When</Th><Th>Action</Th><Th>By</Th><Th>Reason</Th></tr></thead><tbody>{data.adminHistory.map((h) => <tr key={h.id}><Td className="whitespace-nowrap">{fmtUtc(h.createdAt)}</Td><Td>{h.action}</Td><Td>{h.actorEmail ?? "–"}</Td><Td className="max-w-xs break-words">{h.reason}</Td></tr>)}</tbody></DataTable>}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
