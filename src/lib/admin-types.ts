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

export interface Overview {
  generatedAt: Date;
  paused: boolean;
  /** An outage banner is shown when work is stuck or intake is paused. */
  banner: { level: "warning" | "danger"; text: string } | null;
  queue: { queued: number; running: number; retrying: number; oldestDueSeconds: number | null; stuckRunning: number };
  last24h: Array<{ kind: string; succeeded: number; failed: number; successRate: number | null }>;
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
