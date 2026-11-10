"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { getSharing, createPublication, createLink, revokeLink, createGrant, revokeGrant, sendGrant } from "@/lib/sharing-client";
import type { SharingState } from "@/lib/sharing-types";
import { ApiError } from "@/lib/upload-client";

export function ShareNotesDialog({ captureId, open, onClose }: { captureId: string; open: boolean; onClose: () => void }) {
  const [state, setState] = useState<SharingState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [displayTitle, setDisplayTitle] = useState("");
  const [includeTranscript, setIncludeTranscript] = useState(false);
  const [expiryDays, setExpiryDays] = useState<string>("");
  const [linkUrl, setLinkUrl] = useState<string | null>(null);
  const [alreadyIssued, setAlreadyIssued] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    getSharing(captureId)
      .then((s) => { setState(s); setDisplayTitle(s.publication?.displayTitle ?? ""); })
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load sharing."))
      .finally(() => setLoading(false));
  }, [captureId, open]);

  if (!open) return null;

  const version = state?.version ?? 0;
  const publicationId = state?.publication?.id;

  async function publish() {
    setError(null);
    try {
      const expiresAt = expiryDays ? new Date(Date.now() + Number(expiryDays) * 86400000).toISOString() : null;
      const next = await createPublication(captureId, { expectedVersion: version, insightIds: [], includeTranscript, displayTitle: displayTitle.trim() || undefined, expiresAt }, crypto.randomUUID());
      setState(next);
    } catch (e) {
      setError(e instanceof ApiError && e.code === "version_conflict" ? "Version conflict — reload and try again." : e instanceof Error ? e.message : "Publish failed.");
    }
  }

  async function makeLink() {
    if (!publicationId) { setError("Publish selected notes first."); return; }
    setError(null);
    try {
      const expiresAt = expiryDays ? new Date(Date.now() + Number(expiryDays) * 86400000).toISOString() : null;
      const res = await createLink(captureId, { publicationId, expiresAt }, crypto.randomUUID());
      setLinkUrl(res.linkUrl ?? null);
      setAlreadyIssued(!!res.alreadyIssued);
      if (res.version) setState(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create link.");
    }
  }

  async function addGrant() {
    if (!publicationId) { setError("Publish first."); return; }
    if (!email.trim() || !email.includes("@")) { setError("Enter a valid email."); return; }
    try {
      const next = await createGrant(captureId, { publicationId, email: email.trim() }, crypto.randomUUID());
      setState(next);
      setEmail("");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not add grant."); }
  }

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="share-title" className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-2xl border border-border bg-background p-6 shadow-lg">
        <div className="flex items-start justify-between gap-3">
          <h2 id="share-title" className="text-lg font-semibold">Share notes</h2>
          <Button variant="ghost" onClick={onClose}>Close</Button>
        </div>
        {loading ? <p className="mt-4 text-sm text-muted">Loading…</p> : null}
        {error && <p role="alert" className="mt-3 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
        {state && (
          <div className="mt-4 space-y-5">
            <p className="text-xs text-muted">Owner-only. Opening this dialog does not publish or create a link. Select completed notes/templates to publish; audio/video and participant list are not shared. Recipients are view-only.</p>
            <Card><CardHeader title="Publish snapshot" />
              <div className="space-y-3 p-4 text-sm">
                <label className="block"><span className="text-sm font-medium">Display title (shown on shared page)</span><input value={displayTitle} onChange={(e) => setDisplayTitle(e.target.value)} maxLength={200} className="mt-2 block h-10 w-full rounded-lg border border-border bg-background px-3 text-sm" /></label>
                <label className="inline-flex items-center gap-2"><input type="checkbox" checked={includeTranscript} onChange={(e) => setIncludeTranscript(e.target.checked)} className="size-4" /> Include transcript snapshot</label>
                <label className="block"><span className="text-sm">Link expiry (days, 1–365, blank = no expiry)</span><input type="number" min={1} max={365} value={expiryDays} onChange={(e) => setExpiryDays(e.target.value)} className="mt-2 block h-10 w-full rounded-lg border border-border bg-background px-3 text-sm" /></label>
                <Button variant="primary" onClick={() => void publish()}>Publish selected snapshots</Button>
                {state.publication && <p className="text-xs text-muted">Publication {state.publication.id.slice(0, 8)} · version {state.publication.version} · {state.publication.mode}</p>}
              </div>
            </Card>
            <Card><CardHeader title="People with access" />
              <div className="space-y-3 p-4 text-sm">
                <p className="text-xs text-muted">Owner (you) — can view. Recipients — can view. Owner cannot be removed.</p>
                <div className="flex gap-2"><input type="email" placeholder="Add email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-10 flex-1 rounded-lg border border-border bg-background px-3 text-sm" /><Button onClick={() => void addGrant()}>Add</Button></div>
                <ul className="divide-y divide-border rounded-lg border border-border">
                  {(state.grants ?? []).length === 0 ? <li className="px-3 py-3 text-muted">No recipients yet.</li> : state.grants.map((g) => (
                    <li key={g.id} className="flex items-center justify-between gap-2 px-3 py-2"><span>{g.email}</span><span className="flex items-center gap-2"><span className="text-xs text-muted">Can view</span><Button size="sm" variant="ghost" onClick={() => void revokeGrant(captureId, g.id, { expectedVersion: version }).then(setState).catch((e) => setError(e instanceof Error ? e.message : "Revoke failed"))}>Remove</Button><Button size="sm" variant="ghost" onClick={() => void sendGrant(captureId, g.id).catch((e) => setError(e instanceof Error ? e.message : "Send failed"))}>Send</Button></span></li>
                  ))}
                </ul>
              </div>
            </Card>
            <Card><CardHeader title="Link visibility" />
              <div className="space-y-3 p-4 text-sm">
                <p className="text-xs text-muted">Restricted (default). Changing to Anyone with link creates the link and publishes selected snapshots after review. Audio/video never included.</p>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => void makeLink()}>Create link (Anyone with link)</Button>
                  {state.link && <Button variant="ghost" onClick={() => void revokeLink(captureId, state.link!.id, { expectedVersion: version, reason: "revoked by owner" }).then(setState).catch((e) => setError(e instanceof Error ? e.message : "Revoke failed"))}>Revoke link</Button>}
                </div>
                {linkUrl && <div className="rounded-lg border border-border bg-surface px-3 py-2"><p className="text-xs text-muted">Copy this link now — it is shown only once.</p><p className="mt-1 break-all font-mono text-sm">{linkUrl}</p><Button size="sm" className="mt-2" onClick={() => void navigator.clipboard.writeText(linkUrl)}>Copy link</Button></div>}
                {alreadyIssued && <p className="text-xs text-warning">A link was already issued for this publication. Create replacement link — previous token is hashed and cannot be recovered; replacing revokes the old link.</p>}
                {state.link && !linkUrl && <p className="text-xs text-muted">Link {state.link.id.slice(0, 8)} · {state.link.expiresAt ? `expires ${new Date(state.link.expiresAt).toLocaleString()}` : "no expiry"} · {state.link.revokedAt ? "revoked" : "active"}</p>}
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
