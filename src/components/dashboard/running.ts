import type { Dashboard, DashboardItem } from "@/lib/dashboard-types";
import { statusFor } from "./item-row";

/** Everything that is still running: what the server lists as in progress, plus any recent item whose own status says so. */
export function runningItems(d: Dashboard | undefined): DashboardItem[] {
  if (!d) return [];
  const seen = new Set<string>();
  return [...d.inProgress, ...d.recentMeetings, ...d.recentRecordings].filter((i) => {
    const key = `${i.kind}-${i.id}`;
    if (seen.has(key) || (!d.inProgress.includes(i) && !statusFor(i).active)) return false;
    seen.add(key);
    return true;
  });
}

/** Check every few seconds while anything is running (so it can be seen finishing), and stay quiet otherwise. */
export const refetchWhileRunning = (q: { state: { data: Dashboard | undefined } }) => {
  const d = q.state.data;
  return d && (d.stats.inProgress > 0 || runningItems(d).length > 0) ? 4000 : false;
};
