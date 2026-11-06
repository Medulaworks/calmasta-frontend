export type AdminCapability = "user_edit_profile" | "user_suspend" | "user_revoke_sessions" | "user_send_mail" | "user_staff_role" | "staff_manage" | "settings_edit" | "integration_replace" | "integration_check" | "export_audit" | "job_retry" | "webhook_replay" | "commerce_edit" | "deletion_execute";
export interface CapabilityState { allowed: boolean; reason: string | null }
export interface CapabilitiesResponse { capabilities: Record<AdminCapability, CapabilityState>; permissionVersion: string; scope: string }

let cache: CapabilitiesResponse | null = null;
export function setCapabilities(data: CapabilitiesResponse) { cache = data; }
export function getCapabilities(): CapabilitiesResponse | null { return cache; }
export function capability(action: AdminCapability): CapabilityState {
  if (!cache) return { allowed: false, reason: "capabilities_not_loaded" };
  return cache.capabilities[action] ?? { allowed: false, reason: "unknown_capability" };
}
export async function loadCapabilities(): Promise<CapabilitiesResponse> {
  const res = await fetch("/api/admin/capabilities", { cache: "no-store" });
  if (!res.ok) throw new Error("capabilities_unavailable");
  const data = (await res.json()) as CapabilitiesResponse;
  cache = data;
  return data;
}
