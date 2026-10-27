import { afterEach, expect, it, vi } from "vitest";
import { ProfileError, getProfile, saveProfile } from "./profile-client";

const fetcher = vi.fn();
afterEach(() => {
  vi.unstubAllGlobals();
  fetcher.mockReset();
});

it("normalizes missing avatarUrl and passwordUrl to null in profile response", async () => {
  vi.stubGlobal("fetch", fetcher);
  fetcher.mockResolvedValue(
    new Response(
      JSON.stringify({
        email: "doc@example.com",
        emailVerified: true,
        name: "Doctor",
        timezone: "UTC",
        role: "consultant",
        workspaceRole: "owner",
        onboarded: true,
        defaultTemplate: "consultant_brief",
        outputsOnly: false,
        audioRetentionDays: 30,
        isStaff: false,
      }),
      { status: 200 },
    ),
  );

  const profile = await getProfile();
  expect(fetcher).toHaveBeenCalledWith("/api/me", undefined);
  expect(profile.avatarUrl).toBeNull();
  expect(profile.passwordUrl).toBeNull();
  expect(profile.role).toBe("consultant");
});

it("throws ProfileError with distinct session message on 401", async () => {
  vi.stubGlobal("fetch", fetcher);
  fetcher.mockResolvedValue(new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 }));

  await expect(getProfile()).rejects.toBeInstanceOf(ProfileError);
  await expect(getProfile()).rejects.toMatchObject({
    status: 401,
    message: "Your session ended. Please sign in again.",
  });
});

it("sends PATCH /api/me with proper json payload and headers", async () => {
  vi.stubGlobal("fetch", fetcher);
  fetcher.mockResolvedValue(
    new Response(
      JSON.stringify({
        email: "user@example.com",
        emailVerified: true,
        name: "User",
        timezone: "America/New_York",
        role: "sales",
        workspaceRole: "member",
        onboarded: true,
        defaultTemplate: "summary_and_actions",
        outputsOnly: false,
        audioRetentionDays: 30,
        isStaff: false,
      }),
      { status: 200 },
    ),
  );

  const updated = await saveProfile({ role: "sales", complete: true });
  expect(fetcher).toHaveBeenCalledWith("/api/me", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role: "sales", complete: true }),
  });
  expect(updated.onboarded).toBe(true);
});
