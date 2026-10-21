import { ApiError } from "./upload-client";

export interface DocumentView {
  id: string;
  captureId: string | null;
  sourceTitle: string | null;
  template: string;
  title: string;
  contentHtml: string;
  status: "generating" | "ready" | "failed";
  failureReason: string | null;
  editedByUser: boolean;
  version: number;
  provider: string | null;
  model: string | null;
  /** While a single-section rewrite runs: which section. */
  rewritingSection: string | null;
}

export interface DocumentListItem {
  id: string;
  title: string;
  template: string;
  status: string;
  failureReason: string | null;
  editedByUser: boolean;
  updatedAt: string;
}

export interface VersionItem {
  version: number;
  origin: "ai_generated" | "user_edit" | "ai_regenerated_section";
  createdAt: string;
}

export const TEMPLATE_CHOICES = [
  { id: "clean_notes", label: "Clean notes" },
  { id: "summary_and_actions", label: "Summary and action items" },
  { id: "consultant_brief", label: "Consultant / client brief" },
  { id: "project_brief", label: "Project / product brief" },
  { id: "meeting_minutes", label: "Meeting minutes" },
  { id: "follow_up_email", label: "Follow-up email (draft)" },
  { id: "content_draft", label: "Content draft" },
] as const;

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (res.status === 204) return undefined as T;
  const body = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
  if (!res.ok) {
    const message =
      res.status === 401
        ? "You're not signed in. Sign-in isn't set up yet; for local development set DEV_AUTH_EMAIL."
        : (body.error ?? "Something went wrong. Please try again.");
    throw new DocError(res.status, message, body.code);
  }
  return body as T;
}

export class DocError extends ApiError {
  constructor(
    status: number,
    message: string,
    readonly code?: string,
  ) {
    super(status, message);
  }
}

const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export const createDocument = (captureId: string, template: string) =>
  api<{ documentId: string; duplicate: boolean }>(`/api/captures/${captureId}/documents`, json("POST", { template }));
export const listDocuments = () => api<{ documents: DocumentListItem[] }>("/api/documents").then((r) => r.documents);
export const getDocument = (id: string) => api<DocumentView>(`/api/documents/${id}`);
export const saveDocument = (id: string, body: { baseVersion: number; contentHtml?: string; title?: string }) =>
  api<{ version: number; unchanged: boolean }>(`/api/documents/${id}`, json("PATCH", body));
export const regenerateDocument = (id: string, overwrite: boolean) =>
  api<{ status: string }>(`/api/documents/${id}/regenerate`, json("POST", { overwrite }));
export const listVersions = (id: string) => api<{ versions: VersionItem[] }>(`/api/documents/${id}/versions`).then((r) => r.versions);
export const restoreVersion = (id: string, version: number) =>
  api<{ version: number }>(`/api/documents/${id}/versions/${version}/restore`, { method: "POST" });
export const deleteDocument = (id: string) => api<void>(`/api/documents/${id}`, { method: "DELETE" });

export const templateLabel = (id: string) => TEMPLATE_CHOICES.find((t) => t.id === id)?.label ?? "Document";

/** Rewrites one section. Throws DocError code "section_has_edits" unless `overwrite` is true. */
export async function regenerateSection(id: string, input: { heading: string; occurrence: number; baseVersion: number; overwrite: boolean }) {
  const res = await fetch(`/api/documents/${id}/regenerate-section`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
    throw new DocError(res.status, body.error ?? "Could not start the rewrite.", body.code);
  }
}
