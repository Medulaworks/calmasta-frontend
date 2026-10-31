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
  attendees: Array<{ name: string | null; email: string; status: "accepted" | "declined" | "tentative" | "pending" | null; self: boolean }>;
  organizerSelf: boolean;
}

export interface Agenda {
  mock?: boolean;
  source?: "provider" | "unavailable" | "mock";
  available?: boolean;
  notice?: string | null;
  capabilities?: { providerSync: boolean; connect: boolean; disconnect: boolean; booking: boolean; capture: boolean };
  events: AgendaEvent[];
  problems: Array<{ connectionId: string; accountEmail: string; reason: "needs_reconnect" | "unavailable" }>;
  connected: boolean;
}

export interface ConnectionsResponse {
  mock: boolean;
  source: "mock" | "unavailable" | "provider";
  available: boolean;
  notice: string | null;
  provider: string | null;
  providers?: Array<"google" | "microsoft">;
  capabilities: { providerSync: boolean; connect: boolean; disconnect: boolean; booking: boolean; capture: boolean };
  connections: ConnectionView[];
}

export const getConnections = () => api<ConnectionsResponse>("/api/calendar/connections");
/** Development stand-in only: real providers connect through a sign-in page. */
export const connectDevCalendar = () => api<{ connectionId: string }>("/api/calendar/connections", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
export const connectGoogleCalendar = () => api<{ provider: "google"; authorizationUrl: string; expiresInSeconds: number }>("/api/calendar/connections/google/connect", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
export const connectMicrosoftCalendar = () => api<{ provider: "microsoft"; authorizationUrl: string; expiresInSeconds: number }>("/api/calendar/connections/microsoft/connect", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
export const disconnectCalendar = (id: string) => api<{ id: string; status: "disconnected"; providerRevoked: boolean | null } | void>(`/api/calendar/connections/${id}`, { method: "DELETE" });
export const getAgenda = (from: Date, to: Date) => api<Agenda>(`/api/calendar/agenda?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`);
