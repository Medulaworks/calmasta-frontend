// The server names a capture "Meeting" or "Recording" until something better exists, so a list of them reads as the same row repeated.
// Where the title is only that placeholder, show what the capture was and when, which tells the rows apart and is always true.

const GENERIC = new Set(["", "meeting", "recording", "untitled", "untitled meeting", "untitled recording", "new meeting", "new recording", "voice note", "voice recording", "audio upload"]);

export const isGenericTitle = (title: string | null | undefined) => GENERIC.has((title ?? "").trim().toLowerCase());

/** "29 Oct, 10:15" in the given zone. */
const when = (iso: string, timeZone: string) => new Intl.DateTimeFormat(undefined, { timeZone, day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(new Date(iso));

/** The title to show: the real one, or "Meeting on 29 Oct, 10:15" when it is only the placeholder. */
export function displayTitle(item: { title?: string | null; kind?: string; source?: string; at?: string; createdAt?: string }, timeZone: string): string {
  const title = (item.title ?? "").trim();
  if (!isGenericTitle(title)) return title;
  const at = item.at ?? item.createdAt;
  const label = item.kind === "meeting" || item.source === "meeting" || item.source === "meeting_url" ? "Meeting" : item.kind === "document" ? "Document" : "Recording";
  return at ? `${label} on ${when(at, timeZone)}` : label;
}
