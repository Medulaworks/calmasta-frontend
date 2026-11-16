import type { PlanId } from "./plan-types";
import { ApiError } from "./upload-client";

export type PlanStatus = "none" | "pending_activation" | "active" | "grace" | "expired";

export interface PlanSummary {
  plan: { plan: PlanId; status: PlanStatus; renewsAt: string | null; graceUntil: string | null };
  allowanceMinutes: number;
  usedMinutes: number;
  includedRemainingMinutes: number;
  purchasedMinutes: number;
  reservedMinutes?: number;
  remainingMinutes: number;
  resetsAt: string;
  breakdown: Array<{ operation: string; label: string; minutes: number }>;
  inProgress: number;
  exhausted: boolean;
  paused: boolean;
  timezone: string;
  packs: Array<{ sku: string; minutes: number; label: string }>;
  checkoutUrl: string | null;
  checkoutUrlAnnual: string | null;
  checkoutUrlBusiness: string | null;
  checkoutUrlBusinessAnnual: string | null;
  testCheckout: boolean;
  enterpriseUrl: string | null;
  freeAllowanceMinutes: number;
  proAllowanceMinutes: number;
  businessAllowanceMinutes: number;
  pricing: { currency: string; proMonthly: number; businessMonthly: number; annualDiscountPct: number };
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

// FE-X07: these contracts are absent from the backend; never send speculative requests.
const unavailable = async <T>(message: string): Promise<T> => {
  throw new ApiError(503, message, "feature_unavailable");
};

// Dummy billing data until FE-X07 is implemented — keep in UI only.
export const DUMMY_PLAN: PlanSummary = {
  plan: { plan: "free", status: "active", renewsAt: null, graceUntil: null },
  allowanceMinutes: 180,
  usedMinutes: 47,
  includedRemainingMinutes: 133,
  purchasedMinutes: 30,
  remainingMinutes: 163,
  resetsAt: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString(),
  breakdown: [],
  inProgress: 1,
  exhausted: false,
  paused: false,
  timezone: "UTC",
  packs: [{ sku: "pack-60", minutes: 60, label: "60 minutes" }],
  checkoutUrl: null,
  checkoutUrlAnnual: null,
  checkoutUrlBusiness: null,
  checkoutUrlBusinessAnnual: null,
  testCheckout: true,
  enterpriseUrl: null,
  freeAllowanceMinutes: 120,
  proAllowanceMinutes: 600,
  businessAllowanceMinutes: 3000,
  pricing: { currency: "USD", proMonthly: 19, businessMonthly: 49, annualDiscountPct: 20 },
  billingUrl: null,
  placeholder: true,
};

export const fetchPlan = () => unavailable<PlanSummary>("Plan and billing are not available yet.");
export const fetchDeletion = () => unavailable<DeletionView | null>("Account deletion is not available yet.");
/** Tells the app shell (banners, sidebar) to re-read the account status. */
export const ACCOUNT_CHANGED = "calmasta:account-changed";
export const requestDeletion = (confirmation: string) => {
  void confirmation;
  return unavailable<DeletionView>("Account deletion is not available yet.");
};
export const cancelDeletion = () => unavailable<void>("Account deletion is not available yet.");

/** A date in the customer's own time zone. */
export const formatDate = (iso: string, timeZone: string, withTime = false) =>
  new Intl.DateTimeFormat("en-GB", { timeZone, day: "numeric", month: "short", year: "numeric", ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}) }).format(new Date(iso));
