import { queryOptions } from "@tanstack/react-query";
import { getProfile } from "./profile-client";
import { ApiError, getCapturePolicy, getPrivateAudio, listCaptures, getCapture } from "./upload-client";
import { searchLibraryPage } from "./library-client";
import type { LibraryQuery } from "./library-client";
import { fetchUsageSummary } from "./usage-client";
import { fetchDashboard } from "./dashboard-client";
import { getConnections, getAgenda } from "./calendar-client";
import { listDocuments, getDocument, listVersions } from "./documents-client";
import { fetchNotifications } from "./notifications-client";
import {
  listAvailabilities,
  listPages,
  listMeetingTypes,
  listBookings,
  getPublicPage,
  publicSlots,
  getGuestBooking,
  guestSlots,
} from "./booking-client";
import { adminGet } from "./admin-client";
import { getMeetingInsights, getMeetingPreferences } from "./meeting-insights-client";
import { insightsPollInterval } from "./meeting-insights";

// hierarchical keys
export const qk = {
  profile: () => ["profile"] as const,
  capturePolicy: () => ["capturePolicy"] as const,
  captures: (limit: number, kind?: "meetings" | "recordings") => ["captures", { limit, kind }] as const,
  capture: (id: string) => ["capture", id] as const,
  meetingInsights: (id: string,templateId="enhanced") => templateId==="enhanced"?["capture", id, "insights"] as const:["capture", id, "insights",templateId] as const,
  meetingQuestions:(id:string)=>["capture",id,"insightQuestions"] as const,
  meetingPreferences: () => ["meetingPreferences"] as const,
  privateAudio: (id: string) => ["privateAudio", id] as const,
  library: (q: LibraryQuery, cursor?: string, limit?: number) => ["library", q, cursor, limit] as const,
  usage: () => ["usage", "summary"] as const,
  dashboard: () => ["dashboard"] as const,
  calendarConnections: () => ["calendar", "connections"] as const,
  agenda: (from: string, to: string) => ["calendar", "agenda", from, to] as const,
  documents: () => ["documents"] as const,
  document: (id: string) => ["document", id] as const,
  documentVersions: (id: string) => ["document", id, "versions"] as const,
  notifications: () => ["notifications"] as const,
  bookingAvailabilities: () => ["booking", "availabilities"] as const,
  bookingPages: () => ["booking", "pages"] as const,
  bookingMeetingTypes: () => ["booking", "meetingTypes"] as const,
  bookings: (scope: "upcoming" | "past") => ["booking", "bookings", scope] as const,
  publicPage: (slug: string) => ["publicPage", slug] as const,
  publicSlots: (slug: string, typeId: string, from: string, days: number, tz: string) =>
    ["publicSlots", slug, typeId, from, days, tz] as const,
  guestBooking: (token: string) => ["guestBooking", token] as const,
  guestSlots: (token: string, from: string, days: number, tz: string) =>
    ["guestSlots", token, from, days, tz] as const,
  admin: (path: string) => ["admin", path] as const,
};

// queryOptions with tuned caching

export const profileQuery = queryOptions({
  queryKey: qk.profile(),
  queryFn: () => getProfile(),
  staleTime: 5 * 60 * 1000,
  gcTime: 30 * 60 * 1000,
  retry: 1,
});

export const capturePolicyQuery = queryOptions({
  queryKey: qk.capturePolicy(),
  queryFn: ({ signal }) => getCapturePolicy(signal),
  staleTime: 5 * 60 * 1000,
  gcTime: 10 * 60 * 1000,
});

export const capturesQuery = (limit = 25, kind?: "meetings" | "recordings") =>
  queryOptions({
    queryKey: qk.captures(limit, kind),
    queryFn: ({ signal }) => listCaptures(limit, kind, signal),
    staleTime: 15 * 1000,
    gcTime: 5 * 60 * 1000,
    placeholderData: (prev) => prev,
  });

export const captureQuery = (id: string) =>
  queryOptions({
    queryKey: qk.capture(id),
    queryFn: ({ signal }) => getCapture(id, signal),
    staleTime: 10 * 1000,
    gcTime: 5 * 60 * 1000,
    enabled: !!id,
  });

export const privateAudioQuery = (id: string) =>
  queryOptions({
    queryKey: qk.privateAudio(id),
    queryFn: () => getPrivateAudio(id),
    staleTime: 60 * 1000,
    gcTime: 2 * 60 * 1000,
    enabled: !!id,
  });

export const meetingInsightsQuery = (id: string,templateId="enhanced") => queryOptions({
  queryKey: qk.meetingInsights(id,templateId),
  queryFn: ({ signal }) => getMeetingInsights(id, signal,templateId),
  enabled: !!id,
  staleTime: 0,
  retry: (failures, error) => failures < 3 && !(error instanceof ApiError && [401, 403, 404, 409, 503].includes(error.status)),
  retryDelay: attempt => Math.min(3000 * 2 ** attempt, 30_000),
  refetchIntervalInBackground: false,
  refetchInterval: query => insightsPollInterval(query.state.data, query.state.fetchFailureCount, query.state.error),
});

export const meetingPreferencesQuery = queryOptions({
  queryKey: qk.meetingPreferences(),
  queryFn: ({ signal }) => getMeetingPreferences(signal),
  staleTime: 60_000,
  retry: false,
});

export const libraryQuery = (q: LibraryQuery, cursor?: string, limit = 25) =>
  queryOptions({
    queryKey: qk.library(q, cursor, limit),
    queryFn: ({ signal }) => searchLibraryPage(q, signal, cursor, limit),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    placeholderData: (prev) => prev,
  });

export const usageQuery = queryOptions({
  queryKey: qk.usage(),
  queryFn: () => fetchUsageSummary(),
  staleTime: 60 * 1000,
  gcTime: 5 * 60 * 1000,
});

export const dashboardQuery = queryOptions({
  queryKey: qk.dashboard(),
  queryFn: () => fetchDashboard(),
  staleTime: 60 * 1000,
  gcTime: 5 * 60 * 1000,
});

export const calendarConnectionsQuery = queryOptions({
  queryKey: qk.calendarConnections(),
  queryFn: () => getConnections(),
  staleTime: 30 * 1000,
});

export const agendaQuery = (from: Date, to: Date) =>
  queryOptions({
    queryKey: qk.agenda(from.toISOString(), to.toISOString()),
    queryFn: () => getAgenda(from, to),
    staleTime: 60 * 1000,
    enabled: !!from && !!to,
  });

export const documentsQuery = queryOptions({
  queryKey: qk.documents(),
  queryFn: () => listDocuments(),
  staleTime: 30 * 1000,
});

export const documentQuery = (id: string) =>
  queryOptions({
    queryKey: qk.document(id),
    queryFn: () => getDocument(id),
    staleTime: 10 * 1000,
    enabled: !!id,
  });

export const documentVersionsQuery = (id: string) =>
  queryOptions({
    queryKey: qk.documentVersions(id),
    queryFn: () => listVersions(id),
    staleTime: 30 * 1000,
    enabled: !!id,
  });

export const notificationsQuery = queryOptions({
  queryKey: qk.notifications(),
  queryFn: () => fetchNotifications(),
  staleTime: 30 * 1000,
  refetchInterval: 60 * 1000,
});

export const availabilitiesQuery = queryOptions({
  queryKey: qk.bookingAvailabilities(),
  queryFn: () => listAvailabilities(),
  staleTime: 60 * 1000,
});

export const pagesQuery = queryOptions({
  queryKey: qk.bookingPages(),
  queryFn: () => listPages(),
  staleTime: 60 * 1000,
});

export const meetingTypesQuery = queryOptions({
  queryKey: qk.bookingMeetingTypes(),
  queryFn: () => listMeetingTypes(),
  staleTime: 60 * 1000,
});

export const bookingsQuery = (scope: "upcoming" | "past") =>
  queryOptions({
    queryKey: qk.bookings(scope),
    queryFn: () => listBookings(scope),
    staleTime: 30 * 1000,
  });

export const publicPageQuery = (slug: string) =>
  queryOptions({
    queryKey: qk.publicPage(slug),
    queryFn: () => getPublicPage(slug),
    staleTime: 5 * 60 * 1000,
    enabled: !!slug,
  });

export const adminQuery = <T,>(path: string) =>
  queryOptions({
    queryKey: qk.admin(path),
    queryFn: () => adminGet<T>(path),
    staleTime: 15 * 1000,
    enabled: !!path,
  });

export const publicSlotsQuery = (slug: string, typeId: string, from: string, days: number, tz: string) =>
  queryOptions({
    queryKey: qk.publicSlots(slug, typeId, from, days, tz),
    queryFn: () => publicSlots(slug, typeId, from, days, tz),
    staleTime: 15 * 1000,
    enabled: !!slug && !!typeId && !!from && !!tz,
  });

export const guestBookingQuery = (token: string) =>
  queryOptions({
    queryKey: qk.guestBooking(token),
    queryFn: () => getGuestBooking(token),
    staleTime: 15 * 1000,
    enabled: !!token,
  });

export const guestSlotsQuery = (token: string, from: string, days: number, tz: string) =>
  queryOptions({
    queryKey: qk.guestSlots(token, from, days, tz),
    queryFn: () => guestSlots(token, from, days, tz),
    staleTime: 15 * 1000,
    enabled: !!token && !!from && !!tz,
  });
