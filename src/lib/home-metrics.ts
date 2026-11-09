import { type LibraryResult, searchLibraryPage } from "./library-client";
import { type DayWindow, inWindow } from "./home-period";
import { addDays, dayKey } from "./tz";

export interface WindowSummary {
  meetings: number;
  recordings: number;
  documents: number;
  /** Minutes of audio transcribed, or null when none of the items said how long they were. */
  minutes: number | null;
}

type Row = Pick<LibraryResult, "kind" | "state" | "status" | "at" | "failureReason"> & { durationSeconds?: number | null };

const FINISHED = new Set(["completed", "ready_to_review", "ready"]);
const finished = (r: Row) => FINISHED.has(r.state ?? "") || FINISHED.has(r.status);

/** Counts what was finished inside a window of days (in the person's own time zone). Failed and unfinished items are not counted. */
export function summarise(rows: readonly Row[], w: DayWindow, tz: string): WindowSummary {
  const out: WindowSummary = { meetings: 0, recordings: 0, documents: 0, minutes: null };
  let seconds = 0;
  let known = false;
  for (const r of rows) {
    if (!inWindow(dayKey(r.at, tz), w)) continue;
    if (r.kind === "document") {
      if (!r.failureReason) out.documents++;
      continue;
    }
    if (!finished(r)) continue;
    if (r.kind === "meeting") out.meetings++;
    else out.recordings++;
    if (typeof r.durationSeconds === "number" && r.durationSeconds > 0) {
      seconds += r.durationSeconds;
      known = true;
    }
  }
  if (known) out.minutes = Math.round(seconds / 60);
  return out;
}

const PAGE = 100;
const CAP = 600;

/**
 * Everything the library has for a window, page by page (stopping at a safe limit). It asks for a day either side, then
 * `summarise` keeps exactly the days wanted, so it works whichever way the server reads the dates.
 */
export async function fetchWindowRows(w: DayWindow, signal?: AbortSignal): Promise<{ rows: Row[]; truncated: boolean }> {
  const rows: Row[] = [];
  let cursor: string | undefined;
  do {
    const page = await searchLibraryPage({ q: "", type: "all", status: "all", from: addDays(w.from, -1), to: addDays(w.to, 1) }, signal, cursor, PAGE);
    rows.push(...(page.results as Row[]));
    cursor = page.nextCursor ?? undefined;
  } while (cursor && rows.length < CAP);
  return { rows, truncated: !!cursor };
}
