export interface LibraryResult {
  kind: "document" | "recording" | "meeting";
  id: string;
  title: string;
  href: string;
  source?: string;
  state?: string;
  status: string;
  failureReason: string | null;
  editedByUser?: boolean;
  template?: string;
  at: string;
  snippet: string | null;
}

export interface LibraryQuery {
  q: string;
  type: string;
  status: string;
  from: string;
  to: string;
}

export const EMPTY_QUERY: LibraryQuery = { q: "", type: "all", status: "all", from: "", to: "" };

/** True when the user is searching or filtering (rather than just browsing the two lists). */
export const isSearching = (f: LibraryQuery) => f.q.trim().length > 0 || f.type !== "all" || f.status !== "all" || !!f.from || !!f.to;

export async function searchLibrary(f: LibraryQuery, signal?: AbortSignal, limit?: number): Promise<LibraryResult[]> {
  const p = new URLSearchParams();
  if (f.q.trim()) p.set("q", f.q.trim());
  if (f.type !== "all") p.set("type", f.type);
  if (f.status !== "all") p.set("status", f.status);
  if (f.from) p.set("from", f.from);
  if (f.to) p.set("to", f.to);
  if (limit) p.set("limit", String(limit));
  const res = await fetch(`/api/library/search?${p}`, { signal });
  const body = (await res.json().catch(() => ({}))) as { results?: LibraryResult[]; error?: string };
  if (!res.ok) throw new Error(body.error ?? "Could not search your library.");
  return body.results ?? [];
}
