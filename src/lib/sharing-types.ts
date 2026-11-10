export type SharingMode = "restricted" | "anyone_with_link";

export interface SharePublication {
  id: string;
  captureId: string;
  version: number;
  displayTitle: string | null;
  insightIds: string[];
  includeTranscript: boolean;
  mode: SharingMode;
  createdAt: string;
  publishedAt: string | null;
}

export interface ShareGrant {
  id: string;
  email: string;
  publicationId: string;
  createdAt: string;
  revokedAt: string | null;
}

export interface ShareLink {
  id: string;
  publicationId: string;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export interface SharingState {
  version: number;
  publication: SharePublication | null;
  grants: ShareGrant[];
  link: ShareLink | null;
  /** True when a fresh token URL is available in this response only (once-only). */
  linkUrl?: string | null;
  alreadyIssued?: boolean;
}

export interface PublicNotes {
  publicationVersion: number;
  title: string | null;
  publishedAt: string;
  notes: Array<{ kind: string; templateLabel: string; content: string }>;
  transcript?: { text: string; speakerLabels?: string } | null;
}

export interface SharedNotesView extends PublicNotes {
  grantId: string;
  expiresAt: string | null;
}
