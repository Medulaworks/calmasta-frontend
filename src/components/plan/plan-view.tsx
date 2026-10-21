"use client";

import { AlertTriangle, Check } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { type PlanSummary, fetchPlan, formatDate } from "@/lib/plan-client";
import { formatMinutes, type Tone } from "@/lib/status";

const STATUS: Record<PlanSummary["plan"]["status"], { label: string; tone: Tone }> = {
  none: { label: "Free", tone: "neutral" },
  pending_activation: { label: "Waiting for payment confirmation", tone: "info" },
  active: { label: "Active", tone: "success" },
  grace: { label: "Payment needs attention", tone: "warning" },
  expired: { label: "Ended", tone: "neutral" },
};

const FREE_POINTS = ["Voice notes, uploads and meeting captures", "Transcripts, documents, search and action items", "Calendar and booking pages"];
const PRO_POINTS = ["A much larger monthly allowance", "Everything in Free", "Buy extra hours any time"];

function Meter({ used, total, exhausted }: { used: number; total: number; exhausted: boolean }) {
  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 100;
  return (
    <div role="progressbar" aria-label="Allowance used this month" aria-valuemin={0} aria-valuemax={total} aria-valuenow={Math.min(used, total)} aria-valuetext={`${used} of ${total} minutes used`} className="h-2.5 overflow-hidden rounded-full bg-border">
      <div className={`h-full rounded-full ${exhausted ? "bg-danger-solid" : "bg-accent-solid"}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function PlanView() {
  const [plan, setPlan] = useState<PlanSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchPlan().then(
      (p) => !cancelled && setPlan(p),
      (e) => !cancelled && setError(e instanceof Error ? e.message : "Could not load your plan."),
    );
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return <p role="alert" className="text-sm text-danger">{error}</p>;
  if (!plan) return <p role="status" className="text-sm text-muted">Loading…</p>;

  const st = STATUS[plan.plan.status];
  const isPro = plan.plan.plan === "pro";
  const tz = plan.timezone;

  return (
    <div className="grid max-w-3xl gap-6">
      {plan.placeholder && (
        <p role="note" className="flex gap-2 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
          <AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          Allowances and hour packs shown here are placeholders until pricing is confirmed.
        </p>
      )}

      <Card>
        <CardHeader title="Your plan" action={<Badge tone={st.tone}>{isPro || plan.plan.status !== "none" ? st.label : "Free"}</Badge>} />
        <div className="space-y-2 p-5 text-sm">
          <p className="text-xl font-semibold">{isPro ? "Pro" : "Free"}</p>
          {plan.plan.status === "active" && isPro && plan.plan.renewsAt && <p className="text-muted">Renews or ends on {formatDate(plan.plan.renewsAt, tz)}.</p>}
          {plan.plan.status === "grace" && plan.plan.graceUntil && (
            <p>Your last payment didn&rsquo;t go through. Pro stays on until <strong>{formatDate(plan.plan.graceUntil, tz, true)}</strong>. After that you&rsquo;ll move to Free and keep all your work.</p>
          )}
          {plan.plan.status === "expired" && <p className="text-muted">Your Pro plan has ended. You&rsquo;re on Free, and everything you made is kept.</p>}
          {plan.plan.status === "pending_activation" && <p className="text-muted">Pro starts as soon as the store confirms your payment. A checkout page alone doesn&rsquo;t switch it on.</p>}
          <div className="flex flex-wrap gap-2 pt-2">
            {plan.billingUrl && <ButtonLink href={plan.billingUrl} variant={plan.plan.status === "grace" ? "primary" : "secondary"}>Manage billing</ButtonLink>}
            {!isPro && plan.checkoutUrl && <ButtonLink href={plan.checkoutUrl} variant="primary">Upgrade to Pro</ButtonLink>}
          </div>
          {!plan.billingUrl && !plan.checkoutUrl && <p className="pt-1 text-xs text-muted">Online checkout isn&rsquo;t connected yet, so plan changes aren&rsquo;t available here.</p>}
        </div>
      </Card>

      <Card>
        <CardHeader title="This month" />
        <div className="space-y-4 p-5 text-sm">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p>
              <span className="text-2xl font-semibold tabular-nums">{formatMinutes(plan.usedMinutes)}</span>
              <span className="text-muted"> of {formatMinutes(plan.allowanceMinutes)} used</span>
            </p>
            <p className="text-muted">Resets {formatDate(plan.resetsAt, tz)}</p>
          </div>
          <Meter used={plan.usedMinutes} total={plan.allowanceMinutes} exhausted={plan.exhausted} />
          <dl className="grid gap-3 sm:grid-cols-3">
            <div>
              <dt className="text-muted">Included left</dt>
              <dd className="font-medium tabular-nums">{formatMinutes(plan.includedRemainingMinutes)}</dd>
            </div>
            <div>
              <dt className="text-muted">Bought hours left</dt>
              <dd className="font-medium tabular-nums">{formatMinutes(plan.purchasedMinutes)}</dd>
            </div>
            <div>
              <dt className="text-muted">Total you can use</dt>
              <dd className="font-medium tabular-nums">{formatMinutes(plan.remainingMinutes)}</dd>
            </div>
          </dl>
          {plan.exhausted && <p role="alert" className="text-danger">You&rsquo;ve used everything for this month, so new recordings can&rsquo;t be processed. Everything you already have stays available.</p>}
          {plan.breakdown.length > 0 && (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {plan.breakdown.map((b) => (
                <li key={b.operation} className="flex justify-between px-4 py-2.5">
                  <span>{b.label}</span>
                  <span className="tabular-nums text-muted">{formatMinutes(b.minutes)}</span>
                </li>
              ))}
            </ul>
          )}
          {plan.inProgress > 0 && (
            <p className="text-muted">
              {plan.inProgress} {plan.inProgress === 1 ? "recording is" : "recordings are"} still being processed. {plan.inProgress === 1 ? "Its" : "Their"} final length isn&rsquo;t known yet, so it isn&rsquo;t counted until it finishes.
            </p>
          )}
          <p className="text-xs text-muted">Minutes are counted when processing finishes, rounded up to the next whole minute. Meeting minutes are counted for the time the assistant was recording.</p>
        </div>
      </Card>

      <Card>
        <CardHeader title="Compare plans" />
        <div className="grid divide-y divide-border sm:grid-cols-2 sm:divide-x sm:divide-y-0">
          {[
            { name: "Free", points: FREE_POINTS, current: !isPro },
            { name: "Pro", points: PRO_POINTS, current: isPro },
          ].map((p) => (
            <div key={p.name} className="space-y-3 p-5 text-sm">
              <p className="flex items-center justify-between font-semibold">
                {p.name}
                {p.current && <Badge tone="info">Your plan</Badge>}
              </p>
              <ul className="space-y-2">
                {p.points.map((x) => (
                  <li key={x} className="flex gap-2">
                    <Check aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                    {x}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader title="Extra hours" />
        <div className="space-y-3 p-5 text-sm">
          <p className="text-muted">Extra hours are used after your monthly allowance runs out. They don&rsquo;t reset each month.</p>
          <ul className="divide-y divide-border rounded-lg border border-border">
            {plan.packs.map((k) => (
              <li key={k.sku} className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="font-medium">{k.label}</span>
                {plan.checkoutUrl ? <ButtonLink href={plan.checkoutUrl}>Buy</ButtonLink> : <span className="text-xs text-muted">Checkout not connected</span>}
              </li>
            ))}
          </ul>
        </div>
      </Card>
    </div>
  );
}
