import { api } from "./upload-client";

export type InsightKind = "recap" | "questions";
export type InsightState = "pending" | "queued" | "running" | "ready" | "blocked" | "failed" | "reconciliation_required";
export type EmailStatus = "not_requested" | "pending" | "sending" | "sent" | "unknown" | "skipped";
export interface LegacyRecapResult {
  formatVersion?: 1;
  briefSummary: string;
  detailedSummary: string;
  highlights: string[];
  decisions: string[];
  nextSteps: string[];
}
export interface StructuredRecapResult extends Omit<LegacyRecapResult,"formatVersion"> {
  formatVersion: 2;
  meetingPurpose: string;
  topics: {title:string;points:{text:string;details:string[]}[]}[];
  technicalNotes: string[];
  actionItems: {owner:string|null;task:string;due:string|null}[];
}
export interface TemplateRecapResult {formatVersion:3;templateId:string;templateRevision:number;sections:{id:string;title:string;paragraphs:string[];points:{text:string;details:string[]}[]}[];decisions:string[];actionItems:{owner:string|null;task:string;due:string|null}[];}
export type RecapResult=LegacyRecapResult|StructuredRecapResult|TemplateRecapResult;
export interface SummaryTemplate {id:string;revision:number;label:string;description:string;group:string;sourceKind:"recap"|"questions";appendQuestionAnswers:boolean;enabled:boolean;available?:boolean;}
export interface InsightViewPreferences {selectedTemplateId:string;selfSpeakerIds:string[];speakerOptions:{id:string;label:string}[];enabled:boolean;}
export type SelectedSummaryView={templateId:string;templateRevision:number;sourceKind:"recap";artifact:InsightArtifact<TemplateRecapResult>|null}|{templateId:"q-and-a";templateRevision:number;sourceKind:"questions";artifact:InsightArtifact<QuestionsResult>|null};
export interface MeetingMetadata {title:string;recordedAt:string;recordingPath:string;}
export interface MeetingQuestion {
  id?:string;askerSpeakerId?:string|null;answers?:{text:string;sources:MeetingQuestion["sources"]}[];
  text: string;
  sources: { segmentId: string; startMs: number; endMs: number; speakerId: string | null }[];
}
export interface QuestionsResult {
  formatVersion?:2;
  coverage: "ai_extraction_not_guaranteed_exhaustive" | "partial_ai_extraction";
  questions: MeetingQuestion[];
  rejectedQuestionCount?: number;
  rejectedAnswerCount?: number;
  failedExtractionRequestCount?: number;
  failedAnswerRequestCount?: number;
}
/** UI projection; provider accounting fields deliberately stay out of normal UI. */
export interface InsightArtifact<Result> {
  id: string;
  state: InsightState;
  transcriptVersion: number;
  isStale: boolean;
  result: Result | null;
  failureReason: string | null;
  emailStatus: EmailStatus;
  updatedAt: string;
}
export interface MeetingInsights {
  meeting?: MeetingMetadata;
  templates?:SummaryTemplate[];summary?:SelectedSummaryView;summaryTemplatesEnabled?:boolean;autoQuestionsEnabled?:boolean;viewPreferences?:InsightViewPreferences;activeRecap?:{id:string;templateId:string;state:string}|null;
  captureId: string;
  transcriptVersion: number | null;
  transcriptReady: boolean;
  enabled: boolean;
  liveProcessingEnabled: boolean;
  autoRecapEnabled: boolean;
  questionsOnDemand: boolean;
  recap: InsightArtifact<RecapResult> | null;
  questions: InsightArtifact<QuestionsResult> | null;
}
export interface InsightRequest {
  id: string;
  state: InsightState;
  failureReason: string | null;
  templateId?:string;sourceKind?:"recap"|"questions";
}
export interface MeetingPreferences {
  recapEmailEnabled: boolean;
  emailVerified: boolean;
  canReceiveRecapEmail: boolean;
}
export const getMeetingInsights = (id: string, signal?: AbortSignal,templateId="enhanced") =>
  api<MeetingInsights>(`/api/captures/${encodeURIComponent(id)}/insights${templateId!=="enhanced"?`?template=${encodeURIComponent(templateId)}`:""}`, { signal });
export const requestMeetingInsight = (id: string, kind: InsightKind,templateId="enhanced") =>
  api<InsightRequest>(`/api/captures/${encodeURIComponent(id)}/${kind}${kind==="recap"&&templateId!=="enhanced"?`?template=${encodeURIComponent(templateId)}`:""}`, { method: "POST" });
export const getMeetingPreferences = (signal?: AbortSignal) =>
  api<MeetingPreferences>("/api/account/me/meeting-preferences", { signal });
export const saveMeetingPreferences = (recapEmailEnabled: boolean) =>
  api<MeetingPreferences>("/api/account/me/meeting-preferences", {
    method: "PATCH", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ recapEmailEnabled }),
  });

export interface MeetingQuestionsView {captureId:string;transcriptVersion:number|null;transcriptReady:boolean;enabled:boolean;liveProcessingEnabled:boolean;autoQuestionsEnabled:boolean;artifact:InsightArtifact<QuestionsResult>|null;speakerOptions:{id:string;label:string}[];selfSpeakerIds:string[];}
export const getMeetingQuestions=(id:string,signal?:AbortSignal)=>api<MeetingQuestionsView>(`/api/captures/${encodeURIComponent(id)}/questions`,{signal});
export const saveInsightViewPreferences=(id:string,value:Partial<Pick<InsightViewPreferences,"selectedTemplateId"|"selfSpeakerIds">>)=>api<InsightViewPreferences>(`/api/captures/${encodeURIComponent(id)}/insight-preferences`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(value)});
