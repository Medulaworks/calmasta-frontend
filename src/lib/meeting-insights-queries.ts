import { mutationOptions, type QueryClient } from "@tanstack/react-query";
import { requestMeetingInsight, saveMeetingPreferences, type InsightKind, type MeetingInsights } from "./meeting-insights-client";
import { qk } from "./queries";

export function meetingInsightMutationOptions(qc: QueryClient, id: string, kind: InsightKind) {
  const queryKey = qk.meetingInsights(id);
  return mutationOptions({
    mutationFn: () => requestMeetingInsight(id, kind),
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
        return { ...current, [kind]: {
          ...(previous?.id === receipt.id ? previous : { result: null, emailStatus: "not_requested", updatedAt: "" }),
          ...receipt, transcriptVersion: current.transcriptVersion ?? 0, isStale: false,
        } };
      });
    },
    // Refresh even when a request outcome is uncertain; never replay the POST.
    onSettled: () => qc.invalidateQueries({ queryKey }),
  });
}
export function meetingPreferencesMutationOptions(qc: QueryClient) {
  return mutationOptions({
    mutationFn: saveMeetingPreferences,
    retry: 0,
    onSuccess: data => { qc.setQueryData(qk.meetingPreferences(), data); },
  });
}
