import { ADMIN_API_ENABLED } from "./admin-capabilities";
import { ADMIN_PREVIEW } from "./admin-preview";
import { inviteDetails } from "./admin-preview-extra";
import type { InviteDetails } from "./admin-types";
import { ApiError, api } from "./upload-client";

/** Same shape as a server reply: dates arrive as strings. */
export type InviteView = Omit<InviteDetails, "expiresAt"> & { expiresAt: string };

const unavailable = () => Promise.reject(new ApiError(503, "Admin invites aren't switched on yet.", "feature_unavailable"));
const safe = (token: string) => encodeURIComponent(token);

/** Looks up an invite from the email link. Anyone with the link can see who it is for; accepting needs the right account. */
export const getInvite = (token: string): Promise<InviteView> =>
  ADMIN_PREVIEW ? Promise.resolve(inviteDetails(token) as InviteView) : ADMIN_API_ENABLED ? api<InviteView>(`/api/public/staff-invites/${safe(token)}`) : unavailable();

/** Accepts it as the signed-in person. The server checks the invite was sent to this account's email. */
export const acceptInvite = (token: string): Promise<{ ok: true }> =>
  ADMIN_PREVIEW ? new Promise((r) => setTimeout(() => r({ ok: true }), 500)) : ADMIN_API_ENABLED ? api<{ ok: true }>(`/api/account/staff-invites/${safe(token)}/accept`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }) : unavailable();
