// What the staff area calls the work Joobah does in the background. The server says "video_ingest"; a person reads
// "Importing a video". One list, so every screen uses the same plain words.

const NAMES: Record<string, string> = {
  video_ingest: "Importing a video",
  transcription: "Making a transcript",
  meeting_capture: "Recording a meeting",
  document: "Writing a document",
  document_generation: "Writing a document",
  action_items: "Finding action items",
};

/** "video_ingest" or "Video ingest" -> "Importing a video". Anything unknown reads as a sentence, never as a code. */
export function taskName(kind: string): string {
  const key = kind.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (NAMES[key]) return NAMES[key];
  const text = key.replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const ACTIONS: Record<string, string> = {
  "staff.login": "Signed in to the admin area",
  "staff.logout": "Signed out of the admin area",
  "staff.invite": "Invited an admin",
  "staff.invite_accept": "Accepted an admin invite",
  "staff.invite_resend": "Resent an admin invite",
  "staff.invite_cancel": "Cancelled an admin invite",
  "staff.remove": "Removed an admin",
  "staff.role_change": "Changed an admin’s role",
  "staff.password_change": "Changed their admin password",
  "customer.suspend": "Suspended an account",
  "customer.reactivate": "Turned an account back on",
  "customer.update": "Edited a user’s details",
  "customer.sessions_revoke": "Signed a user out everywhere",
  "customer.password_reset": "Sent a password reset email",
  "customer.verify_resend": "Sent a confirmation email",
  "customer.grant_minutes": "Added minutes",
  "customer.revoke_minutes": "Removed minutes",
  "plan.update": "Changed a plan",
  "plan.pricing": "Changed the yearly discount",
  "pack.create": "Added an extra-hours pack",
  "pack.update": "Changed an extra-hours pack",
  "pack.delete": "Deleted an extra-hours pack",
  "settings.update": "Changed settings",
  "policy.update": "Changed settings",
};

/** "staff.login" -> "Signed in to the admin area". An action we don't know reads as a sentence, never as a code. */
export function actionLabel(action: string | null | undefined): string {
  if (!action) return "Something was done";
  const key = action.trim().toLowerCase();
  if (ACTIONS[key]) return ACTIONS[key];
  if (/\s/.test(action.trim()) || /^[A-Z]/.test(action.trim())) return action; // already a sentence
  const text = key.replace(/[._-]+/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}
