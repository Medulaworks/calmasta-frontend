"use client";

import {
  ArrowRight,
  FileText,
  ListChecks,
  Mic,
  ScrollText,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { MeetingVideo } from "@/components/meeting-video";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, tabId, tabPanelId } from "@/components/ui/tabs";
import { formatBytes, formatDuration } from "@/lib/audio";
import { createDocument, getDocument } from "@/lib/documents-client";
import { plainPreview } from "@/lib/preview";
import { documentStatus, timeAgo } from "@/lib/status";
import { type CaptureView, getCapture } from "@/lib/upload-client";

type TabKey = "summary" | "transcript" | "actions" | "recording";
const LINES = 8;

/**
 * What a meeting produced: the written summary, the transcript, the action items and the recording, as a preview with a
 * way into the full conversation. It only shows what exists. Nothing here records or sends anything.
 */
export function MeetingOutcome({
  captureId,
  captureStatus,
}: {
  captureId: string;
  captureStatus: string;
}) {
  const [state, setState] = useState<{
    id: string;
    cap: CaptureView | null;
    summary: string | null;
    error: boolean;
  } | null>(null);
  const [tab, setTab] = useState<TabKey>("summary");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cap = await getCapture(captureId);
        // The newest finished document stands in as the summary; its text is shown as plain text.
        const doc = cap.documents.find((d) => d.status === "ready");
        const summary = doc
          ? plainPreview((await getDocument(doc.id)).contentHtml)
          : null;
        if (!cancelled) setState({ id: captureId, cap, summary, error: false });
      } catch {
        if (!cancelled)
          setState({ id: captureId, cap: null, summary: null, error: true });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [captureId]);

  const loaded = state?.id === captureId ? state : null;
  const cap = loaded?.cap ?? null;
  const open = `/dashboard/captures/${captureId}`;

  if (!loaded)
    return (
      <div
        role="status"
        aria-label="Loading what this meeting produced"
        className="h-40 jb-skel rounded-lg border border-border bg-surface"
      />
    );
  if (loaded.error || !cap) {
    return (
      <p
        role="alert"
        className="rounded-lg border border-danger/30 bg-danger/5 px-3 py-3 text-danger">
        Couldn&rsquo;t load this meeting&rsquo;s results.{" "}
        <Link href={open} className="font-medium underline underline-offset-2">
          Open the conversation
        </Link>
      </p>
    );
  }

  const happened =
    captureStatus !== "denied" &&
    captureStatus !== "timed_out" &&
    captureStatus !== "failed";
  if (!happened) {
    const last = [...cap.events].reverse().find((e) => e.detail);
    return (
      <div className="rounded-lg border border-border bg-surface px-3 py-3">
        <p className="text-xs font-medium text-muted">Recording</p>
        <p className="mt-1">
          The assistant didn&rsquo;t record this meeting
          {cap.failureReason || last?.detail
            ? `: ${cap.failureReason ?? last?.detail}`
            : "."}
        </p>
        <Link
          href={open}
          className="mt-1 inline-block font-medium text-accent hover:underline">
          Open the conversation
        </Link>
      </div>
    );
  }
  const ready = cap.transcript.length > 0;
  if (!ready) {
    return (
      <div className="rounded-lg border border-border bg-surface px-3 py-3">
        <p className="text-xs font-medium text-muted">Results</p>
        <p className="mt-1 text-muted">
          {captureStatus === "completed"
            ? "The transcript isn't ready yet."
            : "The meeting is still being recorded or processed. The transcript, summary and action items appear here when it's done."}
        </p>
        <Link
          href={open}
          className="mt-1 inline-block font-medium text-accent hover:underline">
          Open the conversation
        </Link>
      </div>
    );
  }

  const actions = cap.actions.items.filter((a) => a.status !== "dismissed");
  const tabs = [
    { id: "summary" as const, label: "Summary" },
    { id: "transcript" as const, label: "Transcript" },
    { id: "actions" as const, label: "Actions", count: actions.length },
    { id: "recording" as const, label: "Recording" },
  ];

  return (
    <section aria-label="What came out of this meeting" className="space-y-3">
      <h3 className="text-xs font-medium text-muted">What came out of it</h3>
      <Tabs
        label="Meeting results"
        items={tabs}
        active={tab}
        onChange={setTab}
      />
      <div
        role="tabpanel"
        id={tabPanelId(tab)}
        aria-labelledby={tabId(tab)}
        className="min-h-24">
        {tab === "summary" && <Summary cap={cap} text={loaded.summary} />}
        {tab === "transcript" && <Transcript cap={cap} />}
        {tab === "actions" && <Actions cap={cap} items={actions} />}
        {tab === "recording" && <Recording cap={cap} />}
      </div>
      <Link
        href={open}
        className="inline-flex items-center gap-1 font-medium text-accent hover:underline">
        Open the full conversation{" "}
        <ArrowRight aria-hidden className="h-3.5 w-3.5" />
      </Link>
    </section>
  );
}

function Summary({ cap, text }: { cap: CaptureView; text: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const doc = cap.documents.find((d) => d.status === "ready");
  const pending = cap.documents.find((d) => d.status === "generating");
  async function write() {
    setBusy(true);
    setError(null);
    try {
      const r = await createDocument(cap.id, "summary_and_actions");
      router.push(`/dashboard/library/${r.documentId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't start the summary.");
      setBusy(false);
    }
  }
  if (doc && text) {
    const st = documentStatus({
      status: doc.status,
      editedByUser: doc.editedByUser,
    });
    return (
      <div className="space-y-2">
        <p className="flex items-center gap-2">
          <FileText aria-hidden className="h-4 w-4 shrink-0 text-muted" />
          <span className="min-w-0 flex-1 truncate font-medium">
            {doc.title}
          </span>
          <Badge tone={st.tone}>{st.label}</Badge>
        </p>
        <p className="line-clamp-6 text-muted">{text}</p>
        <Link
          href={`/dashboard/library/${doc.id}`}
          className="font-medium text-accent hover:underline">
          Open the full document
        </Link>
      </div>
    );
  }
  if (pending)
    return (
      <p role="status" className="text-muted">
        A document is being written from this meeting…
      </p>
    );
  return (
    <div className="space-y-2">
      <p className="text-muted">
        No summary yet. MyJooba can write one from the transcript, which you can
        edit freely afterwards.
      </p>
      <Button size="sm" onClick={() => void write()} disabled={busy}>
        <Sparkles aria-hidden className="h-3.5 w-3.5" />{" "}
        {busy ? "Starting…" : "Write a summary"}
      </Button>
      {error && (
        <p role="alert" className="text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

function Transcript({ cap }: { cap: CaptureView }) {
  const name = useMemo(
    () => (id: string | null) => (id ? (cap.speakerNames[id] ?? id) : null),
    [cap.speakerNames],
  );
  const shown = cap.transcript.slice(0, LINES);
  return (
    <div className="space-y-2">
      <ol className="space-y-1.5">
        {shown.map((s) => (
          <li key={s.id} className="flex gap-2">
            <span className="w-9 shrink-0 text-xs tabular-nums leading-5 text-muted">
              {formatDuration(s.startMs / 1000)}
            </span>
            <span className="min-w-0">
              {name(s.speakerId) && (
                <span className="mr-1.5 text-xs font-medium text-muted">
                  {name(s.speakerId)}
                </span>
              )}
              {s.text}
            </span>
          </li>
        ))}
      </ol>
      {cap.transcript.length > LINES && (
        <p className="text-xs text-muted">
          {cap.transcript.length - LINES} more lines
        </p>
      )}
      <Link
        href={`/dashboard/captures/${cap.id}?tab=transcript`}
        className="inline-flex items-center gap-1 font-medium text-accent hover:underline">
        <ScrollText aria-hidden className="h-3.5 w-3.5" /> Read and edit the
        transcript
      </Link>
    </div>
  );
}

function Actions({
  cap,
  items,
}: {
  cap: CaptureView;
  items: CaptureView["actions"]["items"];
}) {
  if (items.length === 0) {
    return (
      <div className="space-y-1">
        <p className="text-muted">
          {cap.actions.state === "extracting"
            ? "Looking for action items…"
            : "No action items yet. Open the conversation and choose “Find action items”."}
        </p>
        <Link
          href={`/dashboard/captures/${cap.id}?tab=actions`}
          className="font-medium text-accent hover:underline">
          Open action items
        </Link>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <ul className="space-y-2">
        {items.slice(0, 5).map((a) => (
          <li key={a.id} className="flex items-start gap-2">
            <ListChecks
              aria-hidden
              className="mt-0.5 h-4 w-4 shrink-0 text-muted"
            />
            <span className="min-w-0 flex-1">{a.text}</span>
            <Badge
              tone={
                a.status === "done"
                  ? "success"
                  : a.status === "suggested"
                    ? "warning"
                    : "info"
              }>
              {a.status === "done"
                ? "Done"
                : a.status === "suggested"
                  ? "To review"
                  : "Open"}
            </Badge>
          </li>
        ))}
      </ul>
      {items.length > 5 && (
        <p className="text-xs text-muted">{items.length - 5} more</p>
      )}
      <Link
        href={`/dashboard/captures/${cap.id}?tab=actions`}
        className="font-medium text-accent hover:underline">
        Review action items
      </Link>
    </div>
  );
}

function Recording({ cap }: { cap: CaptureView }) {
  if (cap.recordVideo) return <MeetingVideo cap={cap} compact />;
  if (cap.audio) {
    return (
      <div className="space-y-2">
        <audio controls src={cap.audio.url} className="w-full" />
        <p className="text-xs text-muted">
          Audio only · {formatBytes(cap.audio.sizeBytes)} · recorded{" "}
          {timeAgo(cap.createdAt)}
        </p>
      </div>
    );
  }
  return (
    <p className="flex gap-2 text-muted">
      <Mic aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
      {cap.audioStatus === "unavailable"
        ? "The audio file has been removed, as your privacy settings say. The transcript and documents stay."
        : "There is no audio to play for this meeting."}
    </p>
  );
}
