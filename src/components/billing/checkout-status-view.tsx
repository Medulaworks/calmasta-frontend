"use client";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  getCheckoutIntent,
  type ActivationStatus,
  type CheckoutIntent,
} from "@/lib/commerce-client";
import { fetchPlan } from "@/lib/plan-client";
import { ApiError } from "@/lib/upload-client";

/** Poll the authenticated intent every 3s for at most 60s, like the plan requires. */
export const INTENT_POLL_INTERVAL_MS = 3000;
export const INTENT_POLL_TIMEOUT_MS = 60_000;

const UUID_RE = /^[a-f0-9-]{36}$/i;

/** True for a well-formed opaque intent pointer; anything else never reaches the API. */
export function isIntentPointer(value: string | null | undefined): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

export type IntentOutcome =
  | { kind: "invalid" }
  | { kind: "pending" }
  | { kind: "active"; intent: CheckoutIntent }
  | { kind: "unavailable"; intent: CheckoutIntent }
  | { kind: "expired" }
  | { kind: "foreign" }
  | { kind: "unauthorized"; intentId: string }
  | { kind: "timeout" }
  | { kind: "failed"; message: string };

/**
 * Pure poll loop over an injected loader, so the timing/terminal-state logic
 * is unit-testable without timers or network. The loop never creates orders:
 * it only reads the workspace-scoped intent. Query parameters such as
 * ?status=success are never consulted here or in the view.
 */
export async function waitForActivation(
  load: () => Promise<CheckoutIntent>,
  opts?: {
    intervalMs?: number;
    timeoutMs?: number;
    now?: () => number;
    sleep?: (ms: number) => Promise<void>;
  },
): Promise<IntentOutcome> {
  const intervalMs = opts?.intervalMs ?? INTENT_POLL_INTERVAL_MS;
  const timeoutMs = opts?.timeoutMs ?? INTENT_POLL_TIMEOUT_MS;
  const now = opts?.now ?? Date.now;
  const sleep = opts?.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const start = now();
  for (;;) {
    let intent: CheckoutIntent;
    try {
      intent = await load();
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return { kind: "unauthorized", intentId: "" };
      if (e instanceof ApiError && e.status === 404) return { kind: "foreign" };
      if (e instanceof ApiError && e.status === 410) return { kind: "expired" };
      return { kind: "failed", message: e instanceof Error ? e.message : "Could not check your payment." };
    }
    const activation: ActivationStatus | undefined = intent.activationStatus;
    if (activation === "active") return { kind: "active", intent };
    if (activation === "blocked" || activation === "failed") return { kind: "unavailable", intent };
    if (intent.status === "expired" || activation === "expired") return { kind: "expired" };
    if (now() - start >= timeoutMs) return { kind: "timeout" };
    await sleep(intervalMs);
  }
}

function Panel({
  title,
  children,
  tone,
}: {
  title: string;
  children: React.ReactNode;
  tone: "info" | "success" | "error";
}) {
  const style =
    tone === "success"
      ? "border-success/40 bg-success/10"
      : tone === "error"
        ? "border-danger/40 bg-danger/10"
        : "border-border bg-surface";
  return (
    <Card className="max-w-2xl">
      <div className={`space-y-4 rounded-xl border p-5 text-sm ${style}`} role="status" aria-live="polite">
        <p className="text-lg font-semibold">{title}</p>
        {children}
      </div>
    </Card>
  );
}

/** Presentational states; the container supplies the outcome from authenticated polling. */
export function CheckoutStatusPanel({
  outcome,
  onRetry,
}: {
  outcome: IntentOutcome;
  onRetry: () => void;
}) {
  switch (outcome.kind) {
    case "invalid":
      return (
        <Panel title="This payment link is incomplete" tone="error">
          <p className="text-muted">
            We couldn&rsquo;t find a purchase reference in this link. If you just paid, open
            your receipt email or return to your plan and try again.
          </p>
          <ButtonLink href="/dashboard/plan" variant="primary">
            Back to plan
          </ButtonLink>
        </Panel>
      );
    case "pending":
      return (
        <Panel title="Waiting for the store" tone="info">
          <p className="flex items-center gap-2 text-muted">
            <Loader2 aria-hidden className="h-5 w-5 animate-spin text-accent" />
            Your payment is being confirmed. This usually takes a few seconds — you can leave
            this page; nothing is charged twice.
          </p>
        </Panel>
      );
    case "active":
      return (
        <Panel title="Payment confirmed" tone="success">
          <p className="flex items-center gap-2">
            <CheckCircle2 aria-hidden className="h-5 w-5 text-success" />
            Your credits are active. Taking you to your plan…
          </p>
        </Panel>
      );
    case "unavailable":
      return (
        <Panel title="We couldn't confirm this payment" tone="error">
          <p className="text-muted">
            The store didn&rsquo;t confirm your payment, so no credits were added and nothing
            was charged on our side. If money left your account, contact support with your
            receipt — do not pay again for the same purchase.
          </p>
          <div className="flex gap-2">
            <ButtonLink href="/dashboard/billing" variant="primary">
              Back to billing
            </ButtonLink>
            <ButtonLink href="/dashboard" variant="ghost">
              Go home
            </ButtonLink>
          </div>
        </Panel>
      );
    case "expired":
      return (
        <Panel title="This checkout has expired" tone="error">
          <p className="text-muted">
            Checkout links expire after a short time for your safety. No payment was taken —
            start again from billing to create a fresh checkout.
          </p>
          <ButtonLink href="/dashboard/billing" variant="primary">
            Back to billing
          </ButtonLink>
        </Panel>
      );
    case "foreign":
      return (
        <Panel title="We couldn't find this purchase" tone="error">
          <p className="text-muted">
            This purchase belongs to another workspace or no longer exists. Sign in with the
            account you bought with, or start again from billing.
          </p>
          <ButtonLink href="/dashboard/billing" variant="primary">
            Back to billing
          </ButtonLink>
        </Panel>
      );
    case "unauthorized":
      return (
        <Panel title="Your session ended" tone="error">
          <p className="text-muted">
            Please sign in again to check this payment. Your purchase reference is kept, so
            you&rsquo;ll return to this page.
          </p>
          <ButtonLink
            href={`/auth/login?returnTo=${encodeURIComponent(`/billing/return?intent=${encodeURIComponent(outcome.intentId)}`)}`}
            variant="primary"
          >
            Sign in
          </ButtonLink>
        </Panel>
      );
    case "timeout":
      return (
        <Panel title="This is taking longer than usual" tone="info">
          <p className="text-muted">
            We haven&rsquo;t heard from the store yet. If you paid, your credits will be
            applied automatically once it confirms — you won&rsquo;t be charged twice. You can
            check again now or come back later.
          </p>
          <div className="flex gap-2">
            <Button variant="primary" onClick={onRetry}>
              Check again
            </Button>
            <ButtonLink href="/dashboard/plan">Back to plan</ButtonLink>
          </div>
        </Panel>
      );
    case "failed":
      return (
        <Panel title="Couldn't reach the store" tone="error">
          <p className="text-muted">{outcome.message}</p>
          <div className="flex gap-2">
            <Button variant="primary" onClick={onRetry}>
              Try again
            </Button>
            <ButtonLink href="/dashboard/plan">Back to plan</ButtonLink>
          </div>
        </Panel>
      );
  }
}

/**
 * Return-page container. Reads only the opaque intent pointer, polls the
 * authenticated intent, and shows usable credits only after backend activation
 * confirmation followed by a refreshed /plan.
 */
export function CheckoutStatusView({ intentId }: { intentId: string | null }) {
  const [attempt, setAttempt] = useState(0);
  if (!isIntentPointer(intentId)) {
    return <CheckoutStatusPanel outcome={{ kind: "invalid" }} onRetry={() => {}} />;
  }
  // A retry remounts the poller so it restarts from pending without an
  // effect-time state reset.
  return (
    <PollingView
      key={`${intentId}:${attempt}`}
      intentId={intentId}
      onRetry={() => setAttempt((n) => n + 1)}
    />
  );
}

function PollingView({ intentId, onRetry }: { intentId: string; onRetry: () => void }) {
  const router = useRouter();
  const [outcome, setOutcome] = useState<IntentOutcome>({ kind: "pending" });

  useEffect(() => {
    let cancelled = false;
    void waitForActivation(() => getCheckoutIntent(intentId)).then((next) => {
      if (cancelled) return;
      if (next.kind === "unauthorized") {
        setOutcome({ kind: "unauthorized", intentId });
        return;
      }
      setOutcome(next);
      if (next.kind === "active") {
        // Refresh balances, then hand to the plan page with a success banner.
        void fetchPlan()
          .catch(() => null)
          .then(() => {
            if (!cancelled) router.replace("/dashboard/plan?purchase=success");
          });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [intentId, router]);

  return <CheckoutStatusPanel outcome={outcome} onRetry={onRetry} />;
}
