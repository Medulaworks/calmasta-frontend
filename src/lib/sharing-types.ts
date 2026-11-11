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

// Fixtures — safe content only, no media, no participant roster, hash-only tokens.
export const fixtureSharingState: SharingState = {
  version: 3,
  publication: {
    id: "00000000-0000-4000-8000-000000000010",
    captureId: "00000000-0000-4000-8000-000000000011",
    version: 2,
    displayTitle: "Q4 Planning — Shared notes",
    insightIds: ["00000000-0000-4000-8000-000000000020"],
    includeTranscript: true,
    mode: "restricted",
    createdAt: "2026-11-10T12:00:00.000Z",
    publishedAt: "2026-11-10T12:00:00.000Z",
  },
  grants: [
    {
      id: "00000000-0000-4000-8000-000000000030",
      email: "recipient@example.com",
      publicationId: "00000000-0000-4000-8000-000000000010",
      createdAt: "2026-11-10T12:00:00.000Z",
      revokedAt: null,
    },
  ],
  link: null,
  linkUrl: null,
  alreadyIssued: false,
};

export const fixturePublicNotes: PublicNotes = {
  publicationVersion: 2,
  title: "Q4 Planning — Shared notes",
  publishedAt: "2026-11-10T12:00:00.000Z",
  notes: [{ kind: "summary", templateLabel: "Executive summary", content: "Safe fixture notes only." }],
  transcript: { text: "Fixture transcript — spoken content bounded to selected notes.", speakerLabels: undefined },
};
