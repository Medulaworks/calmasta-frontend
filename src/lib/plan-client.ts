import { api } from "./upload-client";

export type PlanStatus = "none" | "pending_activation" | "active" | "grace" | "expired";

export interface PlanSummary {
  plan: { plan: "free" | "pro"; status: PlanStatus; renewsAt: string | null; graceUntil: string | null };
  allowanceMinutes: number;
  usedMinutes: number;
  includedRemainingMinutes: number;
  purchasedMinutes: number;
  remainingMinutes: number;
  resetsAt: string;
  breakdown: Array<{ operation: string; label: string; minutes: number }>;
  inProgress: number;
  exhausted: boolean;
  paused: boolean;
  timezone: string;
  packs: Array<{ sku: string; minutes: number; label: string }>;
  checkoutUrl: string | null;
  billingUrl: string | null;
  placeholder: boolean;
}

export interface DeletionView {
  status: "requested" | "in_progress" | "partial_failure" | "completed" | "cancelled";
  requestedAt: string;
  filesRemoved: number;
  filesFailed: number;
  canCancel: boolean;
  startsAt: string | null;
}

const call = <T>(url: string, init?: RequestInit) => api<T>(url, { ...init, cache: "no-store" });

export const fetchPlan = () => call<PlanSummary>("/api/plan");
export const fetchDeletion = async () => (await call<{ deletion: DeletionView | null }>("/api/account/deletion")).deletion;
/** Tells the app shell (banners, sidebar) to re-read the account status. */
export const ACCOUNT_CHANGED = "calmasta:account-changed";
const changed = () => window.dispatchEvent(new Event(ACCOUNT_CHANGED));

export const requestDeletion = async (confirmation: string) => {
  const d = (await call<{ deletion: DeletionView }>("/api/account/deletion", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmation }) })).deletion;
  changed();
  return d;
};
export const cancelDeletion = async () => {
  await call<{ deletion: null }>("/api/account/deletion", { method: "DELETE" });
  changed();
};

/** A date in the customer's own time zone. */
export const formatDate = (iso: string, timeZone: string, withTime = false) =>
  new Intl.DateTimeFormat("en-GB", { timeZone, day: "numeric", month: "short", year: "numeric", ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}) }).format(new Date(iso));
