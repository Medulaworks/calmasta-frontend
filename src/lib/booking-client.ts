import { api } from "./upload-client";

export type Weekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
export const WEEKDAYS: Array<{ id: Weekday; label: string }> = [
  { id: "mon", label: "Monday" }, { id: "tue", label: "Tuesday" }, { id: "wed", label: "Wednesday" }, { id: "thu", label: "Thursday" },
  { id: "fri", label: "Friday" }, { id: "sat", label: "Saturday" }, { id: "sun", label: "Sunday" },
];
export type WeeklyHours = Partial<Record<Weekday, Array<{ start: string; end: string }>>>;

export interface AvailabilityView {
  id: string; name: string; timezone: string; weekly: WeeklyHours; bufferBeforeMin: number; bufferAfterMin: number; minNoticeMin: number;
  maxDaysAhead: number; slotStepMin: number; conflictCalendarIds: string[]; destinationCalendarId: string | null; usedBy: number;
}
export type AvailabilityInput = Omit<AvailabilityView, "id" | "usedBy">;

export interface PageView { id: string; slug: string; title: string; description: string; active: boolean; activeMeetingTypes: number }
export interface MeetingTypeView {
  id: string; pageId: string; pageSlug: string; pageTitle: string; availabilityId: string; availabilityName: string; name: string; description: string;
  durationMin: number; locationText: string; captureEnabled: boolean; active: boolean; position: number;
}
export interface MeetingTypeInput {
  pageId: string; availabilityId: string; name: string; description: string; durationMin: number; locationText: string; active: boolean;
  captureEnabled: boolean; captureConfirmed: boolean;
}

export interface HostBooking {
  id: string; meetingName: string; durationMin: number; guestName: string; guestEmail: string; guestTimezone: string; guestNote: string | null;
  startAt: string; endAt: string; status: "confirmed" | "cancelled"; cancelledBy: string | null; rescheduled: boolean; emailStatus: string;
  calendarStatus: string; captureId: string | null; locationText: string; meetingTypeId: string | null;
}

export interface Slot { start: string; end: string }
export interface SlotsResponse { hostTimezone: string; durationMin: number; slots: Slot[] }

const json = (method: string, body?: unknown): RequestInit => ({ method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });

// --- the host ---
export const listAvailabilities = () => api<{ availabilities: AvailabilityView[] }>("/api/booking/availability").then((r) => r.availabilities);
export const saveAvailability = (input: AvailabilityInput, id?: string) => api<{ id: string }>(id ? `/api/booking/availability/${id}` : "/api/booking/availability", json(id ? "PUT" : "POST", input));
export const deleteAvailability = (id: string) => api<void>(`/api/booking/availability/${id}`, { method: "DELETE" });
export const listPages = () => api<{ pages: PageView[] }>("/api/booking/pages").then((r) => r.pages);
export const savePage = (input: { slug: string; title: string; description: string; active: boolean }, id?: string) => api<{ id: string }>(id ? `/api/booking/pages/${id}` : "/api/booking/pages", json(id ? "PUT" : "POST", input));
export const deletePage = (id: string) => api<void>(`/api/booking/pages/${id}`, { method: "DELETE" });
export const listMeetingTypes = () => api<{ meetingTypes: MeetingTypeView[] }>("/api/booking/meeting-types").then((r) => r.meetingTypes);
export const saveMeetingType = (input: MeetingTypeInput, id?: string) => api<{ id: string }>(id ? `/api/booking/meeting-types/${id}` : "/api/booking/meeting-types", json(id ? "PUT" : "POST", input));
export const deleteMeetingType = (id: string) => api<void>(`/api/booking/meeting-types/${id}`, { method: "DELETE" });
export const listBookings = (scope: "upcoming" | "past") => api<{ bookings: HostBooking[] }>(`/api/booking/bookings?scope=${scope}`).then((r) => r.bookings);
export const cancelBookingAsHost = (id: string) => api<HostBooking>(`/api/booking/bookings/${id}/cancel`, { method: "POST" });
export const rescheduleBookingAsHost = (id: string, start: string) => api<HostBooking>(`/api/booking/bookings/${id}/reschedule`, json("POST", { start }));
export const hostSlots = (id: string, from: string, days: number) => api<SlotsResponse>(`/api/booking/bookings/${id}/slots?from=${from}&days=${days}`);

// --- guests (no sign-in) ---
export interface PublicPage { title: string; description: string; hostName: string | null; meetingTypes: Array<{ id: string; name: string; description: string; durationMin: number }> }
export interface GuestBooking {
  meetingName: string; durationMin: number; hostName: string | null; startAt: string; endAt: string; guestName: string; guestEmail: string; guestTimezone: string;
  locationText: string; status: "confirmed" | "cancelled"; cancelledBy: string | null; rescheduled: boolean; emailStatus: string; canChange: boolean;
}
export const getPublicPage = (slug: string) => api<PublicPage>(`/api/public/pages/${encodeURIComponent(slug)}`);
export const publicSlots = (slug: string, typeId: string, from: string, days: number, tz: string) =>
  api<SlotsResponse>(`/api/public/pages/${encodeURIComponent(slug)}/slots?type=${typeId}&from=${from}&days=${days}&tz=${encodeURIComponent(tz)}`);
export const createPublicBooking = (slug: string, input: { typeId: string; start: string; guestName: string; guestEmail: string; guestTimezone: string; note: string }) =>
  api<{ manageToken: string; booking: GuestBooking }>(`/api/public/pages/${encodeURIComponent(slug)}/book`, json("POST", input));
export const getGuestBooking = (token: string) => api<GuestBooking>(`/api/public/bookings/${encodeURIComponent(token)}`);
export const cancelGuestBooking = (token: string) => api<GuestBooking>(`/api/public/bookings/${encodeURIComponent(token)}/cancel`, { method: "POST" });
export const rescheduleGuestBooking = (token: string, start: string) => api<GuestBooking>(`/api/public/bookings/${encodeURIComponent(token)}/reschedule`, json("POST", { start }));
export const guestSlots = (token: string, from: string, days: number, tz: string) =>
  api<SlotsResponse>(`/api/public/bookings/${encodeURIComponent(token)}/slots?from=${from}&days=${days}&tz=${encodeURIComponent(tz)}`);
