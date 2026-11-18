import type { AgendaEvent } from "./calendar-client";
import { addDays, dayKey, formatShortDay, todayIn } from "./tz";

// The rules behind the Calendar's meeting list and its filters. Pure (no React, no network), so every rule is tested.

export type Platform = "meet" | "zoom" | "teams" | "other_link" | "in_person" | "none";
export type RecordingState = "recorded" | "in_progress" | "didnt_happen" | "not_recorded";
export type DurationBucket = "lt15" | "15to30" | "30to60" | "gt60";
export type Role = "hosted" | "invited";

export const PLATFORM_LABEL: Record<Platform, string> = {
  meet: "Google Meet",
  zoom: "Zoom",
  teams: "Microsoft Teams",
  other_link: "Other video link",
  in_person: "In person or phone",
  none: "No location",
};
export const RECORDING_LABEL: Record<RecordingState, string> = {
  recorded: "Recorded",
  in_progress: "Assistant joining or recording",
  didnt_happen: "Capture didn’t happen",
  not_recorded: "Not recorded",
};
export const DURATION_LABEL: Record<DurationBucket, string> = { lt15: "Under 15 min", "15to30": "15 to 30 min", "30to60": "30 to 60 min", gt60: "Over 60 min" };
export const ROLE_LABEL: Record<Role, string> = { hosted: "Hosted by me", invited: "Invited" };

export function platformOf(e: Pick<AgendaEvent, "joinUrl" | "location">): Platform {
  if (e.joinUrl) {
    try {
      const h = new URL(e.joinUrl).hostname.toLowerCase();
      if (h === "meet.google.com") return "meet";
      if (h === "zoom.us" || h.endsWith(".zoom.us") || h.endsWith(".zoom.com") || h === "zoom.com") return "zoom";
      if (h === "teams.microsoft.com" || h === "teams.live.com") return "teams";
    } catch {
      /* not a URL we can read: treat it as some other link */
    }
    return "other_link";
  }
  return e.location?.trim() ? "in_person" : "none";
}

export function recordingOf(e: Pick<AgendaEvent, "capture">): RecordingState {
  const s = e.capture?.status;
  if (!s) return "not_recorded";
  if (s === "completed") return "recorded";
  if (s === "denied" || s === "timed_out" || s === "failed") return "didnt_happen";
  return "in_progress";
}

export const durationMin = (e: Pick<AgendaEvent, "start" | "end">) => Math.round((new Date(e.end).getTime() - new Date(e.start).getTime()) / 60_000);

export function durationBucket(min: number): DurationBucket {
  if (min < 15) return "lt15";
  if (min <= 30) return "15to30";
  if (min <= 60) return "30to60";
  return "gt60";
}

export interface MeetingFilters {
  query: string;
  /** Lower-case email addresses. A meeting matches if any of them was invited. */
  participants: string[];
  /** Inclusive dates (YYYY-MM-DD) in the person's own time zone. */
  from: string | null;
  to: string | null;
  durations: DurationBucket[];
  calendars: string[];
  platforms: Platform[];
  recording: RecordingState[];
  roles: Role[];
}

export const EMPTY_FILTERS: MeetingFilters = { query: "", participants: [], from: null, to: null, durations: [], calendars: [], platforms: [], recording: [], roles: [] };

/** How many separate filters are switched on (the search box counts as one). */
export function activeCount(f: MeetingFilters): number {
  return (f.query.trim() ? 1 : 0) + (f.participants.length ? 1 : 0) + (f.from || f.to ? 1 : 0) + (f.durations.length ? 1 : 0) + (f.calendars.length ? 1 : 0) + (f.platforms.length ? 1 : 0) + (f.recording.length ? 1 : 0) + (f.roles.length ? 1 : 0);
}

const has = <T>(list: T[], v: T) => list.length === 0 || list.includes(v);

/** Within a filter any choice matches (OR); across filters every one must match (AND). */
export function applyFilters(events: AgendaEvent[], f: MeetingFilters, tz: string): AgendaEvent[] {
  const q = f.query.trim().toLowerCase();
  return events.filter((e) => {
    if (q) {
      const hay = [e.title, e.location ?? "", e.calendarName ?? "", ...e.attendees.flatMap((a) => [a.name ?? "", a.email])].join("\n").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (f.participants.length && !e.attendees.some((a) => !a.self && f.participants.includes(a.email.toLowerCase()))) return false;
    if (f.from || f.to) {
      const day = dayKey(e.start, tz);
      if (f.from && day < f.from) return false;
      if (f.to && day > f.to) return false;
    }
    if (f.durations.length && (e.allDay || !f.durations.includes(durationBucket(durationMin(e))))) return false;
    if (!has(f.calendars, e.calendarName ?? "")) return false;
    if (!has(f.platforms, platformOf(e))) return false;
    if (!has(f.recording, recordingOf(e))) return false;
    if (f.roles.length && !f.roles.includes(e.organizerSelf ? "hosted" : "invited")) return false;
    return true;
  });
}

export interface Participant {
  email: string;
  name: string | null;
  meetings: number;
}

/** Everyone invited to the given meetings except you, most-met first. */
export function participantList(events: AgendaEvent[]): Participant[] {
  const by = new Map<string, Participant>();
  for (const e of events) {
    for (const a of e.attendees) {
      if (a.self) continue;
      const key = a.email.toLowerCase();
      const cur = by.get(key) ?? { email: key, name: null, meetings: 0 };
      cur.meetings += 1;
      cur.name ??= a.name;
      by.set(key, cur);
    }
  }
  return [...by.values()].sort((a, b) => b.meetings - a.meetings || (a.name ?? a.email).localeCompare(b.name ?? b.email));
}

/** Upcoming includes a meeting that is happening now. */
export const isUpcoming = (e: Pick<AgendaEvent, "end">, now: Date) => new Date(e.end).getTime() > now.getTime();

export interface DayGroup {
  key: string;
  label: string;
  events: AgendaEvent[];
}

export function dayLabel(key: string, tz: string, now: Date): string {
  const today = todayIn(tz, now);
  if (key === today) return "Today";
  if (key === addDays(today, 1)) return "Tomorrow";
  if (key === addDays(today, -1)) return "Yesterday";
  return formatShortDay(new Date(`${key}T12:00:00Z`), "UTC");
}

/** Groups by the day each meeting starts, in the person's own time zone. */
export function groupByDay(events: AgendaEvent[], tz: string, order: "asc" | "desc", now: Date): DayGroup[] {
  const sorted = [...events].sort((a, b) => (order === "asc" ? 1 : -1) * (a.start.localeCompare(b.start) || a.title.localeCompare(b.title)));
  const groups: DayGroup[] = [];
  for (const e of sorted) {
    const key = dayKey(e.start, tz);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.events.push(e);
    else groups.push({ key, label: dayLabel(key, tz, now), events: [e] });
  }
  return groups;
}
