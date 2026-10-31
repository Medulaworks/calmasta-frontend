"use client";
import { useEffect, useRef } from "react";
import { createMeetingToastTracker, type MeetingSnapshot } from "@/lib/meeting-phase";
import type { ToastInput } from "@/components/ui/toast";

export function useMeetingToasts(captures: MeetingSnapshot[] | null, push: (toast: ToastInput) => void, scope = "list") {
  const tracker = useRef<{ scope: string; update: ReturnType<typeof createMeetingToastTracker> } | null>(null);
  useEffect(() => {
    if (!tracker.current || tracker.current.scope !== scope) tracker.current = { scope, update: createMeetingToastTracker() };
    for (const toast of tracker.current.update(captures)) push(toast);
  }, [captures, push, scope]);
}
