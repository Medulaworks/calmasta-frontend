/** UI availability only. Server-owned staff authorization remains in the existing session/BFF. */
export type AdminCapability = "user_edit_profile" | "user_suspend" | "user_revoke_sessions" | "user_send_mail" | "user_staff_role" | "staff_manage" | "settings_edit" | "integration_replace" | "integration_check" | "export_audit";
export interface CapabilityState { allowed: boolean; reason: string | null }
/** Enable individual actions only after their exact backend contracts are implemented and verified. */
export function capability(action: AdminCapability): CapabilityState {
  void action;
  return { allowed: false, reason: "Not available yet. The staff API is not connected." };
}
