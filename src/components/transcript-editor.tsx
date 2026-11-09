"use client";

import { DocumentIllustration } from "@/components/ui/illustrations";
import { updateTranscriptDraft,pendingTranscriptDrafts } from "@/lib/transcript-drafts";

import { Download, Mic, Pencil, TriangleAlert, Video } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDuration } from "@/lib/audio";
import { type CaptureView, ApiError, getCapture, saveTranscript } from "@/lib/upload-client";

type SaveState = "saved" | "dirty" | "saving" | "error" | "conflict";
const SAVE_LABEL: Record<SaveState, string> = { saved: "All changes saved", dirty: "Unsaved changes", saving: "Saving…", error: "Couldn't save", conflict: "Not saved: changed elsewhere" };
const AUTOSAVE_MS = 1200;

/**
 * The Transcript tab: read it, or correct it and name the speakers.
 * Edits autosave. Only the lines that changed are sent, together with the version the user was looking at,
 * so a save made from a stale copy is refused (never silently overwriting) and the user's text stays on screen.
 */
export function TranscriptEditor({ cap, statusLabel, active, onChanged, loadCapture = getCapture, saveChanges = saveTranscript }: { cap: CaptureView; statusLabel: string; active: boolean; onChanged: () => void; loadCapture?: typeof getCapture; saveChanges?: typeof saveTranscript }) {
  function exportFile(content: string, name: string, type: string) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const a = document.createElement("a"); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
  }
  function exportTxt() {
    const lines = cap.transcript.map((s) => `${formatDuration(s.startMs / 1000)}${s.speakerId ? ` ${cap.speakerNames[s.speakerId] ?? s.speakerId}:` : ""} ${s.text}`).join("\n");
    exportFile(lines, `${cap.title ?? "transcript"}.txt`, "text/plain;charset=utf-8");
  }
  function exportSrt() {
    const pad = (n: number, w = 2) => String(n).padStart(w, "0");
    const stamp = (ms: number) => { const h = Math.floor(ms / 3600000); const m = Math.floor((ms % 3600000) / 60000); const s = Math.floor((ms % 60000) / 1000); const mm = ms % 1000; return `${pad(h)}:${pad(m)}:${pad(s)},${pad(mm, 3)}`; };
    const srt = cap.transcript.map((s, i) => `${i + 1}\n${stamp(s.startMs)} --> ${stamp(s.endMs)}\n${s.speakerId ? `${cap.speakerNames[s.speakerId] ?? s.speakerId}: ` : ""}${s.text}\n`).join("\n");
    exportFile(srt, `${cap.title ?? "transcript"}.srt`, "text/plain;charset=utf-8");
  }
  const ready = cap.state === "ready_to_review" || cap.state === "completed";
  const hasLines = ready && cap.transcript.length > 0;

  const [editing, setEditing] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [nameDrafts, setNameDrafts] = useState<Record<string, string>>({});
  const [save, setSave] = useState<SaveState>("saved");
  const [message, setMessage] = useState<string | null>(null);

  const inFlight = useRef(false);
  const acknowledged = useRef<{lines:Record<string,string>;names:Record<string,string>}>({lines:{},names:{}});
  const submitted = useRef<{lines:Record<string,string>;names:Record<string,string>}>({lines:{},names:{}});
  const baseVersion = useRef(cap.transcriptVersion ?? 0);
  // The newest values, for callbacks that outlive a render (timers, the unload warning).
  const latest = useRef({ drafts, nameDrafts, save });
  useEffect(() => {
    latest.current = { drafts, nameDrafts, save };
  });

  // Arriving from an action item (…&line=<id>): highlight the line it came from and scroll to it.
  const focusId = useSearchParams().get("line");
  useEffect(() => {
    if (hasLines && focusId) document.getElementById(`seg-${focusId}`)?.scrollIntoView({ block: "center" });
  }, [hasLines, focusId]);

  // Follow the server's version whenever there is nothing of ours waiting to be saved.
  useEffect(() => {
    const { drafts: d, nameDrafts: n, save: s } = latest.current;
    if (s !== "saving" && s !== "conflict" && Object.keys(d).length === 0 && Object.keys(n).length === 0) baseVersion.current = cap.transcriptVersion ?? 0;
    if(!inFlight.current && cap.transcriptVersion!==null && cap.transcriptVersion>=baseVersion.current)acknowledged.current={lines:{},names:{}};
  }, [cap.transcriptVersion]);

  const speakers = useMemo(() => [...new Set(cap.transcript.map((s) => s.speakerId).filter((x): x is string => !!x))], [cap.transcript]);
  const nameOf = (label: string | null) => (label ? cap.speakerNames[label] || label : null);
  const blank = (id: string) => id in drafts && drafts[id].trim() === "";

  const doSave = useCallback(async () => {
    if(inFlight.current)return false;
    const { drafts: d, nameDrafts: n } = latest.current;
    const segments = Object.entries(d).filter(([, text]) => text.trim() !== "").map(([id, text]) => ({ id, text }));
    const speakersToSend = { ...n };
    if (segments.length === 0 && Object.keys(speakersToSend).length === 0) {
      setSave(Object.keys(d).length ? "dirty" : "saved"); // only blank lines left: wait for the user to fix them
      return true;
    }
    submitted.current={lines:Object.fromEntries(segments.map(s=>[s.id,s.text])),names:speakersToSend};
    inFlight.current=true;
    setSave("saving");
    setMessage(null);
    try {
      const res = await saveChanges(cap.id, { baseVersion: baseVersion.current, segments, speakers: speakersToSend });
      baseVersion.current = res.version;
      const savedLines=Object.fromEntries(segments.map(s=>[s.id,s.text]));
      acknowledged.current={lines:{...acknowledged.current.lines,...savedLines},names:{...acknowledged.current.names,...speakersToSend}};
      // Forget only what was just saved; anything typed while the request ran stays pending.
      setDrafts((cur) => pendingTranscriptDrafts(cur,savedLines));
      setNameDrafts((cur) => pendingTranscriptDrafts(cur,speakersToSend));
      const stillDirty=Object.entries(latest.current.drafts).some(([id,text])=>!segments.some(s=>s.id===id&&s.text===text))||Object.entries(latest.current.nameDrafts).some(([label,name])=>speakersToSend[label]!==name);
      setSave(stillDirty?"dirty":"saved");
      onChanged();
      return true;
    } catch (err) {
      if (err instanceof ApiError && err.status === 409 && err.code === "version_conflict") setSave("conflict");
      else {
        setSave("error");
        setMessage(err instanceof Error ? err.message : "Could not save your changes.");
      }
      return false;
    } finally {inFlight.current=false;submitted.current={lines:{},names:{}};}
  }, [cap.id, onChanged, saveChanges]);

  const pending = Object.keys(drafts).length > 0 || Object.keys(nameDrafts).length > 0;
  // Autosave shortly after the last keystroke.
  useEffect(() => {
    if (!editing || !pending || save !== "dirty") return;
    const t = setTimeout(() => void doSave(), AUTOSAVE_MS);
    return () => clearTimeout(t);
  }, [editing, pending, drafts, nameDrafts, save, doSave]);

  // Never close the tab on unsaved work without asking.
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      const s = latest.current.save;
      if (s === "dirty" || s === "saving" || s === "error" || s === "conflict") e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  // Typing makes the state "dirty" (which arms the autosave) unless a save or a problem is already being dealt with.
  const markDirty = () => setSave((s) => (s === "saving" || s === "error" || s === "conflict" ? s : "dirty"));

  function setLine(id: string, original: string, value: string) {
    setDrafts((d) => updateTranscriptDraft(d,id,value,original,acknowledged.current.lines,submitted.current.lines));
    markDirty();
  }
  function setName(label: string, value: string) {
    const current = cap.speakerNames[label] ?? "";
    setNameDrafts((d) => updateTranscriptDraft(d,label,value,current,acknowledged.current.names,submitted.current.names));
    markDirty();
  }

  async function done() {
    if (pending && !(await doSave())) return; // stay in edit mode if it couldn't be saved
    setEditing(false);
  }
  function loadLatest() {
    setDrafts({});
    setNameDrafts({});
    setSave("saved");
    setMessage(null);
    baseVersion.current = -1; // re-read below
    void loadCapture(cap.id).then((c) => {
      baseVersion.current = c.transcriptVersion ?? 0;
      onChanged();
    }).catch(err=>{setSave("error");setMessage(err instanceof Error?err.message:"Could not reload the transcript.");});
  }
  async function keepMine() {
    try {
      const fresh = await loadCapture(cap.id);
      baseVersion.current = fresh.transcriptVersion ?? 0;
      setSave("dirty");
      await doSave();
      onChanged();
    } catch (err) {
      setSave("error");
      setMessage(err instanceof Error ? err.message : "Could not reload the transcript.");
    }
  }

  if (!hasLines) {
    const isFinishedEmpty = (ready || cap.state === "completed" || cap.state === "ready_to_review") && cap.transcriptVersion !== null;
    return (
      <Card>
        <CardHeader title="Transcript" />
        {active ? (
          <EmptyState icon={<Mic className="h-5 w-5" />} title={`${statusLabel}…`} body="This page updates by itself." />
        ) : isFinishedEmpty ? (
          <EmptyState icon={<Mic className="h-5 w-5" />} title="No speech detected" body="No speech was detected in this recording." />
        ) : cap.source === "meeting_url" && cap.state !== "failed" ? (
          <EmptyState illustration={<DocumentIllustration />} title="No transcript yet" body="A transcript will appear here after the recording has been processed." />
        ) : (
          <EmptyState title="No transcript" body="There is nothing to show for this recording." />
        )}
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {save === "conflict" && (
        <div role="alert" className="rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
          <p className="flex items-center gap-2 font-medium">
            <TriangleAlert aria-hidden className="h-4 w-4 shrink-0" /> This transcript was changed somewhere else
          </p>
          <p className="mt-1">Another tab or device saved edits first. Your changes are still here and have not overwritten theirs.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="secondary" onClick={loadLatest}>Load the latest (discard mine)</Button>
            <Button variant="primary" onClick={() => void keepMine()}>Keep my changes and save</Button>
          </div>
        </div>
      )}
      {save === "error" && message && (
        <p role="alert" className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {message} Your text is still here.{" "}
          <button type="button" className="font-medium underline" onClick={() => void doSave()}>Try again</button>
        </p>
      )}

      {editing && speakers.length > 0 && (
        <Card>
          <CardHeader title="Speakers" />
          <div className="grid gap-3 p-5 sm:grid-cols-2">
            {speakers.map((label) => (
              <label key={label} className="block text-sm">
                <span className="text-muted">Who is {label}?</span>
                <input
                  type="text"
                  maxLength={60}
                  value={nameDrafts[label] ?? cap.speakerNames[label] ?? ""}
                  placeholder={label}
                  onChange={(e) => setName(label, e.target.value)}
                  className="mt-1 block w-full min-h-10 rounded-xl border border-border bg-background px-4 py-2"
                />
              </label>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <CardHeader
          title="Transcript"
          action={
            editing ? (
              <div className="flex items-center gap-3">
                <p role="status" aria-live="polite" className={`text-xs ${save === "error" || save === "conflict" ? "text-danger" : "text-muted"}`}>
                  {SAVE_LABEL[save]}
                </p>
                <Button variant="primary" onClick={() => void done()} disabled={save === "saving" || save === "conflict"}>Done</Button>
              </div>
            ) : hasLines ? (
              <div className="flex items-center gap-2">
                <Button variant="ghost" onClick={exportTxt} title="Export as text"><Download aria-hidden className="h-4 w-4" /> TXT</Button>
                <Button variant="ghost" onClick={exportSrt} title="Export as SRT"><Download aria-hidden className="h-4 w-4" /> SRT</Button>
                <Button variant="secondary" onClick={() => setEditing(true)}>
                  <Pencil aria-hidden className="h-4 w-4" /> Edit transcript
                </Button>
              </div>
            ) : (
              <Button variant="secondary" onClick={() => setEditing(true)}>
                <Pencil aria-hidden className="h-4 w-4" /> Edit transcript
              </Button>
            )
          }
        />
        {editing && cap.documents.length > 0 && (
          <p className="border-b border-border px-5 py-3 text-xs text-muted">Documents you have already made are not changed. Open one and choose Rewrite to use your corrections.</p>
        )}
        <ol className="divide-y divide-border">
          {cap.transcript.map((seg) => (
            <li key={seg.id} id={`seg-${seg.id}`} className={`flex scroll-mt-24 gap-4 px-5 py-3 text-sm ${focusId === seg.id ? "bg-accent/10" : ""}`}>
              <span className="w-12 shrink-0 pt-1 font-mono text-xs text-muted">{formatDuration(seg.startMs / 1000)}</span>
              {editing ? (
                <div className="min-w-0 flex-1">
                  {seg.speakerId && <span className="mb-1 block text-xs font-medium text-muted">{nameOf(seg.speakerId)}</span>}
                  <textarea
                    aria-label={`Line at ${formatDuration(seg.startMs / 1000)}${seg.speakerId ? ` by ${nameOf(seg.speakerId)}` : ""}`}
                    aria-invalid={blank(seg.id) || undefined}
                    value={drafts[seg.id] ?? seg.text}
                    maxLength={10000}
                    rows={Math.max(2, Math.ceil((drafts[seg.id] ?? seg.text).length / 90))}
                    onChange={(e) => setLine(seg.id, seg.text, e.target.value)}
                    className={`block w-full resize-y rounded-lg border bg-background px-3 py-2 ${blank(seg.id) ? "border-danger" : "border-border"}`}
                  />
                  {blank(seg.id) && <p className="mt-1 text-xs text-danger">A line can&apos;t be empty. Type something, or put the original back.</p>}
                </div>
              ) : (
                <p className="min-w-0">
                  {seg.speakerId && <span className="mr-2 text-xs font-medium text-muted">{nameOf(seg.speakerId)}</span>}
                  {seg.text}
                  {seg.editedByUser && <span className="ml-2 rounded bg-surface px-2 py-1 text-xs text-muted">Edited</span>}
                </p>
              )}
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}
