import type { Dashboard } from "./dashboard-types";

export type { Dashboard };
export type { DashboardItem } from "./dashboard-types";

export async function fetchDashboard(): Promise<Dashboard> {
  const res = await fetch("/api/dashboard");
  const body = (await res.json().catch(() => ({}))) as Dashboard & { error?: string };
  if (!res.ok) {
    throw new Error(
      res.status === 401
        ? "You're not signed in. Sign-in isn't set up yet; for local development set DEV_AUTH_EMAIL."
        : (body.error ?? "Could not load your dashboard."),
    );
  }
  return body;
}
