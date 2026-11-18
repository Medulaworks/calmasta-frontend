"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { getSharing, createPublication, createLink, revokeLink, createGrant, revokeGrant, sendGrant } from "@/lib/sharing-client";
import { getMeetingInsights } from "@/lib/meeting-insights-client";
import type { SharingState } from "@/lib/sharing-types";
import { ApiError } from "@/lib/upload-client";

interface ReadyInsight {
  id: string;
  label: string;
}

export function ShareNotesDialog({ captureId, open, onClose }: { captureId: string; open: boolean; onClose: () => void }) {
  const [state, setState] = useState<SharingState | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [displayTitle, setDisplayTitle] = useState("");
  const [includeTranscript, setIncludeTranscript] = useState(false);
  const [selectedInsightIds, setSelectedInsightIds] = useState<string[]>([]);
  const [readyInsights, setReadyInsights] = useState<ReadyInsight[]>([]);
  const [hasTranscript, setHasTranscript] = useState(false);
  const [expiryDays, setExpiryDays] = useState<string>("");
  const [linkUrl, setLinkUrl] = useState<string | null>(null);
  const [alreadyIssued, setAlreadyIssued] = useState(false);

  useEffect(() => {
    if (!open) return;
    let active = true;
    Promise.all([
      getSharing(captureId).catch((e) => {
        if (active) setError(e instanceof Error ? e.message : "We couldn’t load sharing. Please try again.");
        return null;
      }),
      getMeetingInsights(captureId).catch(() => null),
    ])
      .then(([sharingData, insightsData]) => {
        if (!active) return;
        if (sharingData) {
          setState(sharingData);
          setDisplayTitle(sharingData.publication?.displayTitle ?? "");
        }
        if (insightsData) {
          const ready: ReadyInsight[] = [];
          if (insightsData.recap && insightsData.recap.state === "ready") {
            ready.push({ id: insightsData.recap.id, label: "Meeting summary & recap" });
          }
          if (insightsData.questions && insightsData.questions.state === "ready") {
            ready.push({ id: insightsData.questions.id, label: "Questions & answers" });
          }
          if (insightsData.summary?.artifact && insightsData.summary.artifact.state === "ready" && !ready.some(r => r.id === insightsData.summary!.artifact!.id)) {
            ready.push({ id: insightsData.summary.artifact.id, label: "Custom template summary" });
          }
          setReadyInsights(ready);
          const transcriptAvailable = !!insightsData.transcriptReady;
          setHasTranscript(transcriptAvailable);
          // Pre-select ready insights, or transcript if no insights are available yet
          if (ready.length > 0) {
            setSelectedInsightIds(ready.map((r) => r.id));
          } else if (transcriptAvailable) {
            setIncludeTranscript(true);
          }
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [captureId, open]);

  if (!open) return null;

  const version = state?.version ?? 0;
  const publicationId = state?.publication?.id;
  const caps = state?.capabilities;
  const publicLinksAllowed = caps?.publicLinksEnabled ?? false;
  const recipientGrantsAllowed = caps?.recipientGrantsEnabled ?? false;
  const invitationsAllowed = caps?.invitationsEnabled ?? false;
  const maxExpiry = caps?.maxExpiryDays ?? null;
  const sharingDisabledByPolicy = caps ? (!caps.publicLinksEnabled && !caps.recipientGrantsEnabled) : false;
  const hasSelectedContent = includeTranscript || selectedInsightIds.length > 0;

  function toggleInsight(id: string) {
    setSelectedInsightIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  }

  async function publish() {
    setError(null);
    setSubmitting(true);
    try {
      const parsedDays = expiryDays.trim() ? Number(expiryDays) : null;
      if (maxExpiry && parsedDays && parsedDays > maxExpiry) {
        setError(`Links can last up to ${maxExpiry} days at most.`);
        setSubmitting(false);
        return;
      }
      const expiresAt = parsedDays ? new Date(Date.now() + parsedDays * 86400000).toISOString() : null;
      await createPublication(
        captureId,
        {
          expectedVersion: version,
          insightIds: selectedInsightIds,
          includeTranscript,
          displayTitle: displayTitle.trim() || undefined,
          expiresAt,
        },
        crypto.randomUUID()
      );
      const fresh = await getSharing(captureId);
      setState(fresh);
    } catch (e) {
      if (e instanceof ApiError && e.code === "sharing_disabled") {
        setError("Sharing notes is turned off right now. Ask your administrator to turn it on.");
      } else if (e instanceof ApiError && e.code === "version_conflict") {
        setError("These notes changed while you were sharing. Reload and try again.");
      } else {
        setError(e instanceof Error ? e.message : "We couldn’t share these notes. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function makeLink() {
    if (!publicationId) {
      setError("Choose which notes to share first.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const parsedDays = expiryDays.trim() ? Number(expiryDays) : null;
      const expiresAt = parsedDays ? new Date(Date.now() + parsedDays * 86400000).toISOString() : null;
      const res = await createLink(
        captureId,
        {
          expectedVersion: version,
          publicationId,
          replaceLinkId: state?.link ? state.link.id : undefined,
          expiresAt,
        },
        crypto.randomUUID()
      );
      setLinkUrl(res.linkUrl ?? null);
      setAlreadyIssued(!!res.alreadyIssued);
      const fresh = await getSharing(captureId);
      setState(fresh);
    } catch (e) {
      setError(e instanceof Error ? e.message : "We couldn’t create link. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function addGrant() {
    if (!publicationId) {
      setError("Share a copy of the notes first.");
      return;
    }
    if (!email.trim() || !email.includes("@")) {
      setError("Enter a valid email address.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await createGrant(
        captureId,
        {
          expectedVersion: version,
          publicationId,
          email: email.trim(),
        },
        crypto.randomUUID()
      );
      const fresh = await getSharing(captureId);
      setState(fresh);
      setEmail("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "We couldn’t add that person. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function onRevokeLink(linkId: string) {
    setError(null);
    setSubmitting(true);
    try {
      await revokeLink(captureId, linkId, { expectedVersion: version, reason: "owner_request" });
      setLinkUrl(null);
      setAlreadyIssued(false);
      const fresh = await getSharing(captureId);
      setState(fresh);
    } catch (e) {
      setError(e instanceof Error ? e.message : "We couldn’t remove access. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function onRevokeGrant(grantId: string) {
    setError(null);
    setSubmitting(true);
    try {
      await revokeGrant(captureId, grantId, { expectedVersion: version, reason: "owner_request" });
      const fresh = await getSharing(captureId);
      setState(fresh);
    } catch (e) {
      setError(e instanceof Error ? e.message : "We couldn’t remove access. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function onSendGrant(grantId: string) {
    if (!invitationsAllowed) {
      setError("Email invitations are turned off right now.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await sendGrant(captureId, grantId, { expectedVersion: version, reason: "owner_request" });
      const fresh = await getSharing(captureId);
      setState(fresh);
    } catch (e) {
      setError(e instanceof Error ? e.message : "We couldn’t send the invitation. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="share-title" className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-2xl border border-border bg-background p-6 shadow-lg">
        <div className="flex items-start justify-between gap-3">
          <h2 id="share-title" className="text-lg font-semibold">Share notes</h2>
          <Button variant="ghost" onClick={onClose}>Close</Button>
        </div>

        {loading ? <p className="mt-4 text-sm text-muted">Loading…</p> : null}

        {sharingDisabledByPolicy && (
          <div role="alert" className="mt-3 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-foreground">
            <p className="font-medium text-warning">Sharing is turned off</p>
            <p className="mt-1 text-xs text-muted">Sharing is currently turned off. An administrator can turn on public links and sharing with people in <a href="/admin/settings" className="underline hover:text-foreground">Admin Settings</a>.</p>
          </div>
        )}

        {error && <p role="alert" className="mt-3 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}

        {state && (
          <div className="mt-4 space-y-5">
            <p className="text-xs text-muted">Only you can manage sharing, and nothing is shared until you choose to. Shared notes never include audio, video or the participant list, and people you share with can only view them.</p>

            <Card>
              <CardHeader title="Choose what to share" description="Pick the notes people will see." />
              <div className="space-y-4 p-4 text-sm">
                <label className="block">
                  <span className="text-sm font-medium">Title shown on the shared page</span>
                  <input
                    value={displayTitle}
                    onChange={(e) => setDisplayTitle(e.target.value)}
                    maxLength={200}
                    placeholder="Shared notes"
                    className="mt-2 block h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                  />
                </label>

                <div className="space-y-2 rounded-lg border border-border p-3">
                  <span className="text-xs font-medium text-muted uppercase tracking-wider">What to include</span>
                  {readyInsights.length > 0 ? (
                    <div className="space-y-2 pt-1">
                      {readyInsights.map((insight) => (
                        <label key={insight.id} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedInsightIds.includes(insight.id)}
                            onChange={() => toggleInsight(insight.id)}
                            className="size-4"
                          />
                          <span>{insight.label}</span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted">No finished notes to share yet.</p>
                  )}
                  {hasTranscript && (
                    <label className="flex items-center gap-2 pt-1 border-t border-border cursor-pointer">
                      <input
                        type="checkbox"
                        checked={includeTranscript}
                        onChange={(e) => setIncludeTranscript(e.target.checked)}
                        className="size-4"
                      />
                      <span>Include the transcript</span>
                    </label>
                  )}
                </div>

                <label className="block">
                  <span className="text-sm font-medium">Link expires after (days{maxExpiry ? `, 1–${maxExpiry}` : ", 1–365, or leave blank for no expiry"})</span>
                  <input
                    type="number"
                    min={1}
                    max={maxExpiry ?? 365}
                    value={expiryDays}
                    onChange={(e) => setExpiryDays(e.target.value)}
                    placeholder={maxExpiry ? `Max ${maxExpiry} days` : "No expiry"}
                    className="mt-2 block h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                  />
                </label>

                {!hasSelectedContent && (
                  <p className="text-xs text-warning">Choose at least one note, or the transcript, to share.</p>
                )}

                <Button
                  variant="primary"
                  disabled={submitting || !hasSelectedContent || sharingDisabledByPolicy}
                  onClick={() => void publish()}
                >
                  {submitting ? "Sharing…" : "Share selected notes"}
                </Button>

                {state.publication && (
                  <p className="text-xs text-muted">
                    Currently shared: version {state.publication.version} · shared {state.publication.publishedAt ? new Date(state.publication.publishedAt).toLocaleString() : "recently"}
                  </p>
                )}
              </div>
            </Card>

            <Card>
              <CardHeader title="People with access" description="Share with specific people by email." />
              <div className="space-y-3 p-4 text-sm">
                <p className="text-xs text-muted">You own these notes. People you add can view them.</p>
                {!recipientGrantsAllowed && (
                  <p className="text-xs text-warning">Sharing with people is turned off right now.</p>
                )}
                {!publicationId && (
                  <p className="text-xs text-muted">Share the notes above first, then add people.</p>
                )}
                <div className="flex gap-2">
                  <input
                    type="email"
                    placeholder="me@joobah.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={!publicationId || !recipientGrantsAllowed || submitting}
                    className="h-10 flex-1 rounded-lg border border-border bg-background px-3 text-sm disabled:opacity-60"
                  />
                  <Button
                    disabled={!publicationId || !recipientGrantsAllowed || !email.trim() || submitting}
                    onClick={() => void addGrant()}
                  >
                    Add
                  </Button>
                </div>
                <ul className="divide-y divide-border rounded-lg border border-border">
                  {(state.grants ?? []).length === 0 ? (
                    <li className="px-3 py-3 text-muted">No recipients yet.</li>
                  ) : (
                    state.grants.map((g) => (
                      <li key={g.id} className="flex items-center justify-between gap-2 px-3 py-2">
                        <span>{g.email}</span>
                        <span className="flex items-center gap-2">
                          <span className="text-xs text-muted">{g.revokedAt ? "Revoked" : "Can view"}</span>
                          {!g.revokedAt && (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={submitting}
                                onClick={() => void onRevokeGrant(g.id)}
                              >
                                Remove
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={submitting || !invitationsAllowed}
                                title={!invitationsAllowed ? "Invitations are turned off right now" : "Send email invitation"}
                                onClick={() => void onSendGrant(g.id)}
                              >
                                Send
                              </Button>
                            </>
                          )}
                        </span>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            </Card>

            <Card>
              <CardHeader title="Link visibility" description="Create a link that anyone can open." />
              <div className="space-y-3 p-4 text-sm">
                <p className="text-xs text-muted">Right now only the people you added can see these notes. A link lets anyone who has it view them. Audio and video are never included.</p>
                {!publicLinksAllowed && (
                  <p className="text-xs text-warning">Link sharing is turned off right now.</p>
                )}
                {!publicationId && (
                  <p className="text-xs text-muted">Share the notes above first, then create a link.</p>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button
                    disabled={!publicationId || !publicLinksAllowed || submitting}
                    onClick={() => void makeLink()}
                  >
                    {submitting ? "Creating…" : state.link && !state.link.revokedAt ? "Create replacement link" : "Create link"}
                  </Button>
                  {state.link && !state.link.revokedAt && (
                    <Button
                      variant="ghost"
                      disabled={submitting}
                      onClick={() => void onRevokeLink(state.link!.id)}
                    >
                      Revoke link
                    </Button>
                  )}
                </div>
                {linkUrl && (
                  <div className="rounded-lg border border-border bg-surface px-3 py-2">
                    <p className="text-xs text-muted">Copy this link now. You won’t be able to see it again.</p>
                    <p className="mt-1 break-all font-mono text-sm select-all">{linkUrl}</p>
                    <Button size="sm" className="mt-2" onClick={() => void navigator.clipboard.writeText(linkUrl)}>
                      Copy link
                    </Button>
                  </div>
                )}
                {alreadyIssued && (
                  <p className="text-xs text-warning">
                    A link already exists for these notes. For security we can’t show it again. Creating a new link turns the old one off.
                  </p>
                )}
                {state.link && !linkUrl && (
                  <p className="text-xs text-muted">
                    Link {state.link.id.slice(0, 8)} · {state.link.expiresAt ? `expires ${new Date(state.link.expiresAt).toLocaleString()}` : "no expiry"} · {state.link.revokedAt ? "revoked" : "active"}
                  </p>
                )}
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}