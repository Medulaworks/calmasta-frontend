// Sample data for the newer staff screens in preview mode: system health, the user directory, settings, integrations and
// the audit log. Development only; see admin-preview.ts for the switch. Nothing here talks to a server.

import type { Json } from "./admin-client";
import type { AdminInvite, AdminList, AdminMember, AdminPack, AdminPlan, PlanList, AdminSetting, AdminSettings, AuditPage, Integration, ServiceStatus, SystemHealth, UserExtras, UserList, UserRow } from "./admin-types";
import { PEOPLE, PREVIEW_ACTOR, ago, auditStore, note, wait } from "./admin-preview-base";
import { ApiError } from "./upload-client";

// ---------------------------------------------------------------- health
const days = (pattern: Array<[number, ServiceStatus]>): ServiceStatus[] => {
  const out: ServiceStatus[] = Array(30).fill("operational");
  for (const [daysAgo, s] of pattern) out[29 - daysAgo] = s;
  return out;
};
const uptime = (d: ServiceStatus[]) => Math.round((d.filter((x) => x === "operational").length / d.length) * 1000) / 10;

const svc = (id: string, name: string, group: "Core" | "Providers" | "Integrations", status: ServiceStatus, detail: string | null, latencyMs: number | null, d: ServiceStatus[], checked = 1) => ({
  id, name, group, status, detail, latencyMs, days: d, uptime30d: status === "unknown" ? null : uptime(d), lastCheckedAt: status === "unknown" ? null : ago(checked),
});

export function healthData(): Json<SystemHealth> {
  const services = [
    svc("web", "Web app", "Core", "operational", null, 41, days([])),
    svc("api", "API", "Core", "operational", null, 84, days([[12, "degraded"]])),
    svc("db", "Database", "Core", "operational", null, 12, days([])),
    svc("queue", "Processing queue", "Core", "degraded", "Some work is taking longer than usual. The oldest has waited 4 minutes.", null, days([[0, "degraded"], [9, "degraded"]]), 0),
    svc("transcription", "Transcription (AssemblyAI)", "Providers", "operational", null, 220, days([[20, "degraded"]])),
    svc("bot", "Meeting assistant (Recall)", "Providers", "degraded", "Admission is slower than usual on Zoom.", 310, days([[0, "degraded"], [1, "degraded"], [15, "down"]])),
    svc("documents", "Documents (OpenAI)", "Providers", "operational", null, 640, days([])),
    svc("storage", "Private storage (R2)", "Providers", "down", "The last bucket check timed out.", null, days([[0, "down"], [2, "degraded"]]), 6),
    svc("calendar", "Google Calendar", "Integrations", "operational", null, 180, days([])),
    svc("email", "Email (SMTP)", "Integrations", "unknown", "Not checked automatically: a check would send a real email. Run it from Integrations when you need to.", null, days([])),
  ];
  return {
    environment: "preview",
    generatedAt: new Date().toISOString(),
    overall: "degraded",
    services,
    workers: [
      { name: "Transcripts", status: "operational", lastHeartbeatAt: ago(0.4), jobsInFlight: 2 },
      { name: "Meeting recording", status: "operational", lastHeartbeatAt: ago(0.7), jobsInFlight: 1 },
      { name: "Documents", status: "degraded", lastHeartbeatAt: ago(6), jobsInFlight: 0 },
      { name: "Video import", status: "unknown", lastHeartbeatAt: null, jobsInFlight: null },
    ],
    incidents: [
      { id: "i1", title: "Private storage checks are timing out", service: "Private storage (R2)", severity: "major", startedAt: ago(48), resolvedAt: null, note: "New video and audio saves are retrying. Existing files are not affected." },
      { id: "i2", title: "Slow admission on Zoom", service: "Meeting assistant (Recall)", severity: "minor", startedAt: ago(1500), resolvedAt: null, note: "Provider reports delays; no action needed from us." },
      { id: "i3", title: "Meeting assistant unavailable", service: "Meeting assistant (Recall)", severity: "major", startedAt: ago(15 * 1440), resolvedAt: ago(15 * 1440 - 95), note: "Provider outage. Captures started in this window were retried." },
    ],
    queueDepth: [1, 1, 2, 2, 3, 2, 2, 4, 5, 4, 3, 3, 2, 2, 3, 6, 7, 5, 4, 3, 3, 2, 3, 3],
  };
}

// ---------------------------------------------------------------- users
const EXTRA_NAMES = ["Noah Kim", "Sofia Rossi", "Liam Chen", "Zara Ahmed", "Mateo Silva", "Ines Duarte", "Omar Haddad", "Elena Petrova", "Kofi Mensah", "Hana Sato", "Lucas Meyer", "Aisha Bello", "Ravi Patel", "Mia Johansson", "Tariq Aziz", "Nora Lindqvist", "Diego Alvarez", "Yara Khoury", "Felix Braun", "Ada Eze", "Pablo Ortega", "Leila Samadi", "Henrik Dahl", "Grace Mwangi"];
const PLANS = ["free", "free", "pro", "free", "business", "pro"];
const PROVIDERS = [["password"], ["google"], ["password", "google"], ["microsoft"]];

const ROSTER: Json<UserRow>[] = [
  ...PEOPLE.map((p, i) => ({ id: p.id as string, email: p.email as string, name: p.name as string | null, createdAt: ago(p.created * 1440), lastActiveAt: ago(i * 97 + 12) as string | null, plan: p.plan as string, planStatus: p.planStatus as string, emailVerified: true, providers: PROVIDERS[i % 4], status: "active" as const, staff: false })),
  ...EXTRA_NAMES.map((n, i) => ({ id: `d${String(i).padStart(2, "0")}c4a1f0-5b2e-4c7d-9e31-${String(i * 7919).padStart(12, "0")}`, email: `${n.toLowerCase().replace(/[^a-z]+/g, ".")}@example.test`, name: n as string | null, createdAt: ago((i + 3) * 1700), lastActiveAt: (i % 7 === 0 ? null : ago(i * 380 + 30)) as string | null, plan: PLANS[i % 6], planStatus: "active", emailVerified: i % 9 !== 4, providers: PROVIDERS[i % 4], status: "active" as const, staff: false })),
  { id: "9e5a30b8-1d47-4c62-8f09-a7b3d2e61c50", email: "kim@jooba.test", name: "Kim Adeyemi", createdAt: ago(210 * 1440), lastActiveAt: ago(3), plan: "business", planStatus: "active", emailVerified: true, providers: ["password"], status: "active", staff: true },
];

const edits = new Map<string, { name?: string; timezone?: string; role?: string }>();
const suspended = new Map<string, string>();
const cooldown = new Map<string, number>();
const revoked = new Set<string>();

const row = (u: Json<UserRow>): Json<UserRow> => ({ ...u, name: edits.get(u.id)?.name ?? u.name, status: suspended.has(u.id) ? "suspended" : "active" });

export function userList(params: URLSearchParams): Json<UserList> {
  const q = (params.get("q") ?? "").trim().toLowerCase();
  const plan = params.get("plan") ?? "all";
  const status = params.get("status") ?? "all";
  const verified = params.get("verified") ?? "all";
  const offset = Number(params.get("cursor") ?? "0") || 0;
  const all = ROSTER.map(row).filter((u) =>
    (!q || `${u.email} ${u.name ?? ""} ${u.id}`.toLowerCase().includes(q)) &&
    (plan === "all" || u.plan === plan) &&
    (status === "all" || u.status === status) &&
    (verified === "all" || (verified === "yes") === u.emailVerified),
  );
  const page = all.slice(offset, offset + 10);
  return { users: page, nextCursor: offset + 10 < all.length ? String(offset + 10) : null, total: all.length };
}

export function userExtras(id: string): Json<UserExtras> & { name?: string | null; timezone?: string; role?: string | null } {
  const u = ROSTER.find((x) => x.id === id) ?? ROSTER[0];
  const e = edits.get(u.id) ?? {};
  const allowance = u.plan === "business" ? 12000 * 60 : u.plan === "pro" ? 3000 * 60 : 300 * 60;
  return {
    status: suspended.has(u.id) ? "suspended" : "active",
    suspendedReason: suspended.get(u.id) ?? null,
    staff: u.staff,
    providers: u.providers,
    lastActiveAt: u.lastActiveAt,
    sessions: revoked.has(u.id) ? [] : [
      { id: "s1", device: "Chrome on macOS", ip: "82.14.9.•••", lastSeenAt: ago(8), current: false },
      { id: "s2", device: "Safari on iPhone", ip: "82.14.9.•••", lastSeenAt: ago(1900), current: false },
    ],
    workspaces: [{ id: `w-${u.id.slice(0, 6)}`, name: `${(u.name ?? u.email).split(" ")[0]}'s workspace`, role: "owner", usedSeconds: 386 * 60, allowanceSeconds: allowance, processingPaused: false }],
    ...(e.name !== undefined ? { name: e.name } : {}),
    ...(e.timezone !== undefined ? { timezone: e.timezone } : {}),
    ...(e.role !== undefined ? { role: e.role } : {}),
  };
}

// ---------------------------------------------------------------- settings
const MB = 1_000_000;
const S = (s: Omit<AdminSetting, "help" | "reason" | "source" | "editable" | "applyMode"> & Partial<AdminSetting>): AdminSetting => ({ help: null, reason: null, source: "default", editable: true, applyMode: "live", ...s });
let settingsVersion = 7;
let settingsMeta = { updatedAt: ago(3 * 1440) as string | null, updatedBy: "kim@jooba.test" as string | null };
const settingsList: AdminSetting[] = [
  S({ key: "AUDIO_RETENTION_DAYS", label: "Keep original audio", group: "Allowance and limits", help: "Original audio is removed after this long. Transcripts and documents stay.", kind: "integer", value: 30, unit: "days", min: 1, max: 365 }),
  S({ key: "MEETING_MAX_DURATION_SECONDS", label: "Longest meeting", group: "Allowance and limits", help: "The assistant stops recording after this long. 0 turns meeting capture off.", kind: "integer", value: 7_200, unit: "seconds", min: 0, max: 7_200 }),
  S({ key: "UPLOAD_MAX_BYTES", label: "Largest audio upload", group: "Allowance and limits", kind: "integer", value: 100 * MB, unit: "bytes", min: 44, max: 100 * MB }),
  S({ key: "UPLOAD_MAX_DURATION_SECONDS", label: "Longest audio upload", group: "Allowance and limits", kind: "integer", value: 36_000, unit: "seconds", min: 1, max: 36_000 }),
  S({ key: "RECALL_BOT_NAME", label: "Assistant's name in meetings", group: "Meeting assistant", help: "Shown to everyone in the meeting. A single meeting can still use its own name.", kind: "string", value: "Jooba Assistant", min: 1, max: 100, source: "admin" }),
  S({ key: "CAPTURE_VIDEO_ENABLED", label: "Record meeting video", group: "Meeting assistant", help: "Only turn this on once private video storage and video processing are ready.", kind: "boolean", value: false, reason: "Private storage is currently failing its check, so keep this off." }),
  S({ key: "CAPTURE_VIDEO_MAX_BYTES", label: "Largest meeting video", group: "Meeting assistant", kind: "integer", value: 250 * MB, unit: "bytes", min: 1_024, max: 500 * MB }),
  S({ key: "LIVE_PROCESSING_ENABLED", label: "Live processing", group: "Meeting assistant", help: "What staff want. It only takes effect while the server's emergency switch also allows live work.", kind: "boolean", value: true, applyMode: "pending", reason: "Effective right now: the emergency switch is on." }),
  S({ key: "GLOBAL_SPEND_GUARD_USD_PER_DAY", label: "Daily spend limit", group: "Spend guards", help: "New paid work stops when estimated spend for the day reaches this.", kind: "decimal", value: 150, unit: "usd_per_day", min: 1, max: 200, source: "environment", editable: false, reason: "Set by the server environment. Remove that override to manage it here.", applyMode: "operator_only" }),
  S({ key: "RECALL_MAX_COST_MICROS_PER_HOUR", label: "Meeting assistant cost per hour (reserved)", group: "Spend guards", help: "A cautious reservation per meeting hour, not an invoice. 0 blocks new meeting captures.", kind: "integer", value: 6_000_000, unit: "micros_per_hour", min: 0, max: 200_000_000 }),
  S({ key: "ASSEMBLY_MAX_COST_MICROS_PER_HOUR", label: "Transcription cost per hour (reserved)", group: "Spend guards", help: "Changes apply to new work only; existing reservations keep their rate.", kind: "integer", value: 2_000_000, unit: "micros_per_hour", min: 0, max: 200_000_000 }),
  S({ key: "LLM_MODEL", label: "Document model", group: "Managed by the operator", kind: "string", value: "gpt-4o-mini", editable: false, reason: "Fixed by the code. There is no model picker.", applyMode: "operator_only" }),
  S({ key: "APP_PUBLIC_URL", label: "App address", group: "Managed by the operator", kind: "string", value: "https://myjooba-staging.vercel.app", editable: false, reason: "Controlled by the deployment and the sign-in provider registrations.", applyMode: "operator_only" }),
  S({ key: "PUBLIC_API_BASE_URL", label: "API address", group: "Managed by the operator", kind: "string", value: "https://calmasta-api.lumenarchapiforge.online", editable: false, reason: "Controlled by the deployment. It drives provider callbacks.", applyMode: "operator_only" }),
];

export const settingsData = (): Json<AdminSettings> => ({ version: settingsVersion, environment: "preview", generatedAt: new Date().toISOString(), updatedAt: settingsMeta.updatedAt, updatedBy: settingsMeta.updatedBy, settings: settingsList.map((s) => ({ ...s })) as Json<AdminSetting>[] });

// ---------------------------------------------------------------- integrations
type F = Json<Integration>["fields"][number];
const text = (key: string, label: string, value: string, extra: Partial<F> = {}): F => ({ key, label, kind: "text", configured: !!value, value, editable: true, ...extra });
const secret = (key: string, label: string, configured = true, extra: Partial<F> = {}): F => ({ key, label, kind: "secret", configured, editable: true, ...extra });
const integrations: Json<Integration>[] = [
  { id: "google_login", name: "Google sign-in", category: "Sign-in", usedFor: "Lets people sign in with their Google account.", status: "verified", region: null, lastCheckedAt: ago(1300), lastError: null, impact: "Changing the client can stop existing Google sign-ins from linking.", fields: [text("client_id", "Client ID", "5128…-ab9x.apps.googleusercontent.com"), secret("client_secret", "Client secret"), text("redirect_uri", "Redirect address", "https://myjooba-staging.vercel.app/api/auth/callback", { editable: false, reason: "Derived from the approved app address." })] },
  { id: "microsoft_login", name: "Microsoft sign-in", category: "Sign-in", usedFor: "Lets people sign in with a Microsoft account.", status: "configured", region: null, lastCheckedAt: null, lastError: null, impact: "Uses the Microsoft Calendar credentials unless its own are set, so a change here can affect Calendar too.", fields: [text("client_id", "Client ID", "", { reason: "Falling back to the Calendar client." }), secret("client_secret", "Client secret", false)] },
  { id: "google_calendar", name: "Google Calendar", category: "Calendar", usedFor: "Reads people's calendars and keeps bookings in sync.", status: "verified", region: null, lastCheckedAt: ago(900), lastError: null, impact: "Changing the client can require everyone to reconnect their calendar.", fields: [text("client_id", "Client ID", "5128…-cal7q.apps.googleusercontent.com"), secret("client_secret", "Client secret")] },
  { id: "microsoft_calendar", name: "Microsoft Calendar", category: "Calendar", usedFor: "Reads Outlook calendars (and backs Microsoft sign-in by default).", status: "verified", region: null, lastCheckedAt: ago(900), lastError: null, impact: "Affects Calendar and the Microsoft sign-in fallback together.", fields: [text("client_id", "Client ID", "a4c1…-77f2"), secret("client_secret", "Client secret")] },
  { id: "recall", name: "Recall", category: "Meetings", usedFor: "Sends the meeting assistant into Meet, Teams and Zoom.", status: "verified", region: "us-west-2", lastCheckedAt: ago(35), lastError: null, impact: "Bots already in meetings keep their region. The key and region must belong to the same workspace.", fields: [secret("api_key", "API key"), { key: "region", label: "Region", kind: "select", configured: true, value: "us-west-2", options: ["us-west-2", "us-east-1", "eu-central-1", "ap-northeast-1"], editable: true }, secret("webhook_secret", "Webhook signing secret")] },
  { id: "assemblyai", name: "AssemblyAI", category: "Transcription", usedFor: "Turns recordings into transcripts.", status: "verified", region: "us", lastCheckedAt: ago(35), lastError: null, impact: "Replace the key and the callback secret together. Jobs in flight keep the old callback secret until they finish.", fields: [secret("api_key", "API key"), { key: "region", label: "Region", kind: "select", configured: true, value: "us", options: ["us", "eu"], editable: true }, secret("webhook_secret", "Webhook signing secret")] },
  { id: "r2", name: "Private media storage (R2)", category: "Storage", usedFor: "Holds recordings and video, privately.", status: "failing", region: "auto", lastCheckedAt: ago(6), lastError: "The bucket check timed out after 10 seconds.", impact: "Changing the endpoint or bucket can strand existing files. An operator should plan that.", fields: [text("endpoint", "Endpoint", "https://acct.r2.cloudflarestorage.com", { editable: false, reason: "Operator only: a change can strand stored files." }), text("bucket", "Bucket", "jooba-private", { editable: false, reason: "Operator only: needs a file and retention migration plan." }), text("access_key_id", "Access key ID", "AKIA•••••••••••Q4"), secret("secret_access_key", "Secret access key")] },
  { id: "smtp", name: "Email (SMTP)", category: "Email", usedFor: "Sends verification codes, recovery codes and booking emails.", status: "configured", region: null, lastCheckedAt: null, lastError: null, impact: "Host, port and security are checked together. A wrong value stops sign-up and reset emails.", fields: [text("host", "Host", "smtp.example.test"), text("port", "Port", "587"), { key: "secure", label: "Security", kind: "select", configured: true, value: "STARTTLS (587)", options: ["STARTTLS (587)", "Implicit TLS (465)"], editable: true }, text("user", "Username", "ma•••@example.test"), secret("pass", "Password"), text("email_from", "Sender address", "Jooba <no-reply@example.test>")] },
  { id: "openai", name: "OpenAI", category: "AI", usedFor: "Writes documents and finds action items from transcripts.", status: "verified", region: null, lastCheckedAt: ago(35), lastError: null, impact: "Only the key can change. The model is fixed in the code.", fields: [secret("api_key", "API key"), text("model", "Model", "gpt-4o-mini", { editable: false, reason: "Fixed by the code. There is no model picker." })] },
];

// ---------------------------------------------------------------- audit
const ACTIONS: Array<[string, "success" | "denied" | "failed"]> = [["Opened an account", "success"], ["Added minutes", "success"], ["Tried a task again", "success"], ["Ran a store message again", "success"], ["Changed settings", "success"], ["Changed keys", "success"], ["Suspended account", "success"], ["Signed a user out everywhere", "success"], ["Paused processing", "success"], ["Admin action without permission", "denied"], ["Tested a connection", "failed"], ["Fixed a plan record", "success"]];
const ACTORS = ["kim@jooba.test", "sam@jooba.test", "preview@jooba.test"];
const baseAudit = Array.from({ length: 64 }, (_, i) => {
  const [action, outcome] = ACTIONS[(i * 5 + 2) % ACTIONS.length];
  const p = PEOPLE[(i * 3) % PEOPLE.length];
  return { id: `b${i}`, at: ago(i * 130 + 25), actor: ACTORS[i % 3] as string | null, action, target: (action.includes("credential") ? "Recall (api_key)" : action.includes("settings") ? "FREE_MONTHLY_SECONDS" : p.id.slice(0, 8)) as string | null, customerId: (action === "Opened an account" || action === "Added minutes" || action.includes("Suspend") ? p.id : null) as string | null, reason: (outcome === "denied" ? "Blocked by the server: this account has no permission for that action." : `Support case ${2200 + i}`) as string | null, outcome, correlationId: `req_${(0x9f3a21 + i * 7777).toString(16)}` };
});

export function auditGet(params: URLSearchParams): Json<AuditPage> {
  const q = (params.get("q") ?? "").trim().toLowerCase();
  const outcome = params.get("outcome") ?? "all";
  const action = params.get("action") ?? "all";
  const offset = Number(params.get("cursor") ?? "0") || 0;
  const all = [...auditStore, ...baseAudit].filter((e) => (outcome === "all" || e.outcome === outcome) && (action === "all" || e.action === action) && (!q || `${e.actor} ${e.action} ${e.target} ${e.reason} ${e.correlationId}`.toLowerCase().includes(q)));
  return { entries: all.slice(offset, offset + 15), nextCursor: offset + 15 < all.length ? String(offset + 15) : null };
}
export const AUDIT_ACTIONS = ACTIONS.map(([a]) => a);

// ---------------------------------------------------------------- admins
const admins: Json<AdminMember>[] = [
  { id: "p-0001", email: PREVIEW_ACTOR, name: "Preview Admin", addedAt: ago(90 * 1440), addedBy: "Set up by the tech team", lastSignInAt: ago(2), you: true },
  { id: "p-0002", email: "kim@jooba.test", name: "Kim Alvarez", addedAt: ago(60 * 1440), addedBy: PREVIEW_ACTOR, lastSignInAt: ago(9 * 60), you: false },
  { id: "p-0003", email: "sam@jooba.test", name: "Sam Whitfield", addedAt: ago(21 * 1440), addedBy: "kim@jooba.test", lastSignInAt: ago(3 * 1440), you: false },
];
const invites: Json<AdminInvite>[] = [
  { id: "i-0001", email: "lena@example.test", invitedBy: "kim@jooba.test", invitedAt: ago(2 * 1440), expiresAt: new Date(Date.now() + 5 * 86_400_000).toISOString() },
  { id: "i-0002", email: "noah.kim@example.test", invitedBy: PREVIEW_ACTOR, invitedAt: ago(9 * 1440), expiresAt: new Date(Date.now() - 2 * 86_400_000).toISOString() },
];
const resentAt = new Map<string, number>();
export const adminsGet = (): Json<AdminList> => ({ admins: admins.map((a) => ({ ...a })), invites: invites.map((i) => ({ ...i })) });
const INVITE_DAYS = 7;

/** Sample answer for the invite page, by token. "expired" and "used" show those states; anything else is a fresh invite. */
export function inviteDetails(token: string) {
  const status = token === "expired" ? "expired" : token === "used" ? "accepted" : "pending";
  return { email: "preview@jooba.test", invitedBy: "kim@jooba.test", expiresAt: new Date(Date.now() + (status === "expired" ? -86_400_000 : 5 * 86_400_000)).toISOString(), status };
}

// ---------------------------------------------------------------- plans
// The same three plans, allowances and yearly discount the app shows today (see DUMMY_PLAN in plan-client.ts).
const plans: Json<AdminPlan>[] = [
  { id: "free", name: "Free", tagline: "For trying Jooba and for occasional recordings.", monthlyCents: 0, allowanceMinutes: 120, checkoutMonthlyUrl: null, checkoutYearlyUrl: null, subscribers: 2140, updatedAt: ago(60 * 1440) },
  { id: "pro", name: "Pro", tagline: "For people who record and write up conversations every week.", monthlyCents: 1900, allowanceMinutes: 600, checkoutMonthlyUrl: "https://shop.example.test/checkout/pro-monthly", checkoutYearlyUrl: "https://shop.example.test/checkout/pro-yearly", subscribers: 318, updatedAt: ago(12 * 1440) },
  { id: "business", name: "Business", tagline: "For people who record all day, every day, and never want to count hours.", monthlyCents: 4900, allowanceMinutes: 3000, checkoutMonthlyUrl: "https://shop.example.test/checkout/business-monthly", checkoutYearlyUrl: null, subscribers: 41, updatedAt: ago(30 * 1440) },
];
const packs: Json<AdminPack>[] = [
  { sku: "pack-60", label: "1 hour", minutes: 60, checkoutUrl: "https://shop.example.test/checkout/pack-60" },
  { sku: "pack-300", label: "5 hours", minutes: 300, checkoutUrl: "https://shop.example.test/checkout/pack-300" },
  { sku: "pack-1200", label: "20 hours", minutes: 1200, checkoutUrl: null },
];
const pricing = { annualDiscountPct: 20, enterpriseUrl: null as string | null };
export const plansGet = (): Json<PlanList> => ({ plans: plans.map((p) => ({ ...p })), packs: packs.map((k) => ({ ...k })), ...pricing });

const httpsUrl = (v: unknown, what: string): string | null => {
  if (v === null || v === undefined || v === "") return null;
  try {
    const u = new URL(String(v));
    if (u.protocol === "https:") return u.href;
  } catch { /* falls through to the error */ }
  throw new ApiError(400, `${what} must be a web address starting with https://.`, "invalid_url");
};
const whole = (v: unknown, lo: number, hi: number) => (Number.isInteger(v) && (v as number) >= lo && (v as number) <= hi ? (v as number) : null);

// ---------------------------------------------------------------- routing// ---------------------------------------------------------------- routing
/** Answers the newer staff screens, or returns undefined so the original sample data can answer. */
export async function extraGet(path: string, params: URLSearchParams): Promise<unknown | undefined> {
  if (path === "health") { await wait(); return healthData(); }
  if (path === "customers") { await wait(); return userList(params); }
  if (path === "settings") { await wait(); return settingsData(); }
  if (path === "integrations") { await wait(); return integrations.map((i) => ({ ...i, fields: i.fields.map((f) => ({ ...f })) })); }
  if (path === "audit") { await wait(); return auditGet(params); }
  if (path === "staff") { await wait(); return adminsGet(); }
  if (path === "plans") { await wait(); return plansGet(); }
  return undefined;
}

/** Pretends to do the newer staff actions (in memory only), or returns undefined for the original ones. */
export async function extraPost(method: "POST" | "PATCH", url: string, body: unknown): Promise<unknown | undefined> {
  const b = (body ?? {}) as Record<string, unknown>;
  const path = url.replace("/api/admin/", "");
  let m: RegExpMatchArray | null;

  if (method === "PATCH" && (m = path.match(/^customers\/([^/]+)$/))) {
    await wait(350);
    const id = m[1];
    const cur = edits.get(id) ?? {};
    edits.set(id, { ...cur, ...(typeof b.name === "string" ? { name: b.name } : {}), ...(typeof b.timezone === "string" ? { timezone: b.timezone } : {}), ...(typeof b.role === "string" ? { role: b.role } : {}) });
    note("Edited profile", id.slice(0, 8), b.reason, id);
    return { ok: true };
  }
  if (method === "POST" && (m = path.match(/^customers\/([^/]+)\/actions$/))) {
    await wait(380);
    const id = m[1];
    const action = String(b.action);
    if (action === "send_recovery" || action === "send_verification") {
      const key = `${id}:${action}`;
      if ((cooldown.get(key) ?? 0) > Date.now()) throw new ApiError(429, "A message was sent a moment ago. Please wait a minute before sending another.", "too_many_requests");
      cooldown.set(key, Date.now() + 60_000);
      note(action === "send_recovery" ? "Sent a password reset email" : "Sent a confirm email", id.slice(0, 8), b.reason, id);
    } else if (action === "suspend") { suspended.set(id, String(b.reason ?? "")); note("Suspended account", id.slice(0, 8), b.reason, id); }
    else if (action === "reactivate") { suspended.delete(id); note("Reactivated account", id.slice(0, 8), b.reason, id); }
    else if (action === "revoke_sessions") { revoked.add(id); note("Signed a user out everywhere", id.slice(0, 8), b.reason, id); }
    else throw new ApiError(400, "That action isn't supported.", "unsupported_action");
    return { ok: true };
  }
  if (method === "PATCH" && path === "plans/pricing") {
    await wait(400);
    const pct = whole(b.annualDiscountPct, 0, 90);
    if (pct === null) throw new ApiError(400, "The yearly discount is a whole number from 0 to 90.", "invalid_discount");
    pricing.annualDiscountPct = pct;
    pricing.enterpriseUrl = httpsUrl(b.enterpriseUrl, "The custom-terms link");
    note("Changed the yearly discount", `${pct}% off`, null);
    return { ok: true };
  }
  if (method === "PATCH" && (m = path.match(/^plans\/(free|pro|business)$/))) {
    await wait(450);
    const cur = plans.find((p) => p.id === m![1])!;
    const monthlyCents = whole(b.monthlyCents, 0, 9_999_999), allowanceMinutes = whole(b.allowanceMinutes, 0, 1_000_000);
    if (monthlyCents === null) throw new ApiError(400, "Enter a monthly price.", "invalid_price");
    if (allowanceMinutes === null) throw new ApiError(400, "Enter the monthly allowance.", "invalid_allowance");
    if (cur.id === "free" && monthlyCents !== 0) throw new ApiError(409, "The Free plan stays free.", "free_plan_locked");
    if (cur.id !== "free" && monthlyCents === 0) throw new ApiError(400, "A paid plan needs a price above $0.", "invalid_price");
    const tagline = String(b.tagline ?? "").trim();
    if (tagline.length > 100) throw new ApiError(400, "Keep the description under 100 characters.", "invalid_tagline");
    const priceChanged = monthlyCents !== cur.monthlyCents;
    Object.assign(cur, { tagline, monthlyCents, allowanceMinutes, updatedAt: new Date().toISOString() });
    if (cur.id !== "free") Object.assign(cur, { checkoutMonthlyUrl: httpsUrl(b.checkoutMonthlyUrl, "The monthly checkout link"), checkoutYearlyUrl: httpsUrl(b.checkoutYearlyUrl, "The yearly checkout link") });
    note(priceChanged ? "Changed a plan's price" : "Changed a plan", cur.name, null);
    return { ok: true };
  }
  if (method === "POST" && path === "plans/packs") {
    await wait(400);
    const label = String(b.label ?? "").trim(), minutes = whole(b.minutes, 1, 100_000);
    if (!label || label.length > 40) throw new ApiError(400, "Give the pack a name of up to 40 characters.", "invalid_label");
    if (minutes === null) throw new ApiError(400, "Enter how many minutes the pack gives.", "invalid_minutes");
    if (packs.some((k) => k.minutes === minutes)) throw new ApiError(409, "There is already a pack of that size.", "duplicate_pack");
    packs.push({ sku: `pack-${minutes}`, label, minutes, checkoutUrl: httpsUrl(b.checkoutUrl, "The checkout link") });
    packs.sort((x, y) => x.minutes - y.minutes);
    note("Added an extra-hours pack", label, null);
    return { ok: true };
  }
  if (method === "PATCH" && (m = path.match(/^plans\/packs\/([^/]+)$/))) {
    await wait(400);
    const cur = packs.find((k) => k.sku === m![1]);
    if (!cur) throw new ApiError(404, "That pack no longer exists.", "not_found");
    const label = String(b.label ?? "").trim(), minutes = whole(b.minutes, 1, 100_000);
    if (!label || label.length > 40) throw new ApiError(400, "Give the pack a name of up to 40 characters.", "invalid_label");
    if (minutes === null) throw new ApiError(400, "Enter how many minutes the pack gives.", "invalid_minutes");
    if (packs.some((k) => k !== cur && k.minutes === minutes)) throw new ApiError(409, "There is already a pack of that size.", "duplicate_pack");
    Object.assign(cur, { label, minutes, checkoutUrl: httpsUrl(b.checkoutUrl, "The checkout link") });
    packs.sort((x, y) => x.minutes - y.minutes);
    note("Changed an extra-hours pack", label, null);
    return { ok: true };
  }
  if (method === "POST" && (m = path.match(/^plans\/packs\/([^/]+)\/delete$/))) {
    await wait(400);
    const at = packs.findIndex((k) => k.sku === m![1]);
    if (at < 0) throw new ApiError(404, "That pack no longer exists.", "not_found");
    const [gone] = packs.splice(at, 1);
    note("Deleted an extra-hours pack", gone.label, null);
    return { ok: true };
  }
  if (method === "POST" && path === "staff/invites") {
    await wait(450);
    const email = String(b.email ?? "").trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) throw new ApiError(400, "Enter a full email address.", "invalid_email");
    if (admins.some((a) => a.email === email)) throw new ApiError(409, `${email} is already an admin.`, "already_admin");
    const open = invites.find((i) => i.email === email && new Date(i.expiresAt) > new Date());
    if (open) throw new ApiError(409, `${email} already has an invite waiting. You can resend it from the list below.`, "already_invited");
    for (const stale of invites.filter((i) => i.email === email)) invites.splice(invites.indexOf(stale), 1);
    invites.unshift({ id: `i-${Date.now()}`, email, invitedBy: PREVIEW_ACTOR, invitedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + INVITE_DAYS * 86_400_000).toISOString() });
    note("Invited an admin", email, typeof b.note === "string" && b.note ? `Note: ${b.note}` : null);
    return { ok: true };
  }
  if (method === "POST" && (m = path.match(/^staff\/invites\/([^/]+)\/(resend|cancel)$/))) {
    await wait(350);
    const at = invites.findIndex((i) => i.id === m![1]);
    if (at < 0) throw new ApiError(404, "That invite no longer exists.", "not_found");
    if (m[2] === "cancel") { const [gone] = invites.splice(at, 1); note("Cancelled an admin invite", gone.email, null); return { ok: true }; }
    if ((resentAt.get(m[1]) ?? 0) > Date.now()) throw new ApiError(429, "That invite was sent a moment ago. Please wait a minute before sending it again.", "too_many_requests");
    resentAt.set(m[1], Date.now() + 60_000);
    invites[at] = { ...invites[at], invitedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + INVITE_DAYS * 86_400_000).toISOString() };
    note("Resent an admin invite", invites[at].email, null);
    return { ok: true };
  }
  if (method === "POST" && (m = path.match(/^staff\/([^/]+)\/remove$/))) {
    await wait(450);
    const at = admins.findIndex((a) => a.id === m![1]);
    if (at < 0) throw new ApiError(404, "They are not an admin.", "not_found");
    if (admins[at].you) throw new ApiError(409, "You can't remove yourself. Ask another admin to do it.", "cannot_remove_self");
    if (admins.length <= 1) throw new ApiError(409, "There must always be at least one admin.", "last_admin");
    const [gone] = admins.splice(at, 1);
    note("Removed an admin", gone.email, null, gone.id.startsWith("p-") ? null : gone.id);
    return { ok: true };
  }
  if (method === "PATCH" && path === "settings") {
    await wait(420);
    if (b.version !== settingsVersion) throw new ApiError(409, "Someone else changed these settings first. Reload to see their changes, then try again.", "version_conflict");
    const changes = (b.changes ?? {}) as Record<string, unknown>;
    const summary: string[] = [];
    for (const [key, value] of Object.entries(changes)) {
      const s = settingsList.find((x) => x.key === key);
      if (!s) throw new ApiError(400, `Unknown setting ${key}.`, "unknown_setting");
      if (!s.editable) throw new ApiError(403, `${s.label} can't be changed here. ${s.reason ?? ""}`.trim(), "not_editable");
      if (typeof value === "number" && ((s.min !== undefined && value < s.min) || (s.max !== undefined && value > s.max))) throw new ApiError(400, `${s.label} must be between ${s.min} and ${s.max}.`, "out_of_range");
      summary.push(`${key} ${String(s.value)} → ${String(value)}`);
      s.value = value as never;
      s.source = "admin";
    }
    settingsVersion += 1;
    settingsMeta = { updatedAt: new Date().toISOString(), updatedBy: PREVIEW_ACTOR };
    note("Changed settings", summary.join("; "), b.reason);
    return { ok: true, version: settingsVersion };
  }
  if (method === "PATCH" && (m = path.match(/^integrations\/([^/]+)$/))) {
    await wait(420);
    const it = integrations.find((i) => i.id === m![1]);
    if (!it) throw new ApiError(404, "Unknown integration.", "not_found");
    const fields = (b.fields ?? {}) as Record<string, string>;
    const touched: string[] = [];
    for (const [key, value] of Object.entries(fields)) {
      const f = it.fields.find((x) => x.key === key);
      if (!f || !f.editable || value === "") continue;
      if (f.kind === "secret") f.configured = true; else f.value = value;
      touched.push(key);
    }
    if (touched.length) { it.status = "configured"; it.lastError = null; it.lastCheckedAt = null; }
    note("Changed keys", `${it.name} (${touched.join(", ") || "no change"})`, b.reason);
    return { ok: true };
  }
  if (method === "POST" && (m = path.match(/^integrations\/([^/]+)\/check$/))) {
    await wait(900);
    const it = integrations.find((i) => i.id === m![1]);
    if (!it) throw new ApiError(404, "Unknown integration.", "not_found");
    const failing = it.id === "r2";
    it.lastCheckedAt = new Date().toISOString();
    it.status = failing ? "failing" : "verified";
    it.lastError = failing ? "The bucket check timed out after 10 seconds." : null;
    note("Tested a connection", it.name, "Run from Integrations", null, failing ? "failed" : "success");
    return { ok: !failing, status: it.status, checkedAt: it.lastCheckedAt, message: failing ? it.lastError : "Connected. Nothing was sent and nothing was billed." };
  }
  return undefined;
}
