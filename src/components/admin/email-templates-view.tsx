"use client";

import { useEffect, useState } from "react";
import { Check, Eye, Lock, Pencil, RotateCcw, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { adminPatch, adminPost, fmtUtc } from "@/lib/admin-client";
import { useToasts } from "@/components/ui/toast";
import { ActionDialog, ResourceBoundary, useResource } from "./ui";
import type {
  EmailCategory,
  EmailTemplateDto,
  EmailTemplateListResponse,
  EmailTemplateUpdatePayload,
} from "@/lib/admin-email-types";

const CATEGORY_LABELS: Record<EmailCategory, string> = {
  auth: "Account & Auth",
  insights: "Recordings & Recap",
  billing: "Billing & Minutes",
  admin: "Admin & Staff",
};

const key = () => crypto.randomUUID().replace(/-/g, "").slice(0, 16);

export function EmailTemplatesView() {
  const res = useResource<EmailTemplateListResponse>("/api/admin/settings/emails");
  const toasts = useToasts("email-templates");

  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<string>("verify_email");

  // Form edit states
  const [subject, setSubject] = useState("");
  const [greeting, setGreeting] = useState("");
  const [paragraphsText, setParagraphsText] = useState("");
  const [ctaLabel, setCtaLabel] = useState("");
  const [footerNote, setFooterNote] = useState("");
  const [saving, setSaving] = useState(false);

  // Dialog states
  const [confirmReset, setConfirmReset] = useState(false);
  const [testSendDialog, setTestSendDialog] = useState(false);

  const templates: EmailTemplateDto[] = res.data?.items ?? [];
  const selected: EmailTemplateDto | undefined =
    templates.find((t) => t.id === selectedId) ?? templates[0];

  // Sync form state when selection changes or data loads
  useEffect(() => {
    if (selected) {
      setSubject(selected.subject);
      setGreeting(selected.greeting ?? "");
      setParagraphsText(selected.paragraphs.join("\n\n"));
      setCtaLabel(selected.ctaLabel ?? "");
      setFooterNote(selected.footerNote ?? "");
    }
  }, [selected?.id, selected?.updatedAt]);

  const filtered = templates.filter((t) =>
    activeCategory === "all" ? true : t.category === activeCategory,
  );

  const paragraphsList = paragraphsText
    .split("\n\n")
    .map((p) => p.trim())
    .filter(Boolean);

  const handleSave = async () => {
    if (!selected) return;
    if (subject.trim().length < 3) {
      toasts.push({ tone: "danger", message: "Subject must be at least 3 characters." });
      return;
    }
    if (paragraphsList.length === 0) {
      toasts.push({ tone: "danger", message: "At least one paragraph is required." });
      return;
    }

    setSaving(true);
    try {
      const payload: EmailTemplateUpdatePayload = {
        subject: subject.trim(),
        greeting: greeting.trim() || null,
        paragraphs: paragraphsList,
        ctaLabel: ctaLabel.trim() || null,
        footerNote: footerNote.trim() || null,
      };

      await adminPatch(
        `/api/admin/settings/emails/${selected.id}`,
        payload,
        { "Idempotency-Key": key() },
      );

      toasts.push({ tone: "success", message: `Saved changes to "${selected.label}".` });
      res.reload();
    } catch (err: any) {
      toasts.push({
        tone: "danger",
        message: err?.message || "Failed to save template changes.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async (reason?: string) => {
    if (!selected) return;
    try {
      await adminPost(`/api/admin/settings/emails/${selected.id}/reset`, { reason });
      toasts.push({ tone: "success", message: `Reset "${selected.label}" to system defaults.` });
      setConfirmReset(false);
      res.reload();
    } catch (err: any) {
      toasts.push({
        tone: "danger",
        message: err?.message || "Failed to reset template.",
      });
    }
  };

  const handleTestSend = async (recipientEmail?: string) => {
    if (!selected) return;
    try {
      await adminPost(`/api/admin/settings/emails/${selected.id}/test-send`, {
        recipientEmail: recipientEmail?.trim() || undefined,
      });
      toasts.push({
        tone: "success",
        message: `Diagnostic test email sent for "${selected.label}". Check your inbox.`,
      });
      setTestSendDialog(false);
    } catch (err: any) {
      toasts.push({
        tone: "danger",
        message: err?.message || "Failed to dispatch test email.",
      });
    }
  };

  return (
    <ResourceBoundary resource={res}>
      {(data: EmailTemplateListResponse) => {
        const current: EmailTemplateDto =
          data.items.find((t) => t.id === selectedId) ?? data.items[0];

        return (
          <div className="space-y-6">
            {/* Category Filter Pills */}
            <div className="flex flex-wrap items-center gap-2 border-b border-border pb-4">
              <button
                type="button"
                onClick={() => setActiveCategory("all")}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  activeCategory === "all"
                    ? "bg-accent text-background shadow-sm"
                    : "text-muted hover:bg-surface hover:text-foreground"
                }`}
              >
                All Emails ({data.items.length})
              </button>
              {(["auth", "insights", "billing", "admin"] as EmailCategory[]).map((cat) => {
                const count = data.items.filter((i) => i.category === cat).length;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setActiveCategory(cat)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                      activeCategory === cat
                        ? "bg-accent text-background shadow-sm"
                        : "text-muted hover:bg-surface hover:text-foreground"
                    }`}
                  >
                    {CATEGORY_LABELS[cat]} ({count})
                  </button>
                );
              })}
            </div>

            {/* Master-Detail Layout */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              {/* Left Column: Email List */}
              <div className="space-y-2 lg:col-span-4">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted">
                  Transactional Emails
                </div>
                <div className="space-y-1.5 max-h-[750px] overflow-y-auto pr-1 [scrollbar-width:thin]">
                  {filtered.map((item) => {
                    const isSelected = item.id === (current?.id ?? selectedId);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSelectedId(item.id)}
                        className={`w-full rounded-xl border p-3.5 text-left transition-all ${
                          isSelected
                            ? "border-accent/40 bg-accent/5 ring-1 ring-accent/30 shadow-sm"
                            : "border-border bg-background hover:bg-surface"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className={`text-sm font-semibold ${isSelected ? "text-accent" : "text-foreground"}`}>
                            {item.label}
                          </span>
                          <span className="shrink-0">
                            {item.isCustomized ? (
                              <Badge tone="success">Custom</Badge>
                            ) : (
                              <Badge tone="neutral">Default</Badge>
                            )}
                          </span>
                        </div>
                        <p className="mt-1 line-clamp-2 text-xs text-muted">
                          {item.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Right Column: Editor & Live Preview */}
              {current && (
                <div className="space-y-6 lg:col-span-8">
                  {/* Security Boundary Notice */}
                  <div className="flex items-start gap-3 rounded-xl border border-sky-500/20 bg-sky-500/5 p-4 text-xs text-foreground">
                    <Lock className="size-4 shrink-0 text-sky-500 mt-0.5" />
                    <div className="space-y-1">
                      <div className="font-semibold text-sky-600 dark:text-sky-400">
                        Dynamic Security Elements Locked
                      </div>
                      <p className="text-muted leading-relaxed">
                        OTPs, single-use action tokens, expiration windows, and system links are cryptographically generated and enforced by the backend at dispatch time. Only static text, subjects, and button labels can be customized here.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                    {/* Left Sub-Column: Edit Form */}
                    <Card className="space-y-4 p-5">
                      <div className="flex items-center justify-between border-b border-border pb-3">
                        <div className="flex items-center gap-2">
                          <Pencil className="size-4 text-accent" />
                          <h3 className="text-sm font-semibold text-foreground">Static Copy Editor</h3>
                        </div>
                        <span className="text-xs text-muted">
                          {current.isCustomized ? `Modified ${fmtUtc(current.updatedAt)}` : "Factory Default"}
                        </span>
                      </div>

                      {/* Subject Line */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <label htmlFor="tpl-subject" className="font-medium text-foreground">
                            Subject Line <span className="text-danger">*</span>
                          </label>
                          <span className="text-muted">{subject.length}/200</span>
                        </div>
                        <input
                          id="tpl-subject"
                          type="text"
                          value={subject}
                          maxLength={200}
                          onChange={(e) => setSubject(e.target.value)}
                          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
                          placeholder="Email subject line"
                        />
                      </div>

                      {/* Greeting (Optional) */}
                      <div className="space-y-1.5">
                        <label htmlFor="tpl-greeting" className="block text-xs font-medium text-foreground">
                          Greeting (Optional)
                        </label>
                        <input
                          id="tpl-greeting"
                          type="text"
                          value={greeting}
                          maxLength={100}
                          onChange={(e) => setGreeting(e.target.value)}
                          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
                          placeholder="e.g. Hello, or Welcome aboard,"
                        />
                      </div>

                      {/* Paragraphs */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <label htmlFor="tpl-paragraphs" className="font-medium text-foreground">
                            Body Paragraphs <span className="text-danger">*</span>
                          </label>
                          <span className="text-muted">Double enter separates paragraphs</span>
                        </div>
                        <textarea
                          id="tpl-paragraphs"
                          rows={5}
                          value={paragraphsText}
                          onChange={(e) => setParagraphsText(e.target.value)}
                          className="w-full rounded-lg border border-border bg-background p-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
                          placeholder="Enter paragraph text..."
                        />
                      </div>

                      {/* CTA Button Label */}
                      {current.systemFields.hasCtaUrl && (
                        <div className="space-y-1.5">
                          <label htmlFor="tpl-cta" className="block text-xs font-medium text-foreground">
                            Call-to-Action Button Label
                          </label>
                          <input
                            id="tpl-cta"
                            type="text"
                            value={ctaLabel}
                            maxLength={60}
                            onChange={(e) => setCtaLabel(e.target.value)}
                            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
                            placeholder="e.g. Verify email"
                          />
                        </div>
                      )}

                      {/* Footer Note */}
                      <div className="space-y-1.5">
                        <label htmlFor="tpl-footer" className="block text-xs font-medium text-foreground">
                          Footer Note (Optional)
                        </label>
                        <input
                          id="tpl-footer"
                          type="text"
                          value={footerNote}
                          maxLength={300}
                          onChange={(e) => setFooterNote(e.target.value)}
                          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
                          placeholder="e.g. If you have questions about this change, contact support."
                        />
                      </div>

                      {/* Action Buttons */}
                      <div className="flex flex-wrap items-center gap-2 pt-2">
                        <Button
                          variant="primary"
                          size="sm"
                          disabled={saving}
                          onClick={handleSave}
                          className="flex items-center gap-1.5"
                        >
                          <Check className="size-3.5" />
                          {saving ? "Saving…" : "Save Changes"}
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={saving}
                          onClick={() => setTestSendDialog(true)}
                          className="flex items-center gap-1.5"
                        >
                          <Send className="size-3.5" />
                          Send Test Email
                        </Button>

                        {current.isCustomized && (
                          <Button
                            variant="danger"
                            size="sm"
                            disabled={saving}
                            onClick={() => setConfirmReset(true)}
                            className="flex items-center gap-1.5 ml-auto"
                          >
                            <RotateCcw className="size-3.5" />
                            Reset Defaults
                          </Button>
                        )}
                      </div>
                    </Card>

                    {/* Right Sub-Column: Live Email Frame Preview */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-xs text-muted">
                        <span className="flex items-center gap-1.5 font-medium text-foreground">
                          <Eye className="size-4 text-accent" />
                          Live Email Frame Preview
                        </span>
                        <span>Responsive HTML Card</span>
                      </div>

                      {/* Frame Container */}
                      <div className="overflow-hidden rounded-xl border border-border bg-[#F9FAFB] p-5 shadow-sm">
                        {/* Joobah Branded Email Box */}
                        <div className="mx-auto max-w-[480px] overflow-hidden rounded-xl border border-[#E5E7EB] bg-white shadow-sm text-left">
                          {/* Top Accent Gradient Bar */}
                          <div className="h-1 bg-gradient-to-r from-[#511533] to-[#F2AE50]" />

                          {/* Email Body */}
                          <div className="p-6 space-y-4">
                            {/* Joobah Header */}
                            <div className="text-base font-bold text-[#111827]">
                              Joobah
                            </div>

                            {/* Greeting */}
                            {greeting.trim() && (
                              <p className="text-xs font-semibold text-[#111827]">
                                {greeting.trim()}
                              </p>
                            )}

                            {/* Paragraphs */}
                            {paragraphsList.map((p: string, idx: number) => (
                              <p key={idx} className="text-xs leading-relaxed text-[#374151]">
                                {p}
                              </p>
                            ))}

                            {/* Dynamic OTP Callout (If applicable) */}
                            {current.systemFields.hasOtp && (
                              <div className="rounded-lg border border-dashed border-[#F2AE50] bg-amber-50/50 p-3 text-center">
                                <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-700">
                                  System Dynamic Security Code
                                </span>
                                <div className="mt-1 font-mono text-xl font-bold tracking-widest text-[#511533]">
                                  123456
                                </div>
                              </div>
                            )}

                            {/* Dynamic Locked Clauses */}
                            {current.systemFields.fixedClauses.length > 0 && (
                              <div className="space-y-1 rounded-lg bg-gray-50 p-2.5 text-[11px] text-gray-500">
                                {current.systemFields.fixedClauses.map((clause: string, cIdx: number) => (
                                  <div key={cIdx} className="flex items-center gap-1.5">
                                    <Lock className="size-3 text-gray-400 shrink-0" />
                                    <span>{clause.replace("[6-Digit Code]", "123456")}</span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* CTA Button */}
                            {current.systemFields.hasCtaUrl && (
                              <div className="pt-2">
                                <span className="inline-block rounded-lg bg-[#511533] px-5 py-2 text-xs font-medium text-white shadow-sm">
                                  {ctaLabel.trim() || "Action Button"}
                                </span>
                              </div>
                            )}

                            {/* Divider & Signature */}
                            <div className="pt-4">
                              <div className="h-0.5 w-6 rounded bg-[#F2AE50] mb-2" />
                              <div className="text-xs font-medium text-[#111827]">
                                The Joobah Team
                              </div>
                              {footerNote.trim() && (
                                <p className="mt-2 text-[11px] text-[#6B7280]">
                                  {footerNote.trim()}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Email Footer Notice */}
                          <div className="border-t border-[#F3F4F6] bg-[#FAFAFA] p-3 text-center text-[10px] text-[#9CA3AF]">
                            Sent by Joobah • Secure and professional
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Reset Confirmation Dialog */}
            {confirmReset && (
              <ActionDialog
                title="Reset email template"
                description={`Are you sure you want to revert "${selected?.label}" back to system factory defaults? Any customized static copy will be replaced.`}
                confirmLabel="Reset to defaults"
                danger
                onClose={() => setConfirmReset(false)}
                onSubmit={async (v) => handleReset(v.reason)}
              />
            )}

            {/* Test Send Dialog */}
            {testSendDialog && (
              <ActionDialog
                title="Send test preview email"
                description={`Sends a diagnostic email for "${selected?.label}" with sample dynamic data directly to verify inbox formatting.`}
                confirmLabel="Send test email"
                fields={[
                  {
                    name: "recipientEmail",
                    label: "Recipient email",
                    type: "email",
                    autoComplete: "email",
                    required: false,
                    hint: "Leave empty to send to your staff email",
                  },
                ]}
                hideReason
                onClose={() => setTestSendDialog(false)}
                onSubmit={async (v) => handleTestSend(v.recipientEmail)}
              />
            )}
          </div>
        );
      }}
    </ResourceBoundary>
  );
}
