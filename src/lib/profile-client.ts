import type { Mode, ThemeId } from "./theme";
import { DEFAULT_MODE, DEFAULT_THEME } from "./theme-boot";

export interface ProfileView {
  email: string;
  emailVerified: boolean;
  name: string | null;
  timezone: string;
  theme?: ThemeId;
  mode?: Mode;
  role: string | null; // Profession; never a workspace permission.
  workspaceRole: "owner" | "member";
  onboarded: boolean;
  defaultTemplate: string;
  outputsOnly: boolean;
  audioRetentionDays: number;
  isStaff: boolean;
  /** True only after the separate staff sign-in; being on the staff list is not enough. */
  staffSession?: boolean;
  staffSessionUntil?: string | null;
  avatarUrl: string | null;
  avatarExpiresAt: string | null;
  avatarVersion: number;
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
  return {
    ...body,
    theme: ["a", "b", "d", "e", "f"].includes(body.theme ?? "") ? body.theme : DEFAULT_THEME,
    mode: ["light", "dark", "system"].includes(body.mode ?? "") ? body.mode : DEFAULT_MODE,
    avatarUrl: body.avatarUrl ?? null,
    avatarExpiresAt: body.avatarExpiresAt ?? null,
    avatarVersion: typeof body.avatarVersion === "number" ? body.avatarVersion : 0,
    passwordUrl: body.passwordUrl ?? null,
  } as ProfileView;
}

export const getProfile = () => request();

export const saveProfile = (patch: { role?: string | null; complete?: boolean; name?: string | null; timezone?: string; outputsOnly?: boolean; theme?: ThemeId; mode?: Mode }) =>
  request({ method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
