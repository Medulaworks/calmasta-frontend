/**
 * Typed DTOs for product policy — exact mirror of backend ProductPolicyValues
 * per MEETING_ADMIN_BACKEND_IMPLEMENTATION_PLAN section 3 and OpenAPI
 * EffectiveProductPolicy. No secret values are exposed; display helpers
 * never log raw values. Fixture data is safe for offline UI and tests.
 */

export interface ProductPolicyValues {
  capture: {
    defaultMeetingDurationSeconds: number;
    maxMeetingDurationSeconds: number;
    maxUploadDurationSeconds: number;
    maxUploadBytes: number;
    maxVideoBytes: number;
    videoEnabled: boolean;
  };
  bot: {
    defaultName: string;
  };
  quota: {
    freeMonthlySeconds: number;
  };
  spend: {
    recallCeilingMicrosPerHour: string | null;
    assemblyCeilingMicrosPerHour: string | null;
  };
  ai: {
    insightsEnabled: boolean;
    templatesEnabled: boolean;
    titleEnabled: boolean;
    insightModel: "google/gemini-2.5-flash-lite";
    titleModel: "google/gemini-2.5-flash-lite";
    maxInsightCostMicros: string | null;
    maxTitleCostMicros: string | null;
    inputRateMicrosPerMillionTokens: string | null;
    outputRateMicrosPerMillionTokens: string | null;
  };
  sharing: {
    publicLinksEnabled: boolean;
    recipientGrantsEnabled: boolean;
    invitationsEnabled: boolean;
    maxExpiryDays: number | null;
  };
  operations: {
    processingEnabled: boolean;
    environmentPaused: boolean;
    telemetryEnabled: boolean;
    traceSampleRatio: number;
    heartbeatEnabled: boolean;
  };
}

export type PolicyChange = Partial<{
  [K in keyof ProductPolicyValues]: Partial<ProductPolicyValues[K]>;
}>;

export interface EffectiveProductPolicy {
  environment: string;
  version: number;
  values: ProductPolicyValues;
  updatedAt: string | null;
  adoption: {
    healthy: boolean;
    apiVersion: string | null;
    workerVersion: string | null;
    asOf: string;
    scope?: string;
    receipts?: unknown[];
    reason?: string;
  };
}

export interface PolicyPreviewResult {
  environment: string;
  expectedVersion: number;
  values: ProductPolicyValues;
  affectedPendingOperations: number;
  effect: "new_work";
  activeDeadlinesExtended: boolean;
}

export interface PolicyHistoryItem {
  version: number;
  values: ProductPolicyValues;
  actorId: string | null;
  reason: string | null;
  createdAt: string;
}

export interface PolicyHistoryResponse {
  items: PolicyHistoryItem[];
  nextCursor: number | null;
}

export interface BudgetPreviewResult {
  version: number;
  limitMicros: string;
  proposedLimitMicros: string;
  scope: "shared_database";
  committedMicros: string;
  newWorkBlocked: boolean;
}

export interface BudgetUpdateResult {
  version: number;
  limitMicros: string;
  scope: "shared_database";
}

export interface PolicyCatalogEntry {
  key: string;
  group: string;
  valueType: "integer" | "decimal_string" | "string" | "boolean" | "nullable_integer" | "number";
  unit?: string | null;
  min?: string | number | null;
  max?: string | number | null;
  enum?: string[] | null;
  sensitive: boolean;
  editableBy: string[];
  effect: string;
  currentValue: unknown;
  source: string;
  version: number;
}

export interface PolicyCatalog {
  scope: string;
  environment: string;
  version: number;
  groups: Array<{ group: string; fields: PolicyCatalogEntry[] }>;
  sharedBudget: PolicyCatalogEntry & { endpoint: string };
  bootstrapSettingsEditable: boolean;
}

// Fixture for offline UI and Vitest — safe values only, no secrets.
export const fixtureEffectivePolicy: EffectiveProductPolicy = {
  environment: "production",
  version: 7,
  values: {
    capture: {
      defaultMeetingDurationSeconds: 600,
      maxMeetingDurationSeconds: 1200,
      maxUploadDurationSeconds: 3600,
      maxUploadBytes: 25000000,
      maxVideoBytes: 250000000,
      videoEnabled: true,
    },
    bot: { defaultName: "MyJooba Notetaker" },
    quota: { freeMonthlySeconds: 3600 },
    spend: {
      recallCeilingMicrosPerHour: "10000000",
      assemblyCeilingMicrosPerHour: "370000",
    },
    ai: {
      insightsEnabled: true,
      templatesEnabled: false,
      titleEnabled: false,
      insightModel: "google/gemini-2.5-flash-lite",
      titleModel: "google/gemini-2.5-flash-lite",
      maxInsightCostMicros: "100000",
      maxTitleCostMicros: "1000",
      inputRateMicrosPerMillionTokens: "200000",
      outputRateMicrosPerMillionTokens: "800000",
    },
    sharing: {
      publicLinksEnabled: false,
      recipientGrantsEnabled: false,
      invitationsEnabled: false,
      maxExpiryDays: null,
    },
    operations: {
      processingEnabled: false,
      environmentPaused: false,
      telemetryEnabled: false,
      traceSampleRatio: 0.1,
      heartbeatEnabled: false,
    },
  },
  updatedAt: "2026-11-10T12:00:00.000Z",
  adoption: {
    healthy: false,
    apiVersion: null,
    workerVersion: null,
    asOf: "2026-11-10T12:00:00.000Z",
    scope: "transactional_product_policy_reads",
  },
};

export const fixtureCatalog: PolicyCatalog = {
  scope: "environment",
  environment: "production",
  version: 7,
  groups: [
    {
      group: "capture",
      fields: [
        {
          key: "capture.defaultMeetingDurationSeconds",
          group: "capture",
          valueType: "integer",
          unit: "seconds",
          min: 30,
          max: 7200,
          enum: null,
          sensitive: false,
          editableBy: ["owner"],
          effect: "new_work",
          currentValue: 600,
          source: "database",
          version: 7,
        },
      ],
    },
  ],
  sharedBudget: {
    key: "globalDailyLimitMicros",
    group: "spend",
    valueType: "decimal_string",
    unit: "USD_micros_per_day",
    min: "0",
    max: "200000000",
    enum: null,
    sensitive: false,
    editableBy: ["owner"],
    effect: "new_work",
    currentValue: "200000000",
    source: "database",
    version: 1,
    endpoint: "/admin/controls/global-budget",
  },
  bootstrapSettingsEditable: false,
};

// Helpers — client-side validation mirrors backend bounds without exposing secrets.
export function validateDurationChange(
  defaultSeconds: number,
  maxSeconds: number,
): string | null {
  if (!Number.isInteger(defaultSeconds) || !Number.isInteger(maxSeconds))
    return "Durations must be whole seconds.";
  if (defaultSeconds < 30) return "Default must be at least 30 seconds.";
  if (maxSeconds > 7200) return "Maximum cannot exceed 7200 seconds (120 minutes).";
  if (defaultSeconds > maxSeconds) return "Default cannot exceed maximum.";
  return null;
}

export function isPolicyUnavailableError(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "status" in e &&
    (e as { status: number }).status === 503 &&
    "code" in e &&
    ((e as { code: string }).code === "policy_unavailable" ||
      (e as unknown as { message: string }).message?.includes("policy_unavailable"))
  );
}
