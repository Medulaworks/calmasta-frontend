export interface DashboardItem {
  id: string;
  kind: "recording" | "meeting" | "document";
  title: string;
  /** Raw states; the UI turns them into words with lib/status.ts. */
  source?: string;
  state?: string;
  status: string;
  failureReason: string | null;
  at: string;
  href: string;
  /** google_meet, microsoft_teams or zoom, for meeting captures. */
  platform?: string | null;
}

/** A suggested or confirmed action item, with the conversation it came from. */
export interface DashboardAction {
  id: string;
  text: string;
  status: "suggested" | "confirmed";
  at: string;
  captureId: string;
  captureTitle: string;
  href: string;
}

/** A figure for this month with last month's beside it, so a person can see which way it is going. */
export interface Trend {
  thisMonth: number;
  lastMonth: number;
}

export interface Dashboard {
  stats: { recordingsThisMonth: number; minutesTranscribedThisMonth: number; documents: number | null; inProgress: number };
  inProgress: DashboardItem[];
  needsAttention: DashboardItem[];
  recentRecordings: DashboardItem[];
  recentDocuments: DashboardItem[];
  /** Meetings an assistant joined (or is joining), newest first. */
  recentMeetings: DashboardItem[];
  upcomingMeetings?: null;
  capabilities?: { documents: boolean; actions: boolean; calendar: boolean };
  metrics: {
    meetingsCaptured: Trend;
    minutesTranscribed: Trend;
    documentsCreated: Trend | null;
    /** Waiting for the person to accept or dismiss, and accepted but not yet done. */
    actionItems: { toReview: number; open: number } | null;
  };
  /** The action items most worth a look: those awaiting review first, then open ones. */
  actionItems: DashboardAction[];
  /** For the getting-started checklist. */
  progress: { hasRecording: boolean; hasDocument: boolean | null; hasMeetingCapture: boolean };
}
