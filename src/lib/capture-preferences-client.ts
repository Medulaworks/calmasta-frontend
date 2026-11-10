import { ApiError } from "./upload-client";

export type PromptState = "unset" | "saved" | "skipped";

export interface CapturePreferences {
  version: number;
  botName: string | null;
  promptState: PromptState;
  effectiveBotName: string;
  adminDefaultBotName: string;
  policyVersion: number;
}

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const corr = res.headers.get("x-correlation-id") ?? body.correlationId;
    throw new ApiError(res.status, body.error ?? body.message ?? "Something went wrong.", body.code ?? (corr ? `correlation:${corr}` : undefined));
  }
  return body as T;
}

export const getCapturePreferences = (signal?: AbortSignal) =>
  req<CapturePreferences>("/api/account/capture-preferences", { signal });

export const patchCapturePreferences = (body: { expectedVersion: number; botName: string | null; promptState: "saved" | "skipped" }) =>
  req<CapturePreferences>("/api/account/capture-preferences", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

export function displayBotName(prefs: CapturePreferences | null | undefined, fallback?: string | null): string | null {
  if (!prefs) return fallback ?? null;
  return prefs.effectiveBotName ?? fallback ?? prefs.adminDefaultBotName ?? null;
}
