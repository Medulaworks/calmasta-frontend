import type { MeetingPlatform } from "./types";

const HOSTS: Array<{ platform: MeetingPlatform; test: (host: string) => boolean }> = [
  { platform: "google_meet", test: (h) => h === "meet.google.com" },
  { platform: "microsoft_teams", test: (h) => h === "teams.microsoft.com" || h === "teams.live.com" },
  { platform: "zoom", test: (h) => h === "zoom.us" || h.endsWith(".zoom.us") },
];

/** Returns the platform for a supported meeting URL, or null if unsupported/invalid. */
export function detectMeetingPlatform(input: string): MeetingPlatform | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  const host = url.hostname.toLowerCase();
  return HOSTS.find((h) => h.test(host))?.platform ?? null;
}

/** Meeting URLs can carry access tokens; strip query/hash before logging. */
export function redactMeetingUrl(input: string): string {
  try {
    const url = new URL(input);
    return `${url.origin}${url.pathname}`;
  } catch {
    return "[invalid-url]";
  }
}

/**
 * Identity of a meeting for duplicate detection: host + path, no query or hash, so the same
 * meeting opened with and without a passcode counts once. Returns null for an invalid URL.
 */
export function meetingKey(input: string): string | null {
  try {
    const url = new URL(input.trim());
    return `${url.origin}${url.pathname.replace(/\/+$/, "")}`.toLowerCase();
  } catch {
    return null;
  }
}
