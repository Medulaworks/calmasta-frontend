"use client";

import { ListChecks, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDuration } from "@/lib/audio";
import { type ActionItemView, type ActionStatus, type CaptureView, findActions, setActionStatus } from "@/lib/upload-client";

function Item({ item, children }: { item: ActionItemView; children: React.ReactNode }) {
  return (
    <li className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <p className={`text-sm ${item.status === "dismissed" ? "text-muted line-through" : ""}`}>{item.text}</p>
        <p className="mt-1 text-xs text-muted">
          Owner: not specified · Due: not specified
          {item.sourceSegmentId && item.sourceStartMs !== null && (
            <>
              {" · "}
              <Link href={`?tab=transcript&line=${item.sourceSegmentId}`} className="text-accent hover:underline">
                From {formatDuration(item.sourceStartMs / 1000)} in the transcript
              </Link>
            </>
          )}
        </p>
      </div>
      <div className="flex shrink-0 gap-2">{children}</div>
    </li>
  );
}

/**
 * Action items found in the conversation. They are suggestions: a person confirms, dismisses or finishes each one.
 * Mojooba does not guess an owner or a date, and nothing here is sent to anyone.
 */
export function ActionsPanel({ cap, onChanged }: { cap: CaptureView; onChanged: () => void }) {
  const { state, error, items } = cap.actions;
  const ready = cap.state === "ready_to_review" || cap.state === "completed";
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function find() {
    setBusy(true);
    setProblem(null);
    try {
      await findActions(cap.id);
    } catch (err) {
      setProblem(err instanceof Error ? err.message : "Could not start looking for action items.");
    }
    setBusy(false);
    onChanged();
  }
  async function decide(item: ActionItemView, status: ActionStatus) {
    setProblem(null);
    try {
      await setActionStatus(item.id, status);
    } catch (err) {
      setProblem(err instanceof Error ? err.message : "Could not update that item.");
    }
    onChanged();
  }

  const by = (s: ActionStatus) => items.filter((i) => i.status === s);
  const finder = (label: string) => (
    <Button variant="secondary" onClick={() => void find()} disabled={!ready || busy || state === "extracting"}>
      <ListChecks aria-hidden className="h-4 w-4" /> {state === "extracting" ? "Looking…" : label}
    </Button>
  );

  return (
    <div className="space-y-4">
      {problem && <p role="alert" className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">{problem}</p>}
      {state === "failed" && (
        <div role="alert" className="flex items-start gap-3 rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          <TriangleAlert aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{error ?? "Looking for action items failed."} Your existing items are unchanged. You can try again.</p>
        </div>
      )}

      {items.length === 0 ? (
        <Card>
          <CardHeader title="Action items" />
          {state === "extracting" ? (
            <EmptyState icon={<ListChecks className="h-5 w-5" />} title="Looking for action items…" body="This takes a moment. This page updates by itself." />
          ) : (
            <EmptyState
              icon={<ListChecks className="h-5 w-5" />}
              title={state === "ready" ? "No action items found" : "No action items yet"}
              body={
                !ready
                  ? "Available once the transcript is ready."
                  : state === "ready"
                    ? "Nothing in this conversation sounded like something someone agreed to do."
                    : "Mojooba can look through the transcript for things people said they would do. They are only suggestions: you decide what to keep."
              }
              action={ready ? finder(state === "ready" ? "Look again" : "Find action items") : undefined}
            />
          )}
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader title="To review" action={finder("Look again")} />
            <p className="border-b border-border px-5 py-3 text-xs text-muted">
              Suggestions from the transcript, as it was said. Mojooba does not guess who owns an item or when it is due, and nothing is sent to anyone.
            </p>
            {by("suggested").length === 0 ? (
              <p className="px-5 py-6 text-sm text-muted">Nothing waiting for your review.</p>
            ) : (
              <ul className="divide-y divide-border">
                {by("suggested").map((i) => (
                  <Item key={i.id} item={i}>
                    <Button variant="primary" onClick={() => void decide(i, "confirmed")}>Confirm</Button>
                    <Button variant="ghost" onClick={() => void decide(i, "dismissed")}>Dismiss</Button>
                  </Item>
                ))}
              </ul>
            )}
          </Card>

          {by("confirmed").length > 0 && (
            <Card>
              <CardHeader title="Confirmed" action={<Badge tone="info">{by("confirmed").length}</Badge>} />
              <ul className="divide-y divide-border">
                {by("confirmed").map((i) => (
                  <Item key={i.id} item={i}>
                    <Button variant="secondary" onClick={() => void decide(i, "done")}>Mark done</Button>
                    <Button variant="ghost" onClick={() => void decide(i, "dismissed")}>Dismiss</Button>
                  </Item>
                ))}
              </ul>
            </Card>
          )}

          {by("done").length > 0 && (
            <Card>
              <CardHeader title="Done" action={<Badge tone="success">{by("done").length}</Badge>} />
              <ul className="divide-y divide-border">
                {by("done").map((i) => (
                  <Item key={i.id} item={i}>
                    <Button variant="ghost" onClick={() => void decide(i, "confirmed")}>Reopen</Button>
                  </Item>
                ))}
              </ul>
            </Card>
          )}

          {by("dismissed").length > 0 && (
            <details className="rounded-xl border border-border">
              <summary className="cursor-pointer px-5 py-3 text-sm font-medium">Dismissed ({by("dismissed").length})</summary>
              <ul className="divide-y divide-border border-t border-border">
                {by("dismissed").map((i) => (
                  <Item key={i.id} item={i}>
                    <Button variant="ghost" onClick={() => void decide(i, "suggested")}>Restore</Button>
                  </Item>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </div>
  );
}
