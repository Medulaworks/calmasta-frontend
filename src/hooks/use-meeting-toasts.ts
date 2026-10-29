"use client";

import { useEffect, useRef } from "react";
import { type MeetingPhase, meetingPhase, phaseToast } from "@/lib/meeting-phase";
import type { ToastInput } from "@/components/ui/toast";

interface CaptureLike { id: string; title: string | null; source: string; state: string; status: string }

/**
 * Watches a list of captures as it refreshes and raises a toast whenever a meeting moves to a new stage (joining,
 * waiting to be let in, recording, ended, ready, declined...). The first list it sees is not news, so it stays quiet.
 */
export function useMeetingToasts(captures: CaptureLike[] | null, push: (toast: ToastInput) => void) {
  const seen = useRef<Map<string, MeetingPhase | null> | null>(null);
  useEffect(() => {
    if (!captures) return;
    const now = new Map(captures.map((c) => [c.id, meetingPhase(c)] as const));
    const before = seen.current;
    seen.current = now;
    if (!before) return;
    for (const c of captures) {
      const phase = now.get(c.id);
      if (!phase) continue;
      const toast = phaseToast(before.has(c.id) ? before.get(c.id) : undefined, phase, c.title ?? "Meeting", c.id);
      if (toast) push(toast);
    }
  }, [captures, push]);
}
