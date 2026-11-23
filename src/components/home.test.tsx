import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ActionCards, WelcomeBar } from "./dashboard/home";
import { ItemRow, statusFor } from "./dashboard/item-row";
import { CaptureTile, PlatformLogo, meetingPlatform, platformKey } from "./ui/platform-logo";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => undefined, replace: () => undefined }), usePathname: () => "/dashboard", useSearchParams: () => new URLSearchParams() }));
const html = (el: React.ReactElement) => renderToStaticMarkup(el);

describe("platform logos", () => {
  it("recognises the platform from the backend’s name, a link, or a title", () => {
    expect(platformKey("google_meet")).toBe("google_meet");
    expect(platformKey("Teams")).toBe("microsoft_teams");
    expect(platformKey("zoom")).toBe("zoom");
    expect(platformKey(null, "https://meet.google.com/abc-defg-hij")).toBe("google_meet");
    expect(platformKey(null, "Weekly sync on Zoom")).toBe("zoom");
    expect(platformKey(null, "https://teams.microsoft.com/l/meetup-join/x")).toBe("microsoft_teams");
    expect(platformKey(null, "Meeting")).toBeNull();
    expect(platformKey("something_else")).toBeNull();
  });
  it("draws each platform’s logo with its name for screen readers, and a neutral tile when unknown", () => {
    for (const [p, name, file] of [["google_meet", "Google Meet", "google-meet"], ["microsoft_teams", "Microsoft Teams", "teams"], ["zoom", "Zoom", "zoom"]] as const) {
      const out = html(createElement(PlatformLogo, { platform: p }));
      expect(out).toContain(`aria-label="${name}"`);
      expect(out).toContain("<img");
      expect(out).toContain(file);
    }
    expect(html(createElement(PlatformLogo, { platform: null }))).not.toContain("aria-label");
  });
  it("a meeting whose platform the server did not send shows a neutral tile, never a guessed logo", () => {
    expect(meetingPlatform(null, "Meeting")).toBe("google_meet");
    expect(meetingPlatform("zoom")).toBe("zoom");
    const unknown = html(createElement(CaptureTile, { kind: "meeting" }));
    expect(unknown).not.toContain("<img");
    expect(unknown).not.toContain("aria-label");
    expect(html(createElement(CaptureTile, { kind: "meeting", platform: "zoom" }))).toContain('aria-label="Zoom"');
    expect(html(createElement(CaptureTile, { kind: "recording" }))).not.toContain("<img");
  });
  it("a finished meeting row shows its platform’s logo and name", () => {
    const out = html(createElement(ItemRow, { item: { id: "1", kind: "meeting", title: "Design review", status: "completed", failureReason: null, at: "2026-10-29T10:00:00Z", href: "/dashboard/captures/1", platform: "zoom", source: "meeting_url", state: "completed" } }));
    expect(out).toContain('aria-label="Zoom"');
    expect(out).toContain("Zoom ·");
  });
  it("a meeting row without a platform shows the Google Meet logo, as My Folder and the recording page do", () => {
    const out = html(createElement(ItemRow, { item: { id: "2", kind: "meeting", title: "Weekly sync", status: "completed", failureReason: null, at: "2026-10-29T10:00:00Z", href: "/dashboard/captures/2", platform: null, source: "meeting_url", state: "completed" } }));
    expect(out).toContain('aria-label="Google Meet"');
    expect(out).toContain("<img");
    expect(out).toContain("Google Meet ·");
  });
});

describe("meeting status", () => {
  it("a meeting that is recording animates as Recording even when the server omits the source", () => {
    const item = { id: "1", kind: "meeting" as const, title: "Meeting", status: "", failureReason: null, at: "2026-11-09T10:00:00Z", href: "/dashboard/captures/1", state: "recording" };
    expect(statusFor(item)).toMatchObject({ label: "Recording", active: true, indicator: "recording" });
    expect(statusFor({ ...item, status: "recording", state: undefined })).toMatchObject({ label: "Recording", active: true });
    // What the server really sends: source "meeting", progress in the state.
    expect(statusFor({ ...item, source: "meeting", status: "recording", state: "recording" })).toMatchObject({ label: "Recording", tone: "danger", active: true, indicator: "recording" });
    expect(statusFor({ ...item, source: "meeting", status: "active", state: "joining" })).toMatchObject({ label: "Joining the meeting", active: true });
    expect(statusFor({ ...item, source: "meeting", status: "done", state: "completed" })).toMatchObject({ label: "Ready", tone: "success", active: false });
    expect(statusFor({ ...item, status: "waiting_for_admission", state: undefined })).toMatchObject({ label: "Waiting to be let in", active: true });
  });
  it("a state with no wording is shown readable, not raw", () => {
    expect(statusFor({ id: "2", kind: "recording" as const, title: "Recording", status: "", failureReason: null, at: "2026-11-09T10:00:00Z", href: "/x", state: "some_new_state" }).label).toBe("Some new state");
  });
});

describe("home pieces", () => {
  it("offers three ways to start, as equal clean cards", () => {
    const out = html(createElement(ActionCards));
    for (const t of ["Record your voice", "Join a meeting", "Upload audio"]) expect(out).toContain(t);
    expect(out).toContain('href="/dashboard/voice"');
    expect(out).toContain('href="/dashboard/capture?focus=link"');
    for (const n of ["Google Meet", "Microsoft Teams", "Zoom"]) expect(out).toContain(`aria-label="${n}"`);
    expect(out.match(/bg-accent-solid text-on-accent/g)?.length).toBe(1); // only the record icon is filled
  });
  it("the welcome line shows the greeting and leaves the clock for after load", () => {
    const out = html(createElement(WelcomeBar, { title: "Welcome back, Ama.", subtitle: "Here’s what’s been happening.", timeZone: "UTC" }));
    expect(out).toContain("Welcome back, Ama.");
    expect(out).toContain("Here’s what’s been happening.");
    expect(out).not.toContain("tabular-nums");
  });
});
