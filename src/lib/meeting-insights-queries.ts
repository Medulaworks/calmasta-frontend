import { mutationOptions, type QueryClient } from "@tanstack/react-query";
import { requestMeetingInsight, saveMeetingPreferences, type InsightKind, type MeetingInsights } from "./meeting-insights-client";
import { qk } from "./queries";

export function meetingInsightMutationOptions(qc: QueryClient, id: string, kind: InsightKind,templateId="enhanced") {
  const queryKey = qk.meetingInsights(id,templateId);
  return mutationOptions({
    mutationFn: () => requestMeetingInsight(id, kind,templateId),
    retry: 0,
    onMutate: async () => {
      await qc.cancelQueries({ queryKey });
      return { version: qc.getQueryData<MeetingInsights>(queryKey)?.transcriptVersion };
    },
    onSuccess: (receipt, _variables, context) => {
      // Use the real admission state while GET refreshes; a 202 never invents a result.
      // Do not overwrite a newer transcript fetched while the POST was in flight.
      qc.setQueryData<MeetingInsights>(queryKey, current => {
        if (!current || current.transcriptVersion !== context?.version) return current;
        const previous = current[kind];
        const next={ ...current, [kind]: {
          ...(previous?.id === receipt.id ? previous : { result: null, emailStatus: "not_requested", updatedAt: "" }),
          ...receipt, transcriptVersion: current.transcriptVersion ?? 0, isStale: false,
        } };
        if(kind==="recap"&&templateId!=="enhanced")next.recap=current.recap;
        if(current.summary?.templateId===templateId&&kind==="recap")return {...next,summary:{...current.summary,artifact:{...(current.summary.artifact?.id===receipt.id?current.summary.artifact:{result:null,emailStatus:"not_requested" as const,updatedAt:""}),...receipt,transcriptVersion:current.transcriptVersion??0,isStale:false}}} as MeetingInsights;
        return next;
      });
    },
    // Refresh even when a request outcome is uncertain; never replay the POST.
    onSettled: () => Promise.all([qc.invalidateQueries({ queryKey:qk.meetingInsights(id) }),qc.invalidateQueries({queryKey:qk.meetingQuestions(id)})]),
  });
}
export function meetingPreferencesMutationOptions(qc: QueryClient) {
  return mutationOptions({
    mutationFn: saveMeetingPreferences,
    retry: 0,
    onSuccess: data => { qc.setQueryData(qk.meetingPreferences(), data); },
  });
}
