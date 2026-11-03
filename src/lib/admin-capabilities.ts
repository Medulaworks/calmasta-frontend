// What the staff area is allowed to do right now, and why not. The backend team's context says the admin API is not built
// yet, so by default every staff request is blocked here, on the client, with an honest "not available" state: no
// requests that would only 404, no fake success. Two things switch it on:
//   - NEXT_PUBLIC_ADMIN_PREVIEW=1  (development only): sample data, see admin-preview.ts
//   - NEXT_PUBLIC_ADMIN_API=1      : the real admin API exists and should be called
// Hiding or enabling a button here is never authorization. The server checks staff status on every request.

import { ADMIN_PREVIEW } from "./admin-preview";

export const ADMIN_API_ENABLED = process.env.NEXT_PUBLIC_ADMIN_API === "1";
/** True when staff screens can load anything at all (sample data, or the real API). */
export const ADMIN_AVAILABLE = ADMIN_PREVIEW || ADMIN_API_ENABLED;

export type AdminCapability =
  | "user_edit_profile"
  | "user_suspend"
  | "user_revoke_sessions"
  | "user_send_mail"
  | "user_staff_role"
  | "staff_manage"
  | "settings_edit"
  | "integration_replace"
  | "integration_check"
  | "export_audit";

export interface CapabilityState {
  allowed: boolean;
  /** Shown beside a disabled control, so a missing button is never a mystery. */
  reason: string | null;
}

const NEVER: Partial<Record<AdminCapability, string>> = {
  user_staff_role: "Admins are added and removed under Settings, then Admins.",
  export_audit: "Not available yet.",
};

/** Whether a staff action can be offered, with the reason when it can't. */
export function capability(c: AdminCapability): CapabilityState {
  if (NEVER[c]) return { allowed: false, reason: NEVER[c]! };
  if (ADMIN_PREVIEW) return { allowed: true, reason: null };
  if (ADMIN_API_ENABLED) return { allowed: true, reason: null };
  return { allowed: false, reason: "Not available yet." };
}
