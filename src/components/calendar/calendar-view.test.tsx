import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { expect, it, vi, beforeEach } from "vitest";
import { MeetingRow } from "./calendar-view";
import { qk } from "@/lib/queries";

vi.mock("next/navigation", () => ({ useSearchParams: () => ({ get: () => null }) }));

const basePolicy = { meetingEnabled: true, maxMeetingDurationSeconds: 1800, videoEnabled: true, botName: "Bot" };

function event(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "e1",
    title: "Team sync",
    start: new Date("2026-11-05T10:00:00Z").toISOString(),
    end: new Date("2026-11-05T11:00:00Z").toISOString(),
    allDay: false,
    calendarName: "Work",
    calendarColor: "#fff",
    attendees: [{ email: "a@test.com", name: "A", self: true }],
    source: "google",
    organizerSelf: true,
    joinUrl: "https://meet.google.com/abc-defg-hij",
    capture: null,
    location: null,
    accountEmail: "user@test.com",
    ...overrides,
  } as unknown as Parameters<typeof MeetingRow>[0]["e"];
}

function markup(e: ReturnType<typeof event>, opts: { policy?: unknown; upcoming?: boolean } = {}) {
  const client = new QueryClient();
  if (opts.policy !== undefined) client.setQueryData(qk.capturePolicy(), opts.policy);
  else client.setQueryData(qk.capturePolicy(), basePolicy);
  const html = renderToStaticMarkup(
    createElement(QueryClientProvider, { client },
      createElement(MeetingRow, { e, timeZone: "UTC", selected: false, upcoming: opts.upcoming ?? true, onSelect: () => {} })
    )
  );
  return html;
}

beforeEach(() => vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({}))));


it("renders Send Bot button for each card with joinUrl", () => {
  const html = markup(event());
  expect(html).toContain("Send bot");
  expect(html).toContain("Bot");
});

it("hides bot button when no joinUrl", () => {
  const html = markup(event({ joinUrl: null }));
  expect(html).not.toContain("Send bot");
  expect(html).not.toContain("Bot");
});

it("disables bot when capture already active (sent guard)", () => {
  const html = markup(event({ capture: { status: "recording", id: "c1" } as unknown as Record<string, unknown> }));
  expect(html).toContain("Sent");
  expect(html).toContain("disabled");
});

it("disables bot when meeting capture not enabled via policy", () => {
  const html = markup(event(), { policy: { meetingEnabled: false, maxMeetingDurationSeconds: 1800 } });
  expect(html).toContain("Meeting capture not enabled");
  expect(html).toContain("disabled");
});

it("shows Bot for upcoming, still shows for non-upcoming with joinUrl but without Join", () => {
  const upcoming = markup(event(), { upcoming: true });
  expect(upcoming).toContain("Join");
  expect(upcoming).toContain("Bot");
  const past = markup(event(), { upcoming: false });
  expect(past).not.toContain("Join");
  expect(past).toContain("Bot");
});
