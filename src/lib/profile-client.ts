export interface ProfileView {
  email: string;
  emailVerified: boolean;
  name: string | null;
  timezone: string;
  role: string | null; // Profession; never a workspace permission.
  workspaceRole: "owner" | "member";
  onboarded: boolean;
  defaultTemplate: string;
  outputsOnly: boolean;
  audioRetentionDays: number;
  isStaff: boolean;
  avatarUrl: string | null;
  passwordUrl: string | null;
}

export class ProfileError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request(init?: RequestInit): Promise<ProfileView> {
  const res = await fetch("/api/me", init);
  const body = (await res.json().catch(() => ({}))) as Partial<ProfileView> & { error?: string };
  if (!res.ok) {
    throw new ProfileError(
      res.status,
      res.status === 401
        ? "Your session ended. Please sign in again."
        : (body.error ?? "Something went wrong. Please try again."),
    );
  }
  return body as ProfileView;
}

export const getProfile = () => request();

export const saveProfile = (patch: { role?: string | null; complete?: boolean; name?: string | null; timezone?: string; outputsOnly?: boolean }) =>
  request({ method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
