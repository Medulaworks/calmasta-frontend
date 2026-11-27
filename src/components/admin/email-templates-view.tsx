"use client";

import { useEffect, useState } from "react";
import { Check, Eye, Lock, Pencil, RotateCcw, Send, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { adminPatch, adminPost, fmtUtc } from "@/lib/admin-client";
import { capability } from "@/lib/admin-capabilities";
import { ToastStack, useToasts } from "@/components/ui/toast";
import { ActionDialog, Notice, ResourceBoundary, useResource } from "./ui";
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

export function EmailTemplatesView() {
  const res = useResource<EmailTemplateListResponse>("/api/admin/settings/emails");
  const canEdit = capability("settings_edit").allowed;
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
  const [previewDialog, setPreviewDialog] = useState(false);

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

  useEffect(() => {
    if (!previewDialog) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPreviewDialog(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [previewDialog]);

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
    if (paragraphsList.some((paragraph) => paragraph.length > 2000) || paragraphsList.reduce((sum, paragraph) => sum + paragraph.length, 0) > 10000) {
      toasts.push({ tone: "danger", message: "Keep each paragraph under 2,000 characters and all paragraphs under 10,000 characters." });
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

      await adminPatch(`/api/admin/settings/emails/${selected.id}`, payload);

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
      throw err;
    }
  };

  const handleTestSend = async (recipientEmail: string) => {
    if (!selected) return;
    try {
      await adminPost(`/api/admin/settings/emails/${selected.id}/test-send`, {
        recipientEmail: recipientEmail.trim(),
      });
      toasts.push({
        tone: "success",
        message: `Diagnostic test email sent to ${recipientEmail.trim()}.`,
      });
      setTestSendDialog(false);
    } catch (err: any) {
      toasts.push({
        tone: "danger",
        message: err?.message || "Failed to dispatch test email.",
      });
      throw err;
    }
  };

  return (
    <ResourceBoundary resource={res}>
      {(data: EmailTemplateListResponse) => {
        const current: EmailTemplateDto =
          data.items.find((t) => t.id === selectedId) ?? data.items[0];

        return (
          <div className="space-y-6">
            {!canEdit && <Notice>You have view-only access to email templates. Ask an owner to edit, reset, or send a test email.</Notice>}
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
                <div className="max-h-[750px] space-y-1 overflow-y-auto pr-1 [scrollbar-width:thin]">
                  {filtered.map((item) => {
                    const isSelected = item.id === (current?.id ?? selectedId);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSelectedId(item.id)}
                        className={`w-full rounded-lg border p-2.5 text-left transition-all ${
                          isSelected
                            ? "border-accent/40 bg-accent/5 ring-1 ring-accent/30 shadow-sm"
                            : "border-border bg-background hover:bg-surface"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className={`text-xs font-semibold ${isSelected ? "text-accent" : "text-foreground"}`}>
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
                        <p className="mt-0.5 line-clamp-1 text-[11px] text-muted">
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

                  <div className="space-y-4">
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
                          disabled={!canEdit}
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
                          disabled={!canEdit}
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
                          <span className="text-muted">Double enter separates paragraphs · {paragraphsText.length}/10000</span>
                        </div>
                        <textarea
                          id="tpl-paragraphs"
                          rows={5}
                          value={paragraphsText}
                          disabled={!canEdit}
                          maxLength={10000}
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
                            disabled={!canEdit}
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
                          disabled={!canEdit}
                          maxLength={400}
                          onChange={(e) => setFooterNote(e.target.value)}
                          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
                          placeholder="e.g. If you have questions about this change, contact support."
                        />
                      </div>

                      {/* Action Buttons */}
                      <div className="flex flex-wrap items-center gap-2 pt-2">
                        {canEdit && <Button
                          variant="primary"
                          size="sm"
                          disabled={saving}
                          onClick={handleSave}
                          className="flex items-center gap-1.5"
                        >
                          <Check className="size-3.5" />
                          {saving ? "Saving…" : "Save Changes"}
                        </Button>}

                        {canEdit && <Button
                          variant="ghost"
                          size="sm"
                          disabled={saving}
                          onClick={() => setTestSendDialog(true)}
                          className="flex items-center gap-1.5"
                        >
                          <Send className="size-3.5" />
                          Send Test Email
                        </Button>}

                        {canEdit && current.isCustomized && (
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

                    {/* Preview button occupies its own row below the full-width editor. */}
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => setPreviewDialog(true)}
                        aria-haspopup="dialog"
                      >
                        <Eye className="size-4" />
                        Preview email
                      </Button>
                    </div>
                  </div>

                  {previewDialog && (
                    <div
                      className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-4"
                      onMouseDown={(event) => event.target === event.currentTarget && setPreviewDialog(false)}
                    >
                      <section
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="email-preview-title"
                        className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-border bg-background shadow-2xl"
                      >
                        <header className="flex items-start justify-between gap-4 border-b border-border p-5">
                          <div>
                            <h2 id="email-preview-title" className="text-base font-semibold text-foreground">Live Email Preview</h2>
                            <p className="mt-1 text-sm text-muted">Sample security values are shown for preview only.</p>
                          </div>
                          <Button type="button" variant="ghost" size="sm" onClick={() => setPreviewDialog(false)} aria-label="Close email preview" autoFocus>
                            <X className="size-4" />
                          </Button>
                        </header>

                        <div className="overflow-y-auto bg-[#F9FAFB] p-4 sm:p-6">
                          <div className="mx-auto mb-2 max-w-[600px] truncate text-xs text-[#6B7280]">
                            <span className="font-semibold">Subject:</span> {subject}
                          </div>
                          <div className="mx-auto max-w-[600px] overflow-hidden rounded-xl border border-[#E5E7EB] bg-white text-left shadow-sm">
                            <div className="h-1 bg-gradient-to-r from-[#511533] to-[#F2AE50]" />
                            <div className="space-y-4 p-6">
                              <div className="flex items-center gap-3">
                                <img src="https://app.joobah.com/favicon-48x48.png" width={48} height={48} alt="Joobah logo" className="size-12" />
                                <span className="text-lg font-bold text-[#111827]">Joobah</span>
                              </div>
                              {greeting.trim() && <p className="text-xs font-semibold text-[#111827]">{greeting.trim()}</p>}
                              {paragraphsList.map((paragraph: string, index: number) => (
                                <p key={index} className="text-sm leading-[1.7] text-[#111827]">{paragraph}</p>
                              ))}
                              {current.systemFields.hasOtp && (
                                <div className="rounded-lg border border-dashed border-[#F2AE50] bg-amber-50/50 p-3 text-center">
                                  <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-700">System Dynamic Security Code</span>
                                  <div className="mt-1 font-mono text-xl font-bold tracking-widest text-[#511533]">123456</div>
                                </div>
                              )}
                              {current.systemFields.fixedClauses.length > 0 && (
                                <div className="space-y-1 rounded-lg bg-gray-50 p-2.5 text-[11px] text-gray-500">
                                  {current.systemFields.fixedClauses.map((clause: string, index: number) => (
                                    <div key={index} className="flex items-center gap-1.5">
                                      <Lock className="size-3 shrink-0 text-gray-400" />
                                      <span>{clause.replace("[6-Digit Code]", "123456")}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {current.systemFields.hasCtaUrl && (
                                <div className="pt-2">
                                  <span className="inline-block rounded-lg bg-[#511533] px-5 py-2 text-xs font-medium text-white shadow-sm">{ctaLabel.trim() || "Action Button"}</span>
                                </div>
                              )}
                              <div className="pt-4">
                                <div className="mb-2 h-0.5 w-6 rounded bg-[#F2AE50]" />
                                <div className="text-xs font-medium text-[#111827]">The Joobah Team</div>
                                {footerNote.trim() && <p className="mt-2 text-[11px] text-[#6B7280]">{footerNote.trim()}</p>}
                              </div>
                            </div>
                            <div className="border-t border-[#F3F4F6] bg-[#FAFAFA] p-3 text-center text-[10px] text-[#9CA3AF]">
                              Sent by Joobah • Secure and professional
                            </div>
                          </div>
                        </div>
                      </section>
                    </div>
                  )}
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
                description={`Sends a diagnostic email for "${selected?.label}" with sample dynamic data to the address you enter.`}
                confirmLabel="Send test email"
                fields={[{
                  name: "recipientEmail",
                  label: "Send to email address",
                  type: "email",
                  autoComplete: "email",
                  required: true,
                  hint: "This test contains sample values, not a real OTP or account link.",
                }]}
                hideReason
                onClose={() => setTestSendDialog(false)}
                onSubmit={async (values) => handleTestSend(values.recipientEmail)}
              />
            )}
            <ToastStack items={toasts.items} onDismiss={toasts.dismiss} />
          </div>
        );
      }}
    </ResourceBoundary>
  );
}
