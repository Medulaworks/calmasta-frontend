export interface UsageSummaryView {
  plan: string;
  processingPaused: boolean;
  limitSeconds: number|null;
  usedSeconds: number;
  reservedSeconds: number;
  remainingSeconds: number|null;
}

export class UsageError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function fetchUsageSummary(): Promise<UsageSummaryView> {
  const res = await fetch("/api/usage/summary");
  const body = (await res.json().catch(() => ({}))) as Partial<UsageSummaryView> & { error?: string; message?: string };
  if (!res.ok) {
    throw new UsageError(
      res.status,
      res.status === 401
        ? "Your session ended. Please sign in again."
        : (body.error ?? body.message ?? "Could not load usage summary."),
    );
  }
  return {
    plan: String(body.plan ?? "plan_free"),
    processingPaused: Boolean(body.processingPaused),
    limitSeconds: body.limitSeconds===null?null:Number(body.limitSeconds ?? 0),
    usedSeconds: Number(body.usedSeconds ?? 0),
    reservedSeconds: Number(body.reservedSeconds ?? 0),
    remainingSeconds: body.remainingSeconds===null?null:Number(body.remainingSeconds ?? 0),
  };
}
