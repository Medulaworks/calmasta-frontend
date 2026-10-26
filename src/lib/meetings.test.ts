import { describe, expect, it } from "vitest";
import type { AgendaEvent } from "./calendar-client";
import { EMPTY_FILTERS, activeCount, applyFilters, dayLabel, durationBucket, groupByDay, isUpcoming, participantList, platformOf, recordingOf } from "./meetings";

const NOW = new Date("2026-10-23T12:00:00Z"); // a Friday
const TZ = "Asia/Muscat"; // UTC+4, no daylight saving

let n = 0;
function ev(o: Partial<AgendaEvent> & { start: string; minutes?: number }): AgendaEvent {
  const { minutes = 30, start, ...rest } = o;
  return {
    id: `e${++n}`, source: "calendar", title: "Meeting", start, end: new Date(new Date(start).getTime() + minutes * 60_000).toISOString(), allDay: false,
    calendarName: "Work", calendarColor: null, accountEmail: null, location: null, joinUrl: null, capture: null, bookingId: null, attendees: [], organizerSelf: true,
    ...rest,
  };
}
const person = (email: string, name: string | null = null, self = false) => ({ name, email, status: "accepted" as const, self });

describe("platformOf", () => {
  it("reads the video service from the link, not from anything the title says", () => {
    expect(platformOf({ joinUrl: "https://meet.google.com/abc-defg-hij", location: null })).toBe("meet");
    expect(platformOf({ joinUrl: "https://us02web.zoom.us/j/123", location: null })).toBe("zoom");
    expect(platformOf({ joinUrl: "https://teams.microsoft.com/l/meetup-join/x", location: null })).toBe("teams");
    expect(platformOf({ joinUrl: "https://whereby.com/room", location: null })).toBe("other_link");
    expect(platformOf({ joinUrl: "not a url", location: null })).toBe("other_link");
  });
  it("is not fooled by a look-alike address", () => {
    expect(platformOf({ joinUrl: "https://meet.google.com.evil.test/x", location: null })).toBe("other_link");
    expect(platformOf({ joinUrl: "https://notzoom.us/j/1", location: null })).toBe("other_link");
  });
  it("falls back to the location text, then to nothing", () => {
    expect(platformOf({ joinUrl: null, location: "Room 2" })).toBe("in_person");
    expect(platformOf({ joinUrl: null, location: "  " })).toBe("none");
    expect(platformOf({ joinUrl: null, location: null })).toBe("none");
  });
});

describe("recordingOf and durations", () => {
  it("maps a capture's status to what a person cares about", () => {
    expect(recordingOf({ capture: null })).toBe("not_recorded");
    expect(recordingOf({ capture: { id: "c", status: "completed" } })).toBe("recorded");
    for (const s of ["requested", "scheduled", "joining", "waiting_for_admission", "recording", "processing"]) expect(recordingOf({ capture: { id: "c", status: s } }), s).toBe("in_progress");
    for (const s of ["denied", "timed_out", "failed"]) expect(recordingOf({ capture: { id: "c", status: s } }), s).toBe("didnt_happen");
  });
  it("buckets durations at the edges", () => {
    expect([14, 15, 30, 31, 60, 61].map(durationBucket)).toEqual(["lt15", "15to30", "15to30", "30to60", "30to60", "gt60"]);
  });
});

describe("applyFilters", () => {
  const standup = ev({ title: "Team standup", start: "2026-10-26T06:00:00Z", minutes: 30, joinUrl: "https://meet.google.com/a-b-c", attendees: [person("me@x.test", null, true), person("Maya@X.test", "Maya Chen"), person("dan@x.test", "Daniel Ortiz")] });
  const review = ev({ title: "Project review", start: "2026-10-28T08:00:00Z", minutes: 60, location: "Room 2", calendarName: "Personal", organizerSelf: false, attendees: [person("sam@x.test", "Sam Oak")] });
  const call = ev({ title: "Client call", start: "2026-10-29T10:00:00Z", minutes: 90, joinUrl: "https://us02web.zoom.us/j/1", capture: { id: "c1", status: "completed" }, source: "booking", attendees: [person("grace@northwind.test", "Grace Lee")] });
  const holiday = ev({ title: "Public holiday", start: "2026-10-30T00:00:00Z", minutes: 1440, allDay: true });
  const all = [standup, review, call, holiday];
  const f = (o: Partial<typeof EMPTY_FILTERS>) => ({ ...EMPTY_FILTERS, ...o });
  const titles = (o: Partial<typeof EMPTY_FILTERS>) => applyFilters(all, f(o), TZ).map((e) => e.title);

  it("shows everything when nothing is chosen", () => expect(titles({})).toHaveLength(4));
  it("searches titles, locations, calendars and who was invited, ignoring case", () => {
    expect(titles({ query: "standup" })).toEqual(["Team standup"]);
    expect(titles({ query: "ROOM 2" })).toEqual(["Project review"]);
    expect(titles({ query: "northwind" })).toEqual(["Client call"]);
    expect(titles({ query: "personal" })).toEqual(["Project review"]);
    expect(titles({ query: "zzz" })).toEqual([]);
  });
  it("filters by participant, matching on any chosen person and never counting you", () => {
    expect(titles({ participants: ["maya@x.test"] })).toEqual(["Team standup"]); // address stored in another case
    expect(titles({ participants: ["maya@x.test", "sam@x.test"] })).toEqual(["Team standup", "Project review"]);
    expect(titles({ participants: ["me@x.test"] })).toEqual([]); // that's you
  });
  it("filters by date in the person's own zone, inclusive at both ends", () => {
    // 2026-10-26T06:00Z is 10:00 on the 26th in Muscat; the 29th 10:00Z is 14:00 on the 29th.
    expect(titles({ from: "2026-10-28", to: "2026-10-29" })).toEqual(["Project review", "Client call"]);
    expect(titles({ from: "2026-10-30" })).toEqual(["Public holiday"]);
    expect(titles({ to: "2026-10-26" })).toEqual(["Team standup"]);
    // 2026-10-29T23:00Z is already the 30th in Muscat.
    const late = ev({ title: "Late", start: "2026-10-29T23:00:00Z" });
    expect(applyFilters([late], f({ to: "2026-10-29" }), TZ)).toEqual([]);
    expect(applyFilters([late], f({ from: "2026-10-30", to: "2026-10-30" }), TZ)).toHaveLength(1);
  });
  it("filters by duration, and an all-day event is never mistaken for a long meeting", () => {
    expect(titles({ durations: ["15to30"] })).toEqual(["Team standup"]);
    expect(titles({ durations: ["30to60"] })).toEqual(["Project review"]);
    expect(titles({ durations: ["gt60"] })).toEqual(["Client call"]); // not the 24-hour holiday
    expect(titles({ durations: ["30to60", "gt60"] })).toEqual(["Project review", "Client call"]);
  });
  it("filters by calendar, platform, recording and role", () => {
    expect(titles({ calendars: ["Personal"] })).toEqual(["Project review"]);
    expect(titles({ platforms: ["zoom"] })).toEqual(["Client call"]);
    expect(titles({ platforms: ["in_person", "meet"] })).toEqual(["Team standup", "Project review"]);
    expect(titles({ recording: ["recorded"] })).toEqual(["Client call"]);
    expect(titles({ recording: ["not_recorded"] })).toEqual(["Team standup", "Project review", "Public holiday"]);
    expect(titles({ roles: ["invited"] })).toEqual(["Project review"]);
    expect(titles({ roles: ["hosted"] })).toEqual(["Team standup", "Client call", "Public holiday"]);
  });
  it("combines different filters with AND", () => {
    expect(titles({ platforms: ["meet", "zoom"], durations: ["gt60"] })).toEqual(["Client call"]);
    expect(titles({ roles: ["hosted"], recording: ["recorded"], query: "client" })).toEqual(["Client call"]);
    expect(titles({ roles: ["invited"], platforms: ["zoom"] })).toEqual([]);
  });
  it("counts how many filters are on", () => {
    expect(activeCount(EMPTY_FILTERS)).toBe(0);
    expect(activeCount(f({ query: "  " }))).toBe(0);
    expect(activeCount(f({ query: "a", participants: ["x", "y"], from: "2026-10-01", platforms: ["zoom"] }))).toBe(4);
    expect(activeCount(f({ to: "2026-10-01" }))).toBe(1);
  });
});

describe("participantList", () => {
  it("lists everyone except you, once, with how many meetings they are in, most first", () => {
    const a = ev({ start: "2026-10-26T06:00:00Z", attendees: [person("me@x.test", null, true), person("maya@x.test", null), person("dan@x.test", "Daniel")] });
    const b = ev({ start: "2026-10-27T06:00:00Z", attendees: [person("MAYA@x.test", "Maya Chen"), person("sam@x.test", "Sam")] });
    expect(participantList([a, b])).toEqual([
      { email: "maya@x.test", name: "Maya Chen", meetings: 2 },
      { email: "dan@x.test", name: "Daniel", meetings: 1 },
      { email: "sam@x.test", name: "Sam", meetings: 1 },
    ]);
    expect(participantList([])).toEqual([]);
  });
});

describe("grouping by day", () => {
  const a = ev({ title: "Early", start: "2026-10-23T05:00:00Z" }); // 09:00 Fri in Muscat
  const b = ev({ title: "Late same day", start: "2026-10-23T18:30:00Z" }); // 22:30 Fri
  const c = ev({ title: "Crosses midnight in Muscat", start: "2026-10-23T20:30:00Z" }); // 00:30 Sat
  const d = ev({ title: "Next week", start: "2026-10-30T06:00:00Z" });
  it("groups by the day it starts in the person's zone, oldest first for upcoming", () => {
    const g = groupByDay([d, c, b, a], TZ, "asc", NOW);
    expect(g.map((x) => [x.key, x.events.map((e) => e.title)])).toEqual([
      ["2026-10-23", ["Early", "Late same day"]],
      ["2026-10-24", ["Crosses midnight in Muscat"]],
      ["2026-10-30", ["Next week"]],
    ]);
  });
  it("puts the newest first for past meetings", () => {
    expect(groupByDay([a, d], TZ, "desc", NOW).map((x) => x.key)).toEqual(["2026-10-30", "2026-10-23"]);
  });
  it("says Today, Tomorrow and Yesterday in words and other days as dates", () => {
    expect(dayLabel("2026-10-23", TZ, NOW)).toBe("Today");
    expect(dayLabel("2026-10-24", TZ, NOW)).toBe("Tomorrow");
    expect(dayLabel("2026-10-22", TZ, NOW)).toBe("Yesterday");
    expect(dayLabel("2026-10-30", TZ, NOW)).toMatch(/Fri/);
    expect(dayLabel("2026-10-30", TZ, NOW)).toMatch(/30/);
  });
  it("counts a meeting under way as upcoming, and one that has ended as past", () => {
    expect(isUpcoming({ end: "2026-10-23T12:30:00Z" }, NOW)).toBe(true);
    expect(isUpcoming({ end: "2026-10-23T12:00:00Z" }, NOW)).toBe(false);
  });
});
