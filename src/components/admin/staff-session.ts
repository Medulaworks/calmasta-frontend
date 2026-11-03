import { ADMIN_PREVIEW } from "@/lib/admin-preview";
import type { ProfileView } from "@/lib/profile-client";

/** Who the preview pretends to be. Development only; see admin-preview.ts. */
export const previewProfile = (): ProfileView =>
  ({ email: "preview@jooba.test", name: "Preview Admin", timezone: "Europe/London", isStaff: true, staffSession: true, staffSessionUntil: new Date(Date.now() + 8 * 3_600_000).toISOString() }) as ProfileView;

/** Ends the staff sign-in only. The person stays signed in to Jooba itself. */
export async function leaveStaffArea() {
  if (ADMIN_PREVIEW) return;
  await fetch("/api/auth/staff", { method: "DELETE" }).catch(() => undefined);
}
