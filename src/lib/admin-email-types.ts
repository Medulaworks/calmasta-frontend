export type EmailCategory = "auth" | "insights" | "billing" | "admin";

export interface EmailSystemFields {
  hasOtp: boolean;
  hasCtaUrl: boolean;
  hasExpirationNotice: boolean;
  fixedClauses: string[];
}

export interface EmailTemplateDto {
  id: string;
  category: EmailCategory;
  label: string;
  description: string;
  subject: string;
  greeting: string | null;
  paragraphs: string[];
  ctaLabel: string | null;
  footerNote: string | null;
  systemFields: EmailSystemFields;
  isCustomized: boolean;
  updatedAt: string;
  updatedBy: string | null;
}

export interface EmailTemplateListResponse {
  items: EmailTemplateDto[];
}

export interface EmailTemplateDetailResponse extends EmailTemplateDto {
  defaultTemplate: {
    subject: string;
    greeting: string | null;
    paragraphs: string[];
    ctaLabel: string | null;
    footerNote: string | null;
  };
}

export interface EmailTemplatePreviewResponse {
  subject: string;
  html: string;
  text: string;
}

export interface EmailTemplateUpdatePayload {
  subject?: string;
  greeting?: string | null;
  paragraphs?: string[];
  ctaLabel?: string | null;
  footerNote?: string | null;
  reason?: string;
}
