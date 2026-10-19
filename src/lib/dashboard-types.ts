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
}

export interface Dashboard {
  stats: { recordingsThisMonth: number; minutesTranscribedThisMonth: number; documents: number; inProgress: number };
  inProgress: DashboardItem[];
  needsAttention: DashboardItem[];
  recentRecordings: DashboardItem[];
  recentDocuments: DashboardItem[];
  /** For the getting-started checklist. */
  progress: { hasRecording: boolean; hasDocument: boolean; hasMeetingCapture: boolean };
}
