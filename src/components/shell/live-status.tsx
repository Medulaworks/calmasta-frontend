"use client";

import { useQuery } from "@tanstack/react-query";
import { InFlightBanner } from "@/components/dashboard/parts";
import { refetchWhileRunning, runningItems } from "@/components/dashboard/running";
import { dashboardQuery } from "@/lib/queries";

/**
 * The floating "Recording · Meeting" pill, on every page of the app. It shares the dashboard's data (one request, cached), checks
 * every few seconds while something is running, and disappears on its own once the recording or meeting has stopped.
 */
export function LiveStatus() {
  const { data } = useQuery({ ...dashboardQuery, refetchInterval: refetchWhileRunning, retry: false });
  const items = runningItems(data);
  return items.length ? <InFlightBanner items={items} /> : null;
}
