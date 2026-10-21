import { api } from "./upload-client";

export interface ConnectionView {
  id: string;
  provider: string;
  accountEmail: string;
  status: "connected" | "needs_reconnect";
  connectedAt: string;
  calendars: Array<{ id: string; name: string; color: string | null; isPrimary: boolean }>;
  impact: { upcomingBookings: number; availabilities: number };
}

export interface AgendaEvent {
  id: string;
  source: "calendar" | "booking";
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  calendarName: string | null;
  calendarColor: string | null;
  accountEmail: string | null;
  location: string | null;
  joinUrl: string | null;
  capture: { id: string; status: string } | null;
  bookingId: string | null;
}

export interface Agenda {
  events: AgendaEvent[];
  problems: Array<{ connectionId: string; accountEmail: string; reason: "needs_reconnect" | "unavailable" }>;
  connected: boolean;
}

export const getConnections = () => api<{ provider: string; connections: ConnectionView[] }>("/api/calendar/connections");
/** Development stand-in only: real providers connect through a sign-in page. */
export const connectDevCalendar = () => api<{ connectionId: string }>("/api/calendar/connections", { method: "POST" });
export const disconnectCalendar = (id: string) => api<void>(`/api/calendar/connections/${id}`, { method: "DELETE" });
export const getAgenda = (from: Date, to: Date) => api<Agenda>(`/api/calendar/agenda?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`);
