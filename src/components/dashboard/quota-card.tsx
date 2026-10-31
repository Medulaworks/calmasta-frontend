"use client";

import { AlertCircle, Gauge, PauseCircle, RefreshCw } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { usageQuery } from "@/lib/queries";

function formatSeconds(totalSeconds: number): string {
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const remainderSeconds = totalSeconds % 60;
  return remainderSeconds > 0 ? `${minutes}m ${remainderSeconds}s` : `${minutes}m`;
}

export function QuotaCard() {
  const { data, error, isLoading, refetch } = useQuery(usageQuery);
  const reload = () => void refetch();

  if (isLoading) {
    return (
      <Card>
        <CardHeader title="Audio allowance" />
        <div aria-hidden className="space-y-4 p-5">
          <div className="h-4 w-32 jb-skel rounded bg-border" />
          <div className="h-2 w-full jb-skel rounded-full bg-border" />
          <div className="grid grid-cols-3 gap-2">
            <div className="h-8 jb-skel rounded bg-surface" />
            <div className="h-8 jb-skel rounded bg-surface" />
            <div className="h-8 jb-skel rounded bg-surface" />
          </div>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader title="Audio allowance" />
        <div className="space-y-3 p-5">
          <p role="alert" className="text-sm text-danger">
            {(error as Error).message}
          </p>
          <Button variant="secondary" onClick={reload}>
            <RefreshCw aria-hidden className="h-3.5 w-3.5" /> Retry
          </Button>
        </div>
      </Card>
    );
  }

  if (!data) return null;

  const totalCommitted = data.usedSeconds + data.reservedSeconds;
  const percentUsed = data.limitSeconds > 0 ? Math.min(100, Math.round((totalCommitted / data.limitSeconds) * 100)) : 0;
  const isZero = data.remainingSeconds <= 0 && data.limitSeconds > 0;

  return (
    <Card>
      <CardHeader
        title="Audio allowance"
        id="quota-heading"
        action={
          data.processingPaused ? (
            <Badge tone="warning">Processing paused</Badge>
          ) : isZero ? (
            <Badge tone="danger">Quota exhausted</Badge>
          ) : (
            <Badge tone="info">{data.plan === "plan_free" ? "Free allowance" : data.plan}</Badge>
          )
        }
      />
      <div className="space-y-4 p-5 text-sm">
        {data.processingPaused && (
          <div role="alert" className="flex items-start gap-2.5 rounded-lg border border-warning/30 bg-warning/10 p-3 text-warning">
            <PauseCircle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="text-xs">
              <p className="font-medium">Processing is paused</p>
              <p className="mt-0.5 text-muted">Usage reconciliation or admin action is required before new audio can be processed.</p>
            </div>
          </div>
        )}

        {isZero && !data.processingPaused && (
          <div role="alert" className="flex items-start gap-2.5 rounded-lg border border-danger/30 bg-danger/10 p-3 text-danger">
            <AlertCircle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="text-xs">
              <p className="font-medium">Allowance exhausted</p>
              <p className="mt-0.5 text-muted">You have used all audio minutes available for this period.</p>
            </div>
          </div>
        )}

        <div>
          <div className="flex items-center justify-between text-xs text-muted">
            <span className="flex items-center gap-1.5 font-medium text-foreground">
              <Gauge aria-hidden className="h-3.5 w-3.5 text-muted" />
              {formatSeconds(data.remainingSeconds)} remaining
            </span>
            <span>{formatSeconds(data.limitSeconds)} total limit</span>
          </div>

          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-border" aria-hidden>
            <div
              className={`h-full transition-all ${
                data.processingPaused ? "bg-warning" : isZero ? "bg-danger" : percentUsed > 85 ? "bg-warning" : "bg-accent-solid"
              }`}
              style={{ width: `${percentUsed}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 border-t border-border pt-4 text-center">
          <div>
            <span className="block text-xs text-muted">Used</span>
            <span className="mt-0.5 block font-medium tabular-nums">{formatSeconds(data.usedSeconds)}</span>
          </div>
          <div>
            <span className="block text-xs text-muted">In flight</span>
            <span className="mt-0.5 block font-medium tabular-nums">{formatSeconds(data.reservedSeconds)}</span>
          </div>
          <div>
            <span className="block text-xs text-muted">Remaining</span>
            <span className={`mt-0.5 block font-medium tabular-nums ${isZero ? "text-danger" : ""}`}>
              {formatSeconds(data.remainingSeconds)}
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}
