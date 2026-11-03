// Staff area PREVIEW MODE: opens the staff screens with sample data and no staff check, so the pages can be designed and
// tried without an account on the staff list. It is development only: it needs NODE_ENV to be non-production AND
// NEXT_PUBLIC_ADMIN_PREVIEW=1, and when it is on, no staff request is ever sent (see adminGet/adminPost). Actions
// (retry, replay, pause, grants...) change the sample data in memory so the screens react, and reset on a page reload.

import type { Json } from "./admin-client";
import { PEOPLE, ago, ahead, auditStore, note, wait } from "./admin-preview-base";
import { parsePeriod, periodDays, periodSpan, type Period } from "./admin-period";
import { ApiError } from "./upload-client";
import { extraGet, extraPost, plansGet, userExtras } from "./admin-preview-extra";
import type { CustomerDetail, CustomerRow, DunningReport, Finding, Overview, PrivacyReport, Reconciliation, RegistryRow, UsageReport, WebhookList, WebhookRow } from "./admin-types";

export const ADMIN_PREVIEW = process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_ADMIN_PREVIEW === "1";

const state = {
  paused: false,
  retriedJobs: new Set<string>(),
  replayed: new Set<string>(),
  fixed: new Set<string>(),
  retriedDeletions: new Set<string>(),
  grants: new Map<string, Json<CustomerDetail>["grants"]>(),
  proUntil: new Map<string, string | null>(),
};

/** Sample business numbers for a window. Per-day rates for the flow, a saturating curve for "people who were active". */
const business = (period: Period): Json<Overview>["business"] => {
  const { plans } = plansGet();
  const monthlyCents = plans.reduce((t, p) => t + p.monthlyCents * p.subscribers, 0);
  const sub = (id: string) => plans.find((p) => p.id === id)?.subscribers ?? 0;
  const TOTAL = 1284;
  const days = periodDays(period) ?? 420;
  const span = periodSpan(period);
  const all = period.key === "all";
  const meetings = Math.round(59 * days);
  return {
    period: { key: period.key, from: span.from, to: span.to },
    newUsers: all ? TOTAL : Math.min(TOTAL, Math.round(5.3 * days)),
    totalUsers: TOTAL,
    activeUsers: Math.min(TOTAL, Math.round(TOTAL * (1 - Math.exp(-days / 12)))),
    paidSubscribers: { total: sub("pro") + sub("business"), pro: sub("pro"), business: sub("business"), newInPeriod: all ? sub("pro") + sub("business") : Math.round(1.1 * days) },
    revenue: { cents: Math.round((monthlyCents / 30) * days), previousCents: all ? null : Math.round(((monthlyCents / 30) * days) / 1.1) },
    meetings: { total: meetings, failed: Math.round(meetings * 0.022) },
    recordings: Math.round(272 * days),
    minutes: Math.round(204 * days),
    costCents: Math.round(395 * days),
    costTargetCents: period.key === "month" ? 10000 : null,
  };
};

const overview = (period: Period): Json<Overview> => ({
  generatedAt: new Date().toISOString(),
  business: business(period),
  paused: state.paused,
  banner: state.paused ? { level: "warning", text: "New processing is paused for everyone." } : null,
  queue: { queued: 3, running: 2, retrying: 2, oldestDueSeconds: 240, stuckRunning: state.retriedJobs.has("7be2f180") ? 0 : 1 },
  last24h: [
    { kind: "Transcription", succeeded: 41, failed: 2, successRate: 95 },
    { kind: "Meeting capture", succeeded: 12, failed: 1, successRate: 92 },
    { kind: "Document generation", succeeded: 37, failed: 0, successRate: 100 },
    { kind: "Video ingest", succeeded: 6, failed: 1, successRate: 86 },
    { kind: "Action items", succeeded: 18, failed: 0, successRate: 100 },
  ],
  meetings7d: { finished: 412, denied: 22, timedOut: 11, failed: 9, deniedRate: 5, timedOutRate: 3 },
  problems: [
    { id: "a41c09d2-77b0-4e21-bb3a-5d0e9f12c801", kind: "video_ingest", status: "failed", captureId: "c-1001", attempts: 5, maxAttempts: 5, lastError: "The meeting platform returned no media link", updatedAt: ago(32), retry: { allowed: true, reason: null } },
    { id: "7be2f180-4c19-4d8a-a5e2-0f3b6d71e9c2", kind: "transcription", status: "running", captureId: "c-1002", attempts: 1, maxAttempts: 5, lastError: null, updatedAt: ago(75), retry: { allowed: true, reason: null } },
    { id: "c0d93a77-12e4-49b6-8f5c-3a8d10b27e65", kind: "meeting_capture", status: "failed", captureId: "c-1003", attempts: 3, maxAttempts: 3, lastError: "Provider timed out", updatedAt: ago(1190), retry: { allowed: false, reason: "The person has to send the assistant again; it is never retried for them." } },
  ].filter((j) => !state.retriedJobs.has(j.id.slice(0, 8))),
});

const customers = (q: string): { customers: Json<CustomerRow>[] } => ({
  customers: PEOPLE.filter((p) => `${p.email} ${p.name} ${p.id}`.toLowerCase().includes(q.toLowerCase())).map((p) => ({ id: p.id, email: p.email, name: p.name, createdAt: ago(p.created * 1440), plan: p.plan, planStatus: p.planStatus })),
});

const customer = (id: string): Json<CustomerDetail> => {
  const p = PEOPLE.find((x) => x.id === id) ?? PEOPLE[0];
  const staffPro = state.proUntil.get(p.id);
  const plan = staffPro ? "pro" : p.plan;
  const allowance = plan === "business" ? 12000 : plan === "pro" ? 3000 : 300;
  const extra = (state.grants.get(p.id) ?? []).reduce((t, g) => t + g.minutes, 0);
  return {
    id: p.id, email: p.email, emailVerified: true, name: p.name, timezone: "Europe/London", role: "founder", onboarded: true, outputsOnly: false, createdAt: ago(p.created * 1440), deletion: null,
    plan: { plan: plan as "free" | "pro" | "business", status: p.planStatus, renewsAt: plan === "free" ? null : ahead(14), graceUntil: p.planStatus === "grace" ? ahead(4) : null, source: staffPro ? "staff" : plan === "free" ? null : "store", storeReference: plan === "free" || staffPro ? null : `order-${p.id.slice(0, 4)}` },
    allowance: { allowanceMinutes: allowance, usedMinutes: 386, purchasedMinutes: 360, remainingMinutes: allowance - 386 + 360 + extra, resetsAt: ahead(18) },
    grants: [...(state.grants.get(p.id) ?? []), { id: "g1", minutes: 120, kind: "grant", expiresAt: ahead(30), reason: "Support case 2210: lost recording", createdAt: ago(9 * 1440), reference: null }, { id: "g2", minutes: 300, kind: "pack", expiresAt: null, reason: null, createdAt: ago(27 * 1440), reference: "order-8841" }],
    connections: [{ id: "k1", provider: "google", status: "connected", connectedAt: ago(40 * 1440), calendars: 2 }],
    counts: { captures: 42, documents: 31, bookings: 9, pages: 2 },
    recentJobs: [{ id: "a41c09d2-77b0-4e21-bb3a-5d0e9f12c801", kind: "video_ingest", status: "failed", captureId: "c-1001", updatedAt: ago(32) }, { id: "e88f21b0-0f4a-4b1c-9d37-6a2c8e50f1d4", kind: "transcription", status: "succeeded", captureId: "c-1000", updatedAt: ago(120) }, { id: "12cd77a9-5b3e-48f0-a1c4-9e7d2b60c385", kind: "document", status: "succeeded", captureId: "c-0999", updatedAt: ago(1500) }],
    recentStoreEvents: [{ id: "w1", provider: "WooCommerce", reference: "order-8841", receivedAt: ago(16 * 1440), note: "Applied: Pro started" }, { id: "w2", provider: "WooCommerce", reference: "sub-3120", receivedAt: ago(16 * 1440), note: "Applied: renewal" }],
  };
};

const registry = (filter: string): { rows: Json<RegistryRow>[] } => {
  const all: Json<RegistryRow>[] = [
    { id: PEOPLE[0].id, email: PEOPLE[0].email, plan: "pro", status: "active", source: "store", endsAt: ahead(14), purchasedMinutes: 360, storeReference: "order-8841" },
    { id: PEOPLE[1].id, email: PEOPLE[1].email, plan: "business", status: "active", source: "store", endsAt: ahead(31), purchasedMinutes: 0, storeReference: "order-7702" },
    { id: PEOPLE[2].id, email: PEOPLE[2].email, plan: "pro", status: "active", source: "staff", endsAt: ahead(30), purchasedMinutes: 120, storeReference: null },
    { id: PEOPLE[3].id, email: PEOPLE[3].email, plan: "pro", status: "grace", source: "store", endsAt: ahead(4), purchasedMinutes: 0, storeReference: "order-6120" },
  ];
  return { rows: filter === "paid" ? all.filter((r) => r.source === "store") : filter === "staff" ? all.filter((r) => r.source === "staff") : filter === "grace" ? all.filter((r) => r.status === "grace") : all };
};

const usage = (): Json<UsageReport> => ({
  days: [["0", "Transcription", 212, 1.27], ["0", "Meeting capture", 160, 3.2], ["1", "Transcription", 340, 2.04], ["1", "Meeting capture", 95, 1.9], ["2", "Transcription", 280, 1.68], ["2", "Meeting capture", 120, 2.4]].map(([d, op, m, c]) => ({ day: new Date(Date.now() - Number(d) * 86_400_000).toISOString().slice(0, 10), operation: String(op), minutes: Number(m), costUsd: Number(c) })),
  month: { minutes: 6120, costUsd: 118.4, targetUsd: 100, guardUsd: 150, overTarget: true, overGuard: false, costKnown: true },
  topCustomers: [{ userId: PEOPLE[1].id, email: PEOPLE[1].email, minutes: 1204 }, { userId: PEOPLE[0].id, email: PEOPLE[0].email, minutes: 386 }, { userId: PEOPLE[2].id, email: PEOPLE[2].email, minutes: 311 }],
  paused: { paused: state.paused, reason: state.paused ? "Paused in preview" : null, by: state.paused ? "preview@jooba.test" : null, at: state.paused ? new Date().toISOString() : null },
});

const hooks = (): Json<WebhookRow>[] => [
  { id: "h1", provider: "WooCommerce", reference: "order-8851", receivedAt: ago(32), processedAt: ago(32), verified: true, duplicates: 0, replays: 0, note: "Applied: Pro started", error: null, customerId: PEOPLE[0].id, health: "ok", replay: { allowed: false, reason: "Already applied; replaying could undo newer changes." } },
  { id: "h2", provider: "WooCommerce", reference: "order-8849", receivedAt: ago(150), processedAt: ago(150), verified: true, duplicates: 0, replays: state.replayed.has("h2") ? 1 : 0, note: "No matching customer", error: null, customerId: null, health: state.replayed.has("h2") ? "ok" : "attention", replay: { allowed: !state.replayed.has("h2"), reason: null } },
  { id: "h3", provider: "Unknown", reference: "unknown", receivedAt: ago(780), processedAt: null, verified: false, duplicates: 0, replays: 0, note: "Bad signature", error: "Signature did not match", customerId: null, health: "rejected", replay: { allowed: false, reason: "Never verified, so it is never trusted." } },
  { id: "h4", provider: "WooCommerce", reference: "order-8845", receivedAt: ago(1440), processedAt: ago(1440), verified: true, duplicates: 2, replays: 0, note: "Applied once", error: null, customerId: PEOPLE[2].id, health: "ok", replay: { allowed: false, reason: "Already applied." } },
];
const webhooks = (filter: string): Json<WebhookList> => {
  const rows = hooks();
  const shown = filter === "attention" ? rows.filter((r) => r.health === "attention") : filter === "rejected" ? rows.filter((r) => r.health === "rejected") : filter === "duplicates" ? rows.filter((r) => r.duplicates > 0) : rows;
  return { rows: shown, counts: { total24h: 48, attention: rows.filter((r) => r.health === "attention").length, rejected24h: 1, duplicates24h: 6 } };
};

const reconciliation = (): Json<Reconciliation> => {
  const findings: Json<Finding>[] = [
    { key: "f1", kind: "grace_overdue", severity: "safe_to_fix", userId: PEOPLE[3].id, email: PEOPLE[3].email, summary: "Priya Nair's plan says Active but the store says ended", detail: "The store ended this subscription on 24 Oct. Only the stored plan status is out of date." },
    { key: "f2", kind: "unmatched_event", severity: "needs_review", userId: null, email: null, summary: "Order 8849 has no matching customer", detail: "A payment arrived for an email we don't have an account for. Money is involved, so a person decides.", webhookId: "h2" },
    { key: "f3", kind: "refund_review", severity: "needs_review", userId: PEOPLE[2].id, email: PEOPLE[2].email, summary: "Daniel Reyes has a staff grant and a store order", detail: "Both are active at once. Check which should apply." },
  ];
  return { findings: findings.filter((f) => !state.fixed.has(f.key)), unreconciledUsage: 4, checkedAt: new Date().toISOString() };
};

const dunning = (empty = false): Json<DunningReport> =>
  empty ? { rows: [], counts: { grace: 0, pending: 0, expired30d: 0 } } : {
    rows: [
      { userId: PEOPLE[3].id, email: PEOPLE[3].email, status: "grace", since: ago(6 * 1440), endsAt: ahead(4), storeReference: "sub-6120", storeUrl: null, lastStoreEvent: { receivedAt: ago(6 * 1440), note: "payment.failed" }, recovery: "Moves to Free on its end date unless the payment succeeds." },
      { userId: PEOPLE[4].id, email: PEOPLE[4].email, status: "pending_activation", since: ago(180), endsAt: null, storeReference: "order-8860", storeUrl: null, lastStoreEvent: { receivedAt: ago(180), note: "order.created" }, recovery: "Nothing changes until the store confirms payment." },
      { userId: PEOPLE[5].id, email: PEOPLE[5].email, status: "expired", since: ago(9 * 1440), endsAt: ago(9 * 1440), storeReference: "sub-5512", storeUrl: null, lastStoreEvent: { receivedAt: ago(9 * 1440), note: "subscription.ended" }, recovery: "On Free. All work is kept." },
    ],
    counts: { grace: 1, pending: 1, expired30d: 3 },
  };

const privacy = (): Json<PrivacyReport> => ({
  deletions: [
    { id: "d1", status: "partial_failure", requestedAt: ago(2 * 1440), startedAt: ago(2 * 1440), completedAt: null, attempts: 3, filesRemoved: 11, filesFailed: 2, lastError: "Storage returned a timeout", nextAttemptAt: ahead(0.02), customerId: PEOPLE[5].id, email: PEOPLE[5].email, fingerprint: "9d41c2e0", retry: { allowed: !state.retriedDeletions.has("d1"), reason: state.retriedDeletions.has("d1") ? "Retried just now; the next attempt is already running." : null } },
    { id: "d2", status: "completed", requestedAt: ago(4 * 1440), startedAt: ago(4 * 1440), completedAt: ago(3 * 1440), attempts: 1, filesRemoved: 24, filesFailed: 0, lastError: null, nextAttemptAt: null, customerId: null, email: null, fingerprint: "b0e7a913", retry: { allowed: false, reason: "Already complete." } },
  ],
  audit: [...auditStore.map((e) => ({ id: e.id, at: e.at, actor: e.actor, action: e.action, target: e.target, customerId: e.customerId, reason: e.reason })),
    { id: "a-1", at: ago(40), actor: "preview@jooba.test", action: "Opened an account", target: PEOPLE[0].id.slice(0, 8), customerId: PEOPLE[0].id, reason: "Support case 2210" },
    { id: "a-2", at: ago(2 * 1440), actor: "kim@jooba.test", action: "Ran a store message again", target: "order-8849", customerId: null, reason: "Customer has now signed up" },
  ],
});

/** The window the screen asked for. A range that isn't a real, past, ordered pair of dates is refused, as the server must. */
function previewPeriod(params: URLSearchParams): Period {
  if (params.get("period") === "range") {
    const p = parsePeriod((k) => params.get(k));
    if (p.key !== "range") throw new ApiError(400, "Pick a start and an end date, with the start first, and none in the future.", "invalid_range");
    return p;
  }
  return parsePeriod((k) => params.get(k));
}

/** Answers a staff GET from the sample data. */
export async function previewGet<T>(url: string): Promise<T> {
  const u = new URL(url, "http://preview.local");
  const p = u.pathname.replace("/api/admin/", "");
  const more = await extraGet(p, u.searchParams);
  if (more !== undefined) return more as T;
  await wait();
  const out: unknown =
    p === "overview" ? overview(previewPeriod(u.searchParams)) :
    p === "customers" ? customers(u.searchParams.get("q") ?? "") :
    p.startsWith("customers/") ? { ...customer(p.split("/")[1]), ...userExtras(p.split("/")[1]) } :
    p === "registry" ? registry(u.searchParams.get("filter") ?? "all") :
    p === "usage" ? usage() :
    p === "webhooks" ? webhooks(u.searchParams.get("filter") ?? "all") :
    p === "reconciliation" ? reconciliation() :
    p === "dunning" ? dunning() :
    p === "privacy" ? privacy() : null;
  if (out === null) throw new Error(`Preview has no sample data for ${p}.`);
  return out as T;
}

/** Pretends to do a staff action: changes the sample data in memory and sends nothing anywhere. */
const noteAs = (action: string, target: string, reason: unknown, customerId: string | null = null) => note(action, target, reason, customerId);

export async function previewPost<T>(url: string, body: unknown, method: "POST" | "PATCH" = "POST"): Promise<T> {
  const more = await extraPost(method, url, body);
  if (more !== undefined) return more as T;
  await wait(350);
  const b = (body ?? {}) as Record<string, unknown>;
  let m: RegExpMatchArray | null;
  if ((m = url.match(/jobs\/([^/]+)\/retry/))) { state.retriedJobs.add(m[1].slice(0, 8)); noteAs("Tried a task again", m[1].slice(0, 8), b.reason); }
  else if ((m = url.match(/webhooks\/([^/]+)\/replay/))) { state.replayed.add(m[1]); noteAs("Ran a store message again", m[1], b.reason); return { result: "Applied: the delivery matched a customer and was processed." } as T; }
  else if (url.includes("controls/processing")) { state.paused = b.paused === true; noteAs(state.paused ? "Paused processing" : "Resumed processing", "all customers", b.reason); }
  else if ((m = url.match(/reconciliation$/))) { state.fixed.add(b.userId === PEOPLE[3].id ? "f1" : String(b.userId)); noteAs("Fixed a plan record", String(b.userId).slice(0, 8), b.reason); }
  else if ((m = url.match(/privacy\/deletions\/([^/]+)\/retry/))) { state.retriedDeletions.add(m[1]); noteAs("Tried a deletion again", m[1], b.reason); }
  else if ((m = url.match(/entitlements\/([^/]+)$/))) {
    const id = m[1];
    if (b.action === "grant" || b.action === "correct") state.grants.set(id, [{ id: `g${Date.now()}`, minutes: (b.action === "correct" ? -1 : 1) * Number(b.minutes ?? 0), kind: b.action === "correct" ? "correction" : "grant", expiresAt: (b.expiresAt as string) ?? null, reason: (b.reason as string) ?? null, createdAt: new Date().toISOString(), reference: null }, ...(state.grants.get(id) ?? [])]);
    if (b.action === "grant_pro") state.proUntil.set(id, (b.expiresAt as string) ?? ahead(30));
    if (b.action === "clear_pro") state.proUntil.delete(id);
    noteAs(`Admin action: ${String(b.action)}`, id.slice(0, 8), b.reason, id);
  }
  return { ok: true } as T;
}
