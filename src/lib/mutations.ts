import { useMutation, useQueryClient } from "@tanstack/react-query";
import { saveProfile } from "./profile-client";
import { uploadAvatar, removeAvatar } from "./avatar-client";
import {
  uploadAudio,
  requestMeetingCapture,
  cancelMeetingCapture,
  retryMeeting,
  saveTranscript,
  findActions,
  setActionStatus,
  deleteCapture,
} from "./upload-client";
import { saveLibraryTranscript } from "./library-client";
import {
  saveAvailability,
  deleteAvailability,
  savePage,
  deletePage,
  saveMeetingType,
  deleteMeetingType,
  cancelBookingAsHost,
} from "./booking-client";
import { connectDevCalendar, disconnectCalendar } from "./calendar-client";
import {
  createDocument,
  saveDocument,
  regenerateDocument,
  restoreVersion,
  deleteDocument,
  regenerateSection,
} from "./documents-client";
import { markNotificationsRead } from "./notifications-client";
import { adminPost } from "./admin-client";
import { qk } from "./queries";

export function useSaveProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Parameters<typeof saveProfile>[0]) => saveProfile(patch),
    onSuccess: (data) => qc.setQueryData(qk.profile(), data),
    onSettled: () => qc.invalidateQueries({ queryKey: qk.profile() }),
  });
}

export function useUploadAvatar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ blob, version }: { blob: Blob; version: number }) => uploadAvatar(blob, version),
    onSuccess: (data) => qc.setQueryData(qk.profile(), (old: unknown) => (old && typeof old === "object" ? { ...(old as object), ...(data as object) } : old)),
    onSettled: () => qc.invalidateQueries({ queryKey: qk.profile() }),
  });
}

export function useRemoveAvatar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (version: number) => removeAvatar(version),
    onSuccess: (data) => qc.setQueryData(qk.profile(), (old: unknown) => (old && typeof old === "object" ? { ...(old as object), ...(data as object) } : old)),
    onSettled: () => qc.invalidateQueries({ queryKey: qk.profile() }),
  });
}

export function useUploadAudio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      input,
      onProgress,
    }: {
      input: Parameters<typeof uploadAudio>[0];
      onProgress: Parameters<typeof uploadAudio>[1];
    }) => uploadAudio(input, onProgress),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["captures"] });
      qc.invalidateQueries({ queryKey: ["library"] });
      qc.invalidateQueries({ queryKey: qk.usage() });
    },
  });
}

export function useRequestMeeting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { url: string; consent: boolean; title?: string; botName?: string; video: boolean; seconds: number }) =>
      requestMeetingCapture(vars.url, vars.consent, vars.title, vars.video, { maxDurationSeconds: vars.seconds, botName: vars.botName }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["captures"] });
      qc.invalidateQueries({ queryKey: qk.usage() });
    },
  });
}

export function useCancelMeeting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => cancelMeetingCapture(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: qk.capture(id) });
      await qc.cancelQueries({ queryKey: ["captures"] });
      const prevCapture = qc.getQueryData(qk.capture(id));
      const prevCaptures = qc.getQueriesData({ queryKey: ["captures"] });
      // optimistic: mark capture as cancelled
      qc.setQueryData(qk.capture(id), (old: unknown) => {
        if (old && typeof old === "object") return { ...(old as Record<string, unknown>), status: "cancelled", state: "cancelled" };
        return old;
      });
      qc.setQueriesData({ queryKey: ["captures"] }, (old: unknown) => {
        if (Array.isArray(old)) return (old as Array<Record<string, unknown>>).map((c) => (c.id === id ? { ...c, status: "cancelled", state: "cancelled" } : c));
        return old;
      });
      return { prevCapture, prevCaptures };
    },
    onError: (_e, id, ctx) => {
      if (ctx?.prevCapture) qc.setQueryData(qk.capture(id), ctx.prevCapture);
      if (ctx?.prevCaptures) ctx.prevCaptures.forEach(([k, v]) => qc.setQueryData(k, v));
    },
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: qk.capture(id) });
      qc.invalidateQueries({ queryKey: ["captures"] });
    },
  });
}

export function useRetryMeeting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, consent }: { id: string; consent: boolean }) => retryMeeting(id, consent),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["captures"] }),
  });
}

export function useSaveTranscript() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, edit }: { id: string; edit: Parameters<typeof saveTranscript>[1] }) => saveTranscript(id, edit),
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: qk.capture(vars.id) }),
  });
}

export function useSaveLibraryTranscript() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, edit }: { id: string; edit: Parameters<typeof saveLibraryTranscript>[1] }) =>
      saveLibraryTranscript(id, edit),
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: qk.capture(vars.id) }),
  });
}

export function useDeleteCapture() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteCapture(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["captures"] });
      const prev = qc.getQueriesData({ queryKey: ["captures"] });
      qc.setQueriesData({ queryKey: ["captures"] }, (old: unknown) => {
        if (Array.isArray(old)) return (old as Array<Record<string, unknown>>).filter((c) => c.id !== id);
        return old;
      });
      qc.removeQueries({ queryKey: qk.capture(id) });
      return { prev };
    },
    onError: (_e, _id, ctx) => {
      if (ctx?.prev) ctx.prev.forEach(([k, v]) => qc.setQueryData(k, v));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["captures"] });
      qc.invalidateQueries({ queryKey: ["library"] });
    },
  });
}

export function useFindActions() {
  return useMutation({ mutationFn: (id: string) => findActions(id) });
}
export function useSetActionStatus() {
  return useMutation({ mutationFn: ({ id, status }: { id: string; status: Parameters<typeof setActionStatus>[1] }) => setActionStatus(id, status) });
}

// booking
export function useSaveAvailability() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ input, id }: { input: Parameters<typeof saveAvailability>[0]; id?: string }) => saveAvailability(input, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.bookingAvailabilities() }),
  });
}
export function useDeleteAvailability() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteAvailability(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.bookingAvailabilities() }),
  });
}
export function useSavePageM() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ input, id }: { input: Parameters<typeof savePage>[0]; id?: string }) => savePage(input, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.bookingPages() }),
  });
}
export function useDeletePageM() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deletePage(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.bookingPages() }),
  });
}
export function useSaveMeetingType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ input, id }: { input: Parameters<typeof saveMeetingType>[0]; id?: string }) => saveMeetingType(input, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.bookingMeetingTypes() }),
  });
}
export function useDeleteMeetingType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteMeetingType(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.bookingMeetingTypes() }),
  });
}
export function useCancelBookingHost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => cancelBookingAsHost(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["booking"] }),
  });
}

// calendar
export function useConnectCalendar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => connectDevCalendar(),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.calendarConnections() }),
  });
}
export function useDisconnectCalendar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => disconnectCalendar(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.calendarConnections() }),
  });
}

// documents
export function useCreateDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ captureId, template }: { captureId: string; template: string }) => createDocument(captureId, template),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: qk.documents() });
      qc.invalidateQueries({ queryKey: qk.capture(vars.captureId) });
      qc.invalidateQueries({ queryKey: ["captures"] });
    },
  });
}
export function useSaveDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Parameters<typeof saveDocument>[1] }) => saveDocument(id, body),
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: qk.document(v.id) }),
  });
}
export function useRegenerateDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, overwrite }: { id: string; overwrite: boolean }) => regenerateDocument(id, overwrite),
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: qk.document(v.id) }),
  });
}

// notifications
export function useMarkNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => markNotificationsRead(ids),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.notifications() }),
  });
}

// admin
export function useAdminPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ url, body }: { url: string; body: unknown }) => adminPost(url, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin"] }),
  });
}

// documents extra
export function useRestoreVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, version }: { id: string; version: number }) => restoreVersion(id, version),
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: qk.document(v.id) }),
  });
}
export function useDeleteDocumentM() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteDocument(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.documents() }),
  });
}
export function useRegenerateSection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Parameters<typeof regenerateSection>[1] }) => regenerateSection(id, input),
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: qk.document(v.id) }),
  });
}
