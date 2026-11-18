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
import { getEffectivePolicy, getCatalog, getPolicyHistory } from "./product-policy-client";
import { getCaptureOperational, getCaptureEvents, getCaptureCosts, getCustomerActivity, listCaptures as listAdminCaptures } from "./capture-admin-client";
import { getSharing, getPublicNotes, getSharedNotes } from "./sharing-client";
import { getCapturePreferences } from "./capture-preferences-client";

// hierarchical keys
export const qk = {
  profile: () => ["profile"] as const,
  capturePolicy: () => ["capturePolicy"] as const,
  productPolicy: () => ["admin", "productPolicy"] as const,
  productCatalog: () => ["admin", "productCatalog"] as const,
  productHistory: (limit?: number, cursor?: number) => ["admin", "productHistory", limit, cursor] as const,
  adminCaptures: (params: Record<string, unknown>) => ["admin", "captures", params] as const,
  adminCapture: (id: string) => ["admin", "capture", id] as const,
  adminEvents: (id: string) => ["admin", "events", id] as const,
  adminCosts: (id: string) => ["admin", "costs", id] as const,
  adminActivity: (customerId: string) => ["admin", "activity", customerId] as const,
  sharing: (captureId: string) => ["sharing", captureId] as const,
  publicNotes: (token: string) => ["publicNotes", token] as const,
  sharedNotes: (grantId: string) => ["sharedNotes", grantId] as const,
  capturePreferences: () => ["capturePreferences"] as const,
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
  staleTime: 0,
  refetchInterval:15000,
  refetchOnWindowFocus:true,
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

// FE-CP-01 — capability-aware, abortable, 503-aware queries with bounded retry.

export const productPolicyQuery = queryOptions({
  queryKey: qk.productPolicy(),
  queryFn: ({ signal }) => getEffectivePolicy(signal),
  staleTime: 5 * 1000,
  gcTime: 5 * 60 * 1000,
  retry: (count, error) => count < 2 && !(error instanceof ApiError && [401, 403, 404, 409, 503].includes(error.status)),
  retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5000),
});

export const productCatalogQuery = queryOptions({
  queryKey: qk.productCatalog(),
  queryFn: ({ signal }) => getCatalog(signal),
  staleTime: 60 * 1000,
  retry: false,
});

export const policyHistoryQuery = (limit = 25, cursor?: number) =>
  queryOptions({
    queryKey: qk.productHistory(limit, cursor),
    queryFn: ({ signal }) => getPolicyHistory({ limit, cursor, signal }),
    staleTime: 15 * 1000,
  });

export const adminCapturesQuery = (params: Parameters<typeof listAdminCaptures>[0]) =>
  queryOptions({
    queryKey: qk.adminCaptures(params as Record<string, unknown>),
    queryFn: ({ signal }) => listAdminCaptures({ ...params, signal }),
    staleTime: 5 * 1000,
    placeholderData: (prev) => prev,
    retry: (count, error) => count < 2 && !(error instanceof ApiError && [401, 403, 429, 503].includes((error as ApiError).status)),
  });

export const adminCaptureQuery = (id: string) =>
  queryOptions({
    queryKey: qk.adminCapture(id),
    queryFn: ({ signal }) => getCaptureOperational(id, signal),
    staleTime: 5 * 1000,
    enabled: !!id,
    retry: false,
  });

export const adminEventsQuery = (id: string) =>
  queryOptions({
    queryKey: qk.adminEvents(id),
    queryFn: ({ signal }) => getCaptureEvents(id, signal),
    staleTime: 5 * 1000,
    enabled: !!id,
  });

export const adminCostsQuery = (id: string) =>
  queryOptions({
    queryKey: qk.adminCosts(id),
    queryFn: ({ signal }) => getCaptureCosts(id, signal),
    staleTime: 10 * 1000,
    enabled: !!id,
    retry: (count, error) => count < 1 && !(error instanceof ApiError && [401, 403, 404, 503].includes((error as ApiError).status)),
  });

export const adminActivityQuery = (customerId: string) =>
  queryOptions({
    queryKey: qk.adminActivity(customerId),
    queryFn: ({ signal }) => getCustomerActivity(customerId, signal),
    staleTime: 15 * 1000,
    enabled: !!customerId,
  });

export const sharingQuery = (captureId: string) =>
  queryOptions({
    queryKey: qk.sharing(captureId),
    queryFn: ({ signal }) => getSharing(captureId, signal),
    staleTime: 10 * 1000,
    enabled: !!captureId,
    retry: false,
  });

export const publicNotesQuery = (token: string) =>
  queryOptions({
    queryKey: qk.publicNotes(token),
    queryFn: ({ signal }) => getPublicNotes(token, signal),
    staleTime: 60 * 1000,
    enabled: !!token,
    retry: false,
  });

export const sharedNotesQuery = (grantId: string) =>
  queryOptions({
    queryKey: qk.sharedNotes(grantId),
    queryFn: ({ signal }) => getSharedNotes(grantId, signal),
    staleTime: 30 * 1000,
    enabled: !!grantId,
    retry: false,
  });

export const capturePreferencesQueryOpts = queryOptions({
  queryKey: qk.capturePreferences(),
  queryFn: ({ signal }) => getCapturePreferences(signal),
  staleTime: 60 * 1000,
  retry: false,
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
