"use client";

import { FileText } from "lucide-react";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import {
  createTranscriptImport,
  MAX_TRANSCRIPT_LENGTH,
  readTranscriptFile,
  validateTranscript,
} from "@/lib/transcript-upload";

export function TranscriptUpload() {
  const router = useRouter(),
    queryClient = useQueryClient();
  const [open, setOpen] = useState(false),
    [text, setText] = useState(""),
    [title, setTitle] = useState("");
  const [consent, setConsent] = useState(false),
    [pending, setPending] = useState(false),
    [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null),
    [locked, setLocked] = useState(false);
  const attempt = useRef<ReturnType<typeof createTranscriptImport> | null>(
    null,
  );
  const inFlight = useRef(false),
    fileRead = useRef(0);
  const [dragging, setDragging] = useState(false);
  async function takeFile(file: File | undefined) {
    if (!file || locked) return;
    const sequence = ++fileRead.current;
    setReading(true);
    setError(null);
    try {
      const value = await readTranscriptFile(file);
      if (sequence === fileRead.current) {
        setText(value);
        setConsent(false);
      }
    } catch (err) {
      if (sequence === fileRead.current)
        setError(
          err instanceof Error ? err.message : "We couldn’t read this file. Please try again.",
        );
    } finally {
      if (sequence === fileRead.current) setReading(false);
    }
  }
  async function chooseFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    await takeFile(file);
  }
  async function save() {
    if (inFlight.current || reading) return;
    try {
      validateTranscript(text);
      if (!attempt.current)
        attempt.current = createTranscriptImport({ text, title, consent });
      inFlight.current = true;
      setLocked(true);
      setPending(true);
      setError(null);
      const captureId = await attempt.current.save();
      void queryClient.invalidateQueries({ queryKey: ["captures"] });
      void queryClient.invalidateQueries({ queryKey: ["library"] });
      router.push(
        `/dashboard/library/recordings/${encodeURIComponent(captureId)}`,
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not save this transcript. Your text is still here.",
      );
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }
  return (
    <>
      <section
        aria-labelledby="upload-transcript-heading"
        className="flex flex-col rounded-2xl border border-border p-5">
        <span
          aria-hidden
          className="grid h-10 w-10 place-items-center rounded-lg bg-accent/10 text-accent">
          <FileText className="h-5 w-5" />
        </span>
        <h2
          id="upload-transcript-heading"
          className="mt-4 text-base font-medium">
          Upload transcript
        </h2>
        <p className="mt-1 text-sm text-muted">
          Save a UTF-8 .txt file or pasted text privately, then review its AI
          Notes. Up to 100,000 characters and 1 MiB per file.
        </p>
        <div className="mt-auto pt-5">
          <Button onClick={() => setOpen(true)}>Add transcript</Button>
        </div>
      </section>
      {open && (
        <Dialog
          title="Upload transcript"
          onClose={() => {
            if (!pending) setOpen(false);
          }}
          width="max-w-2xl">
          <div className="space-y-4">
            <label
              onDragOver={(e) => {
                if (locked || reading) return;
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                void takeFile(e.dataTransfer.files?.[0]);
              }}
              className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed px-4 py-6 text-center transition-colors focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20 ${dragging ? "border-accent bg-accent/5" : "border-border hover:bg-surface"}`}>
              <span
                aria-hidden
                className="grid h-10 w-10 place-items-center rounded-lg bg-accent/10 text-accent">
                <FileText className="h-5 w-5" />
              </span>
              <span className="text-sm font-medium">
                Choose a .txt file or drop it here
              </span>
              <span className="text-xs text-muted">UTF-8 .txt up to 1 MiB</span>
              <input
                type="file"
                accept=".txt,text/plain"
                disabled={locked || reading}
                onChange={chooseFile}
                className="sr-only"
              />
            </label>
            {reading && (
              <p role="status" className="text-sm text-muted">
                Reading transcript…
              </p>
            )}
            <label className="block text-sm">
              Paste or preview transcript
              <textarea
                value={text}
                maxLength={MAX_TRANSCRIPT_LENGTH}
                rows={8}
                disabled={locked || reading}
                onChange={(e) => {
                  fileRead.current++;
                  setText(e.target.value);
                  setConsent(false);
                  setError(null);
                }}
                className="mt-1 block w-full resize-y rounded-xl border border-border bg-background px-3 py-2"
              />
            </label>
            <p className="text-xs text-muted">
              {text.length.toLocaleString()} / 100,000 characters. Imported text
              has no audio or time labels.
            </p>
            <label className="block text-sm">
              Title (optional)
              <input
                value={title}
                maxLength={200}
                disabled={locked}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1 block min-h-10 w-full rounded-xl border border-border bg-background px-3 py-2"
              />
            </label>
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={consent}
                disabled={locked}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-1 size-4 shrink-0 accent-accent"
              />
              I have permission to save and process this transcript.
            </label>
            {error && (
              <p
                role="alert"
                className="rounded-lg border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
                {error} Your text is still here.
              </p>
            )}
            {locked && !pending && (
              <p className="text-xs text-muted">
                Retry checks the same save safely. Keep this tab open until it
                is confirmed.
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                disabled={pending}
                onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                disabled={pending || reading || !text.trim() || !consent}
                onClick={() => void save()}>
                {pending
                  ? "Saving transcript…"
                  : locked
                    ? "Retry save"
                    : "Save transcript"}
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </>
  );
}
