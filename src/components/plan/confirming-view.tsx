"use client";

import { CheckCircle2, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { type PlanSummary, fetchPlan } from "@/lib/plan-client";

const POLL_MS = 4000;
const GIVE_UP_MS = 90_000;

/**
 * Where the store sends people after checkout. Paying never switches anything on by itself: Pro (or the hours) start
 * only when the store tells us the payment is complete, so this page watches for that and says plainly if it's slow.
 */
export function ConfirmingView() {
  const [plan, setPlan] = useState<PlanSummary | null>(null);
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const start = Date.now();
    const tick = async () => {
      try {
        const p = await fetchPlan();
        if (cancelled) return;
        setPlan(p);
        if (p.plan.plan === "pro" && p.plan.status === "active") return; // done
      } catch {
        /* keep trying until the time runs out */
      }
      if (cancelled) return;
      if (Date.now() - start > GIVE_UP_MS) {
        setSlow(true);
        return;
      }
      timer = setTimeout(() => void tick(), POLL_MS);
    };
    void tick();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  const done = plan?.plan.plan === "pro" && plan.plan.status === "active";

  return (
    <Card className="max-w-2xl">
      <div className="space-y-4 p-6 text-sm" role="status" aria-live="polite">
        {done ? (
          <>
            <p className="flex items-center gap-2 text-lg font-semibold">
              <CheckCircle2 aria-hidden className="h-5 w-5 text-success" /> Pro is on
            </p>
            <p className="text-muted">The store confirmed your payment. Your new allowance is ready to use.</p>
            <ButtonLink href="/plan" variant="primary">See your plan</ButtonLink>
          </>
        ) : slow ? (
          <>
            <p className="text-lg font-semibold">This is taking longer than usual</p>
            <p className="text-muted">We haven&rsquo;t heard from the store yet. If you paid, it will be applied automatically as soon as the store confirms, and you won&rsquo;t be charged twice. You can leave this page.</p>
            <div className="flex gap-2">
              <ButtonLink href="/plan">Back to plan</ButtonLink>
              <ButtonLink href="/dashboard" variant="ghost">Go home</ButtonLink>
            </div>
          </>
        ) : (
          <>
            <p className="flex items-center gap-2 text-lg font-semibold">
              <Loader2 aria-hidden className="h-5 w-5 animate-spin text-accent" /> Waiting for the store
            </p>
            <p className="text-muted">Your payment is being confirmed. This usually takes a few seconds. Nothing changes on your account until the store confirms it.</p>
          </>
        )}
      </div>
    </Card>
  );
}
