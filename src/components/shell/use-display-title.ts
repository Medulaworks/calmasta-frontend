"use client";

import { useProfile } from "@/components/shell/profile-context";
import { displayTitle } from "@/lib/titles";
import { browserTimeZone } from "@/lib/tz";

/** A function that gives a capture the title to show (a real one, or "Meeting on 29 Oct, 10:15"), in the person's time zone. */
export function useDisplayTitle() {
  const tz = useProfile()?.timezone || browserTimeZone();
  return (item: Parameters<typeof displayTitle>[0]) => displayTitle(item, tz);
}
