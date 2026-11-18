import type { PlanId } from "./plan-types";
// The shapes the staff API returns. Kept here (not in the server modules) so the staff UI never imports server code.

export interface OverviewJob {
  id: string;
  kind: string;
  status: string;
  captureId: string;
  attempts: number;
  maxAttempts: number;
  lastError: string | null;
  updatedAt: Date;
  /** Whether a person may retry it, and if not, why. */
  retry: { allowed: boolean; reason: string | null };
}

/**
 * The numbers the business watches, for one window of time (whole UTC days). Every part can be null, and null means "the
 * server hasn't told us", which is not the same as zero: the screen shows a dash and says so. Money is whole cents and
 * comes from the store, never guessed here.
 */
export interface BusinessNumbers {
  period: { key: "day" | "week" | "month" | "all" | "range"; from: string | null; to: string };
  /** People who joined in the window. */
  newUsers: number | null;
  /** Everyone with an account right now, whatever the window. */
  totalUsers: number | null;
  /** People who used Joobah in the window. */
  activeUsers: number | null;
  /** `total` is as of now; `newInPeriod` is how many started paying in the window. */
  paidSubscribers: { total: number; pro: number; business: number; newInPeriod: number | null } | null;
  /** Money received in the window. `previousCents` is the window of the same length just before it (null for all time). */
  revenue: { cents: number; previousCents: number | null } | null;
  meetings: { total: number; failed: number } | null;
  recordings: number | null;
  minutes: number | null;
  costCents: number | null;
  /** The monthly cost target, only offered when the window is a month. */
  costTargetCents: number | null;
}

export interface Overview {
  business?: BusinessNumbers;
  generatedAt: Date;
  paused: boolean;
  /** An outage banner is shown when work is stuck or intake is paused. */
  banner: { level: "warning" | "danger"; text: string } | null;
  queue: { queued: number; running: number; retrying: number; oldestDueSeconds: number | null; stuckRunning: number };
  last24h: Array<{ kind: string; succeeded: number; failed: number; successRate: number | null }>;
  /** Meetings the assistant handled in the last 7 days. `finished` counts finished and failed together. */
  meetings7d: { finished: number; denied: number; timedOut: number; failed: number; deniedRate: number | null; timedOutRate: number | null };
  problems: OverviewJob[];
}

export interface CustomerRow {
  id: string;
  email: string;
  name: string | null;
  createdAt: Date;
  plan: string;
  planStatus: string;
}

export interface RegistryRow {
  id: string;
  email: string;
  plan: PlanId;
  status: string;
  source: string | null;
  endsAt: Date | null;
  purchasedMinutes: number;
  storeReference: string | null;
}

export interface UsageReport {
  days: Array<{ day: string; operation: string; minutes: number; costUsd: number | null }>;
  month: { minutes: number; costUsd: number | null; targetUsd: number | null; guardUsd: number | null; overTarget: boolean; overGuard: boolean; costKnown: boolean };
  topCustomers: Array<{ userId: string; email: string; minutes: number }>;
  paused: { paused: boolean; reason: string | null; by: string | null; at: Date | null };
}

export interface WebhookRow {
  id: string;
  provider: string;
  reference: string;
  receivedAt: Date;
  processedAt: Date | null;
  verified: boolean;
  duplicates: number;
  replays: number;
  note: string | null;
  error: string | null;
  customerId: string | null;
  /** "ok" processed; "attention" needs a person (unmatched, refund, never finished); "rejected" failed verification. */
  health: "ok" | "attention" | "rejected";
  replay: { allowed: boolean; reason: string | null };
}

export type FindingKind = "grace_overdue" | "pending_stale" | "renewal_overdue" | "unmatched_event" | "refund_review" | "usage_missing" | "usage_mismatch";

export interface Finding {
  key: string;
  kind: FindingKind;
  severity: "safe_to_fix" | "needs_review";
  userId: string | null;
  email: string | null;
  summary: string;
  detail: string;
  /** For events: the webhook delivery to look at. */
  webhookId?: string;
}

export interface DunningRow {
  userId: string;
  email: string;
  status: "grace" | "pending_activation" | "expired";
  since: Date;
  /** For grace: when access ends. For pending: when it started waiting. */
  endsAt: Date | null;
  storeReference: string | null;
  storeUrl: string | null;
  lastStoreEvent: { receivedAt: Date; note: string | null } | null;
  /** Plain words for what is happening and what, if anything, is needed. */
  recovery: string;
}

export interface DeletionRow {
  id: string;
  status: string;
  requestedAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  attempts: number;
  filesRemoved: number;
  filesFailed: number;
  lastError: string | null;
  nextAttemptAt: Date | null;
  /** The account, while it still exists. After completion only the short email fingerprint remains. */
  customerId: string | null;
  email: string | null;
  fingerprint: string;
  retry: { allowed: boolean; reason: string | null };
}

export interface AuditRow {
  id: string;
  at: Date;
  actor: string | null;
  action: string;
  target: string | null;
  customerId: string | null;
  reason: string | null;
}


export type WebhookFilter = "all" | "attention" | "rejected" | "duplicates";

export interface WebhookList {
  rows: WebhookRow[];
  counts: { total24h: number; attention: number; rejected24h: number; duplicates24h: number };
}

export interface Reconciliation {
  findings: Finding[];
  unreconciledUsage: number;
  checkedAt: Date;
}

export interface DunningReport {
  rows: DunningRow[];
  counts: { grace: number; pending: number; expired30d: number };
}

export interface PrivacyReport {
  deletions: DeletionRow[];
  audit: AuditRow[];
}

export interface CustomerDetail {
  id: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
  timezone: string;
  role: string | null;
  onboarded: boolean;
  outputsOnly: boolean;
  createdAt: Date;
  deletion: { status: string; requestedAt: Date; filesRemoved: number; filesFailed: number; canCancel: boolean; startsAt: Date | null } | null;
  plan: { plan: PlanId; status: string; renewsAt: Date | null; graceUntil: Date | null; source: string | null; storeReference: string | null };
  allowance: { allowanceMinutes: number; usedMinutes: number; purchasedMinutes: number; remainingMinutes: number; resetsAt: string };
  grants: Array<{ id: string; minutes: number; kind: string; expiresAt: Date | null; reason: string | null; createdAt: Date; reference: string | null }>;
  connections: Array<{ id: string; provider: string; status: string; connectedAt: Date; calendars: number }>;
  counts: { captures: number; documents: number; bookings: number; pages: number };
  recentJobs: Array<{ id: string; kind: string; status: string; captureId: string; updatedAt: Date }>;
  recentStoreEvents: Array<{ id: string; provider: string; reference: string; receivedAt: Date; note: string | null }>;
}

// ---- Monitoring ------------------------------------------------------------------------------------------------
// Unknown is its own state: a service that can't be checked is "unknown", never "operational" and never zero.
export type ServiceStatus = "operational" | "degraded" | "down" | "unknown";

export interface ServiceHealth {
  id: string;
  name: string;
  group: "Core" | "Providers" | "Integrations";
  status: ServiceStatus;
  detail: string | null;
  lastCheckedAt: Date | null;
  latencyMs: number | null;
  /** Share of checks that passed over the last 30 days (0 to 100), or null when there is no history. */
  uptime30d: number | null;
  /** One status per day, oldest first. */
  days: ServiceStatus[];
}

export interface WorkerHealth {
  name: string;
  status: ServiceStatus;
  lastHeartbeatAt: Date | null;
  jobsInFlight: number | null;
}

export interface Incident {
  id: string;
  title: string;
  service: string;
  severity: "minor" | "major";
  startedAt: Date;
  resolvedAt: Date | null;
  note: string;
}

export interface SystemHealth {
  environment: string;
  generatedAt: Date;
  overall: ServiceStatus;
  services: ServiceHealth[];
  workers: WorkerHealth[];
  incidents: Incident[];
  /** Jobs waiting, one point every 15 minutes for the last six hours. */
  queueDepth: number[];
}

// ---- Users -----------------------------------------------------------------------------------------------------
export interface UserRow {
  id: string;
  email: string;
  name: string | null;
  createdAt: Date;
  lastActiveAt: Date | null;
  plan: string;
  planStatus: string;
  emailVerified: boolean;
  providers: string[];
  status: "active" | "suspended";
  staff: boolean;
}

export interface UserList {
  users: UserRow[];
  nextCursor: string | null;
  /** Null when the server can't say, never a guess. */
  total: number | null;
}

export interface UserSession {
  id: string;
  device: string;
  /** Masked: the last part of the address is hidden. */
  ip: string;
  lastSeenAt: Date;
  current: boolean;
}

/** What the staff user page shows on top of the customer detail: identity, status, sessions and workspaces. */
export interface UserExtras {
  status: "active" | "suspended";
  suspendedReason: string | null;
  staff: boolean;
  providers: string[];
  lastActiveAt: Date | null;
  sessions: UserSession[];
  workspaces: Array<{ id: string; name: string; role: "owner" | "member"; usedSeconds: number; allowanceSeconds: number; processingPaused: boolean }>;
}

// ---- Settings --------------------------------------------------------------------------------------------------
export type SettingUnit = "seconds" | "bytes" | "micros_per_hour" | "usd_per_day" | "days";

export interface AdminSetting {
  key: string;
  label: string;
  group: string;
  help: string | null;
  kind: "boolean" | "integer" | "decimal" | "string" | "enum";
  /** The stored value in its canonical unit (seconds, bytes, micro-dollars per hour, dollars per day). */
  value: string | number | boolean;
  source: "default" | "environment" | "admin";
  editable: boolean;
  /** Why it can't be edited, or a warning about the value. */
  reason: string | null;
  min?: number;
  max?: number;
  unit?: SettingUnit;
  options?: string[];
  /** How a change takes effect: right away, once workers pick it up, after a restart, or only an operator can change it. */
  applyMode: "live" | "pending" | "restart_required" | "operator_only";
}

export interface AdminSettings {
  version: number;
  environment: string;
  generatedAt: Date;
  updatedAt: Date | null;
  updatedBy: string | null;
  settings: AdminSetting[];
}

// ---- Integrations ----------------------------------------------------------------------------------------------
export interface IntegrationField {
  key: string;
  label: string;
  kind: "text" | "secret" | "url" | "select";
  configured: boolean;
  /** Present for non-secret fields. Secrets are never sent back; only that they are set. */
  value?: string;
  options?: string[];
  editable: boolean;
  reason?: string;
}

export interface Integration {
  id: string;
  name: string;
  category: "Sign-in" | "Calendar" | "Meetings" | "Transcription" | "Storage" | "Email" | "AI";
  usedFor: string;
  status: "verified" | "configured" | "not_configured" | "failing";
  region: string | null;
  lastCheckedAt: Date | null;
  /** Sanitised: never contains a credential, a token or a signed URL. */
  lastError: string | null;
  fields: IntegrationField[];
  /** What changing it affects, in plain words. */
  impact: string;
}

// ---- Audit -----------------------------------------------------------------------------------------------------
export interface AuditEntry {
  id: string;
  at: Date;
  actor: string | null;
  action: string;
  target: string | null;
  customerId: string | null;
  reason: string | null;
  outcome: "success" | "denied" | "failed";
  correlationId: string;
}

export interface AuditPage {
  entries: AuditEntry[];
  nextCursor: string | null;
}

/** A person with access to the staff area. `id` is their account id, so it opens their account page. */
export interface AdminMember {
  id: string;
  email: string;
  name: string | null;
  addedAt: Date | null;
  addedBy: string | null;
  lastSignInAt: Date | null;
  /** This is the signed-in admin. */
  you: boolean;
}
/** An invitation to become an admin. It is only a request until the person accepts it from the email link. */
export interface AdminInvite {
  id: string;
  email: string;
  invitedBy: string;
  invitedAt: Date;
  expiresAt: Date;
}
export interface AdminList { admins: AdminMember[]; invites: AdminInvite[] }

/** What the invite page shows someone who opened the email link. */
export interface InviteDetails {
  email: string;
  invitedBy: string;
  expiresAt: Date;
  status: "pending" | "expired" | "accepted" | "cancelled";
}

/**
 * One of the three plans the app sells: Free, Pro and Business. The app fixes the list, so staff edit these, they don't add
 * or delete them. The yearly price is not stored: it comes from one yearly discount that applies to every paid plan.
 */
export interface AdminPlan {
  id: "free" | "pro" | "business";
  name: string;
  /** The one line under the name on the plan card. */
  tagline: string;
  monthlyCents: number;
  allowanceMinutes: number;
  /** Where "Choose plan" sends people. null means checkout isn't connected, and the app says so. */
  checkoutMonthlyUrl: string | null;
  checkoutYearlyUrl: string | null;
  subscribers: number;
  updatedAt: Date;
}
/** An extra-hours pack: minutes that don't reset each month. */
export interface AdminPack { sku: string; label: string; minutes: number; checkoutUrl: string | null }
export interface PlanList {
  plans: AdminPlan[];
  packs: AdminPack[];
  annualDiscountPct: number;
  /** The "Need custom terms?" link. null hides it. */
  enterpriseUrl: string | null;
}
