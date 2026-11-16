import { ApiError } from "./upload-client";

export type AdminCapability = "user_edit_profile" | "user_suspend" | "user_revoke_sessions" | "user_send_mail" | "user_staff_role" | "staff_manage" | "settings_edit" | "integration_replace" | "integration_check" | "export_audit" | "job_retry" | "webhook_replay" | "commerce_edit" | "deletion_execute" | "cost_read" | "capture_read" | "capture_stop" | "global_budget_edit";
export interface CapabilityState { allowed: boolean; reason: string | null }
export interface CapabilitiesResponse { capabilities: Record<AdminCapability, CapabilityState>; permissionVersion: string; scope: string }

let cache: CapabilitiesResponse | null = null;
export function setCapabilities(data: CapabilitiesResponse) { cache = data; }
export function getCapabilities(): CapabilitiesResponse | null { return cache; }
export function clearCapabilities(): void { cache = null; }
export function capability(action: AdminCapability): CapabilityState {
  if (!cache) return { allowed: false, reason: "capabilities_not_loaded" };
  return cache.capabilities[action] ?? { allowed: false, reason: "unknown_capability" };
}
export function hasCapability(action: AdminCapability): boolean { return capability(action).allowed; }
export function requireCapability(action: AdminCapability): CapabilityState {
  const state = capability(action);
  if (!state.allowed) throw Object.assign(new Error(state.reason ?? "forbidden"), { code: state.reason ?? "forbidden", status: 403 });
  return state;
}
export async function loadCapabilities(signal?: AbortSignal): Promise<CapabilitiesResponse> {
  const res = await fetch("/api/admin/capabilities", { cache: "no-store", credentials: "same-origin", signal });
  if (!res.ok) throw new ApiError(res.status, "Could not check admin permissions.", "capabilities_unavailable");
  const data = (await res.json()) as CapabilitiesResponse;
  // Validate no secret leakage — capabilities must not carry provider keys.
  if (typeof data !== "object" || data === null || !("capabilities" in data)) throw new Error("malformed_capabilities");
  signal?.throwIfAborted();
  cache = data;
  return data;
}
// Call on logout to prevent stale capabilities from authorizing a new session.
export function clearOnLogout(): void { cache = null; }
