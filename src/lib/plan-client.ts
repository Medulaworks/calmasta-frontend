import type { PlanId } from "./plan-types";
import { formatMinutes } from "./status";
import { ApiError } from "./upload-client";

export type PlanStatus =
  | "none"
  | "pending_activation"
  | "active"
  | "grace"
  | "pending-cancel"
  | "cancelled"
  | "expired"
  | "refunded";

/** One purchased credit pack as projected by GET /plan (seconds, never minutes). */
export interface CreditPackView {
  grantId: string;
  sku: string;
  creditsSeconds: number;
  availableSeconds: number;
  reservedSeconds: number;
  consumedSeconds: number;
  refundedSeconds: number;
  expiresAt: string | null;
  state: "active" | "partially_refunded" | "refunded" | "consumed" | "expired" | string;
}

export interface PurchasedCreditsView {
  scopeAvailable?: boolean;
  availableSeconds: number;
  reservedSeconds: number;
  consumedSeconds: number;
  refundedSeconds: number;
  periodUsedSeconds: number;
  periodReservedSeconds?: number;
  nextExpiryAt?: string | null;
}

export interface SubscriptionPeriodView {
  startsAt: string | null;
  endsAt: string | null;
}

export interface PlanCapabilities {
  usage: boolean;
  commerce: boolean;
  checkout: boolean;
  paidEntitlements: boolean;
  purchasedCredits: boolean;
  subscriptions?: boolean;
  refunds?: boolean;
  portal?: boolean;
  usageBreakdown: boolean;
}

export interface PlanSummary {
  entitlementsVersion: string | null;
  plan: { plan: PlanId; status: PlanStatus | null; renewsAt: string | null; graceUntil: string | null };
  allowanceMinutes: number | null;
  usedMinutes: number;
  reservedMinutes: number | null;
  includedUsedMinutes: number | null;
  includedReservedMinutes: number | null;
  includedRemainingMinutes: number | null;
  purchasedMinutes: number | null;
  remainingMinutes: number | null;
  resetsAt: string;
  breakdown: Array<{ operation: string; label: string; minutes: number }>;
  inProgress: number;
  exhausted: boolean | null;
  paused: boolean;
  timezone: string;
  creditPacks: CreditPackView[];
  creditPacksTruncated: boolean;
  purchasedCredits: PurchasedCreditsView | null;
  subscriptionPeriod: SubscriptionPeriodView | null;
  period: { startsAt: string | null; endsAt: string | null; timezone: string; rollover: boolean } | null;
  packs: Array<{ sku: string; minutes: number; label: string }>;
  checkoutUrl: string | null;
  checkoutUrlAnnual: string | null;
  checkoutUrlBusiness: string | null;
  checkoutUrlBusinessAnnual: string | null;
  testCheckout: boolean;
  enterpriseUrl: string | null;
  freeAllowanceMinutes: number | null;
  proAllowanceMinutes: number | null;
  businessAllowanceMinutes: number | null;
  /** Null until an approved commercial policy exists; never invent prices. */
  pricing: { currency: string; proMonthly: number; businessMonthly: number; annualDiscountPct: number } | null;
  billingUrl: string | null;
  placeholder: boolean;
  capabilities: PlanCapabilities | null;
}

export interface DeletionView {
  status: "requested" | "in_progress" | "partial_failure" | "completed" | "cancelled";
  requestedAt: string;
  filesRemoved: number;
  filesFailed: number;
  canCancel: boolean;
  startsAt: string | null;
}

// FE-X07: deletion contracts are absent from the backend; never send speculative requests.
const unavailable = async <T>(message: string): Promise<T> => {
  throw new ApiError(503, message, "feature_unavailable");
};

// Dummy billing data until FE-X07 is implemented — keep in UI only.
export const DUMMY_PLAN: PlanSummary = {
  entitlementsVersion: null,
  plan: { plan: "free", status: "active", renewsAt: null, graceUntil: null },
  allowanceMinutes: 180,
  usedMinutes: 47,
  reservedMinutes: 0,
  includedUsedMinutes: 47,
  includedReservedMinutes: 0,
  includedRemainingMinutes: 133,
  purchasedMinutes: 30,
  remainingMinutes: 163,
  resetsAt: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString(),
  breakdown: [],
  inProgress: 1,
  exhausted: false,
  paused: false,
  timezone: "UTC",
  creditPacks: [],
  creditPacksTruncated: false,
  purchasedCredits: null,
  subscriptionPeriod: null,
  period: null,
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
  capabilities: null,
};

const numOrNull = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;
const strOrNull = (value: unknown): string | null =>
  typeof value === "string" ? value : null;
const bool = (value: unknown, fallback = false): boolean =>
  typeof value === "boolean" ? value : fallback;

function packOrNull(value: unknown): CreditPackView | null {
  if (!value || typeof value !== "object") return null;
  const pack = value as Record<string, unknown>;
  if (typeof pack.grantId !== "string" || typeof pack.sku !== "string") return null;
  const seconds = (key: string): number => {
    const n = pack[key];
    return typeof n === "number" && Number.isFinite(n) ? n : 0;
  };
  return {
    grantId: pack.grantId,
    sku: pack.sku,
    creditsSeconds: seconds("creditsSeconds"),
    availableSeconds: seconds("availableSeconds"),
    reservedSeconds: seconds("reservedSeconds"),
    consumedSeconds: seconds("consumedSeconds"),
    refundedSeconds: seconds("refundedSeconds"),
    expiresAt: strOrNull(pack.expiresAt),
    state: typeof pack.state === "string" ? pack.state : "active",
  };
}

/** Maps the GET /plan projection defensively: backend nulls stay null, units stay as sent. */
export function normalizePlan(body: unknown): PlanSummary {
  const raw = (body ?? {}) as Record<string, unknown>;
  const plan = (raw.plan ?? {}) as Record<string, unknown>;
  const pricing = (raw.pricing ?? null) as PlanSummary["pricing"];
  const subscriptionPeriod = (raw.subscriptionPeriod ?? null) as Record<string, unknown> | null;
  const period = (raw.period ?? null) as Record<string, unknown> | null;
  const packs = Array.isArray(raw.packs)
    ? raw.packs.flatMap((p) => {
        const row = p as Record<string, unknown>;
        return typeof row.sku === "string"
          ? [{ sku: row.sku, minutes: typeof row.minutes === "number" ? row.minutes : 0, label: typeof row.label === "string" ? row.label : row.sku }]
          : [];
      })
    : [];
  const creditPacks = Array.isArray(raw.creditPacks)
    ? raw.creditPacks.flatMap((p) => {
        const pack = packOrNull(p);
        return pack ? [pack] : [];
      })
    : [];
  const purchasedCredits = (raw.purchasedCredits ?? null) as Record<string, unknown> | null;
  const capabilities = (raw.capabilities ?? null) as PlanSummary["capabilities"];
  return {
    entitlementsVersion: strOrNull(raw.entitlementsVersion),
    plan: {
      plan: plan.plan === "pro" || plan.plan === "business" ? plan.plan : "free",
      status: typeof plan.status === "string" ? (plan.status as PlanSummary["plan"]["status"]) : null,
      renewsAt: strOrNull(plan.renewsAt),
      graceUntil: strOrNull(plan.graceUntil),
    },
    allowanceMinutes: numOrNull(raw.allowanceMinutes),
    usedMinutes: typeof raw.usedMinutes === "number" && Number.isFinite(raw.usedMinutes) ? raw.usedMinutes : 0,
    reservedMinutes: numOrNull(raw.reservedMinutes),
    includedUsedMinutes: numOrNull(raw.includedUsedMinutes),
    includedReservedMinutes: numOrNull(raw.includedReservedMinutes),
    includedRemainingMinutes: numOrNull(raw.includedRemainingMinutes),
    purchasedMinutes: numOrNull(raw.purchasedMinutes),
    remainingMinutes: numOrNull(raw.remainingMinutes),
    resetsAt: typeof raw.resetsAt === "string" ? raw.resetsAt : new Date().toISOString(),
    breakdown: Array.isArray(raw.breakdown) ? (raw.breakdown as PlanSummary["breakdown"]) : [],
    inProgress: typeof raw.inProgress === "number" ? raw.inProgress : 0,
    exhausted: typeof raw.exhausted === "boolean" ? raw.exhausted : null,
    paused: bool(raw.paused),
    timezone: typeof raw.timezone === "string" ? raw.timezone : "UTC",
    creditPacks,
    creditPacksTruncated: bool(raw.creditPacksTruncated),
    purchasedCredits: purchasedCredits
      ? {
          scopeAvailable: purchasedCredits.scopeAvailable === true,
          availableSeconds: typeof purchasedCredits.availableSeconds === "number" ? purchasedCredits.availableSeconds : 0,
          reservedSeconds: typeof purchasedCredits.reservedSeconds === "number" ? purchasedCredits.reservedSeconds : 0,
          consumedSeconds: typeof purchasedCredits.consumedSeconds === "number" ? purchasedCredits.consumedSeconds : 0,
          refundedSeconds: typeof purchasedCredits.refundedSeconds === "number" ? purchasedCredits.refundedSeconds : 0,
          periodUsedSeconds: typeof purchasedCredits.periodUsedSeconds === "number" ? purchasedCredits.periodUsedSeconds : 0,
          periodReservedSeconds: typeof purchasedCredits.periodReservedSeconds === "number" ? purchasedCredits.periodReservedSeconds : undefined,
          nextExpiryAt: strOrNull(purchasedCredits.nextExpiryAt),
        }
      : null,
    subscriptionPeriod: subscriptionPeriod
      ? { startsAt: strOrNull(subscriptionPeriod.startsAt), endsAt: strOrNull(subscriptionPeriod.endsAt) }
      : null,
    period: period
      ? {
          startsAt: strOrNull(period.startsAt),
          endsAt: strOrNull(period.endsAt),
          timezone: typeof period.timezone === "string" ? period.timezone : "UTC",
          rollover: period.rollover === true,
        }
      : null,
    packs,
    checkoutUrl: strOrNull(raw.checkoutUrl),
    checkoutUrlAnnual: strOrNull(raw.checkoutUrlAnnual),
    checkoutUrlBusiness: strOrNull(raw.checkoutUrlBusiness),
    checkoutUrlBusinessAnnual: strOrNull(raw.checkoutUrlBusinessAnnual),
    testCheckout: raw.testCheckout === true,
    enterpriseUrl: strOrNull(raw.enterpriseUrl),
    freeAllowanceMinutes: numOrNull(raw.freeAllowanceMinutes),
    proAllowanceMinutes: numOrNull(raw.proAllowanceMinutes),
    businessAllowanceMinutes: numOrNull(raw.businessAllowanceMinutes),
    pricing:
      pricing && typeof pricing.currency === "string" ? pricing : null,
    billingUrl: strOrNull(raw.billingUrl),
    placeholder: raw.placeholder === true,
    capabilities,
  };
}

/**
 * Total usable minutes: purchased packs stack on top of the included monthly
 * allowance. Nulls propagate — unknown stays unknown instead of reading zero.
 */
export function totalRemainingMinutes(plan: Pick<PlanSummary, "includedRemainingMinutes" | "purchasedMinutes" | "remainingMinutes">): number | null {
  if (plan.includedRemainingMinutes == null && plan.purchasedMinutes == null) return plan.remainingMinutes;
  return (plan.includedRemainingMinutes ?? 0) + (plan.purchasedMinutes ?? 0);
}

/** Minutes for display; unknown renders as an em dash, never as zero. */
export function formatNullableMinutes(minutes: number | null): string {
  return minutes == null ? "—" : formatMinutes(minutes);
}

/** Arithmetic over nullable backend minutes; unknown counts as zero in sums only. */
export function orZero(minutes: number | null): number {
  return minutes ?? 0;
}

export const fetchPlan = async (): Promise<PlanSummary> => {
  const res = await fetch("/api/plan");
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, body.error ?? "Could not load your plan.", body.code);
  return normalizePlan(body);
};

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
