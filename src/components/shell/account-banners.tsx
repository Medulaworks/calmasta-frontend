"use client";

import Link from "next/link";
import { type DeletionView, type PlanSummary, formatDate } from "@/lib/plan-client";
import { formatMinutes } from "@/lib/status";

type Level = "info" | "warning" | "danger";
const LEVELS: Record<Level, string> = {
  info: "border-accent/30 bg-accent/10",
  warning: "border-warning/40 bg-warning/10",
  danger: "border-danger/40 bg-danger/10",
};

interface Banner {
  id: string;
  level: Level;
  text: string;
  href?: string;
  cta?: string;
}

/** What the account needs the customer to know right now. The wording never promises more than the account has. */
export function bannersFor(plan: PlanSummary | null, deletion: DeletionView | null): Banner[] {
  const out: Banner[] = [];
  if (deletion) {
    const text =
      deletion.status === "requested"
        ? "Your account is set to be deleted. Nothing has been removed yet, and you can still change your mind."
        : deletion.status === "partial_failure"
          ? "Your account deletion is still finishing: some files could not be removed yet. We keep trying, and your account stays until everything is gone."
          : "Your account is being deleted.";
    out.push({ id: "deletion", level: "danger", text, href: "/settings#delete-account", cta: deletion.canCancel ? "Review or cancel" : "See progress" });
  }
  if (!plan) return out;
  if (plan.paused) out.push({ id: "paused", level: "warning", text: "New processing is paused for a short while. Everything you already have is safe, and work already under way will finish." });
  if (plan.plan.status === "grace" && plan.plan.graceUntil) {
    out.push({ id: "grace", level: "warning", text: `Your last payment didn't go through. Pro stays on until ${formatDate(plan.plan.graceUntil, plan.timezone)}. After that you'll move to Free and keep all your work.`, href: plan.billingUrl ?? "/plan", cta: "Fix payment" });
  } else if (plan.plan.status === "expired") {
    out.push({ id: "expired", level: "info", text: "Your Pro plan has ended, so you're on Free. All your recordings, transcripts and documents are kept.", href: "/plan", cta: "See plans" });
  } else if (plan.plan.status === "pending_activation") {
    out.push({ id: "pending", level: "info", text: "We're waiting for the store to confirm your payment. Pro starts as soon as it does.", href: "/plan/confirming", cta: "Check status" });
  }
  if (plan.exhausted) out.push({ id: "exhausted", level: "warning", text: "You've used this month's allowance, so new recordings can't be processed. Everything you have stays available.", href: "/plan", cta: "Buy hours or upgrade" });
  else if (plan.allowanceMinutes > 0 && plan.remainingMinutes <= plan.allowanceMinutes * 0.2) out.push({ id: "low", level: "info", text: `${formatMinutes(plan.remainingMinutes)} left this month.`, href: "/plan", cta: "See usage" });
  return out;
}

export function AccountBanners({ plan, deletion, hide = [] }: { plan: PlanSummary | null; deletion: DeletionView | null; hide?: string[] }) {
  const banners = bannersFor(plan, deletion).filter((b) => !hide.includes(b.id));
  if (banners.length === 0) return null;
  return (
    <div className="mb-6 space-y-2">
      {banners.map((b) => (
        <div key={b.id} role={b.level === "info" ? "status" : "alert"} className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-xl border px-4 py-3 text-sm ${LEVELS[b.level]}`}>
          <p className="min-w-0 flex-1">{b.text}</p>
          {b.href && b.cta && (b.href.startsWith("/") ? (
            <Link href={b.href} className="shrink-0 font-medium underline underline-offset-2">{b.cta}</Link>
          ) : (
            <a href={b.href} className="shrink-0 font-medium underline underline-offset-2" rel="noopener noreferrer">{b.cta}</a>
          ))}
        </div>
      ))}
    </div>
  );
}

/** A small usage reminder for the sidebar. */
export function AllowanceMini({ plan }: { plan: PlanSummary | null }) {
  if (!plan) return null;
  const pct = plan.allowanceMinutes > 0 ? Math.min(100, Math.round((plan.usedMinutes / plan.allowanceMinutes) * 100)) : 100;
  return (
    <Link href="/plan" className="block rounded-lg border border-border bg-background px-3 py-2.5 text-xs transition-colors hover:bg-surface">
      <span className="flex items-center justify-between">
        <span className="font-medium">{plan.plan.plan === "pro" ? "Pro" : "Free"} plan</span>
        <span className="text-muted">{formatMinutes(plan.remainingMinutes)} left</span>
      </span>
      <span aria-hidden className="mt-2 block h-1.5 overflow-hidden rounded-full bg-border">
        <span className={`block h-full rounded-full ${plan.exhausted ? "bg-danger-solid" : "bg-accent-solid"}`} style={{ width: `${pct}%` }} />
      </span>
    </Link>
  );
}
