"use client";

import { Sparkles, Zap } from "lucide-react";
import Link from "next/link";
import { type DeletionView, type PlanSummary, formatDate } from "@/lib/plan-client";
import { PLAN_LABEL, isPaidPlan } from "@/lib/plan-types";
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
    out.push({ id: "grace", level: "warning", text: `Your last payment didn't go through. ${PLAN_LABEL[plan.plan.plan]} stays on until ${formatDate(plan.plan.graceUntil, plan.timezone)}. After that you'll move to Free and keep all your work.`, href: plan.billingUrl ?? "/plan", cta: "Fix payment" });
  } else if (plan.plan.status === "expired") {
    out.push({ id: "expired", level: "info", text: "Your paid plan has ended, so you're on Free. All your recordings, transcripts and documents are kept.", href: "/plan", cta: "See plans" });
  } else if (plan.plan.status === "pending_activation") {
    out.push({ id: "pending", level: "info", text: "We're waiting for the store to confirm your payment. Your plan starts as soon as it does.", href: "/plan/confirming", cta: "Check status" });
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

type Health = "ok" | "low" | "out" | "grace" | "pending";

/** How the allowance is doing, in one word, so the card can colour and word itself. */
function healthOf(plan: PlanSummary): Health {
  if (plan.plan.status === "grace") return "grace";
  if (plan.plan.status === "pending_activation") return "pending";
  if (plan.exhausted) return "out";
  const total = plan.allowanceMinutes + plan.purchasedMinutes;
  return total > 0 && plan.remainingMinutes <= total * 0.2 ? "low" : "ok";
}

const FILL: Record<Health, string> = { ok: "bg-sidebar-active-fg", low: "bg-amber-300", out: "bg-danger-solid", grace: "bg-amber-300", pending: "bg-sidebar-active-fg" };

/** A ring for the icon-only rail: how much of the allowance is left. */
function Ring({ pct, health }: { pct: number; health: Health }) {
  const r = 15, c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 40 40" className="h-10 w-10 -rotate-90" aria-hidden>
      <circle cx="20" cy="20" r={r} fill="none" strokeWidth="3.5" className="stroke-sidebar-fg/20" />
      <circle cx="20" cy="20" r={r} fill="none" strokeWidth="3.5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - Math.max(0, Math.min(100, pct)) / 100)} className={health === "out" ? "stroke-danger" : health === "low" || health === "grace" ? "stroke-amber-300" : "stroke-sidebar-active-fg"} />
    </svg>
  );
}

/**
 * The plan card at the foot of the sidebar: which plan, how much is left this month, when it resets, and the way to
 * upgrade. In the narrow rail it shrinks to a ring with the same facts in its tooltip.
 */
export function SidebarPlanCard({ plan }: { plan: PlanSummary | null }) {
  if (!plan) {
    return <div aria-hidden className="mb-1 h-[7.5rem] animate-pulse rounded-xl bg-black/15 sc:md:h-12 sc:md:w-12 sc:md:self-center" />;
  }
  const pro = isPaidPlan(plan.plan.plan);
  const planName = PLAN_LABEL[plan.plan.plan];
  const health = healthOf(plan);
  const total = plan.allowanceMinutes + plan.purchasedMinutes;
  const leftPct = total > 0 ? Math.round((plan.remainingMinutes / total) * 100) : 0;
  const usedPct = 100 - leftPct;
  const headline =
    health === "out" ? "Allowance used up"
    : health === "grace" ? "Payment needs attention"
    : health === "pending" ? "Waiting for payment"
    : `${formatMinutes(plan.remainingMinutes)} left`;
  const cta = health === "out" ? "Buy hours or upgrade" : health === "grace" ? "Fix payment" : health === "pending" ? "Check status" : pro ? "Manage plan" : "Upgrade to Pro";
  const href = health === "pending" ? "/plan/confirming" : "/plan";
  const label = `${planName} plan, ${headline}${plan.exhausted ? "" : ` of ${formatMinutes(total)}`}. ${cta}.`;

  return (
    <>
      {/* The full card */}
      <div className="relative mb-1 overflow-hidden rounded-xl border border-sidebar-border bg-gradient-to-br from-sidebar-active-fg/25 via-black/10 to-black/25 p-3 sc:md:hidden">
        <span aria-hidden className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-sidebar-active-fg/15 blur-2xl" />
        <div className="relative flex items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-sidebar-fg">
            {pro ? <Sparkles aria-hidden className="h-4 w-4 text-sidebar-active-fg" /> : <Zap aria-hidden className="h-4 w-4 text-sidebar-active-fg" />}
            {planName} plan
          </p>
          <span className="rounded-full bg-sidebar-fg/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-sidebar-fg">{health === "out" ? "Used up" : health === "low" ? "Running low" : health === "grace" ? "Action needed" : health === "pending" ? "Pending" : "Active"}</span>
        </div>
        <p className="relative mt-3 text-xl font-semibold leading-none tracking-tight text-sidebar-fg tabular-nums">{headline}</p>
        {!plan.exhausted && health !== "grace" && health !== "pending" && <p className="relative mt-1 text-xs text-sidebar-muted">of {formatMinutes(total)} this month</p>}
        <div role="progressbar" aria-label="Allowance used this month" aria-valuemin={0} aria-valuemax={100} aria-valuenow={usedPct} className="relative mt-3 h-2 overflow-hidden rounded-full bg-sidebar-fg/20">
          <div className={`h-full rounded-full transition-[width] ${FILL[health]}`} style={{ width: `${Math.max(usedPct, plan.exhausted ? 100 : 3)}%` }} />
        </div>
        <p className="relative mt-2 text-xs text-sidebar-muted">Resets {formatDate(plan.resetsAt, plan.timezone)}</p>
        <Link href={href} className="relative mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-sidebar-fg px-3 py-2 text-sm font-semibold text-sidebar transition-opacity hover:opacity-90">
          {pro && health === "ok" ? null : <Zap aria-hidden className="h-3.5 w-3.5" />} {cta}
        </Link>
      </div>

      {/* The rail: a ring that opens the plan page */}
      <Link href={href} aria-label={label} className="group relative mb-1 hidden h-12 w-12 items-center justify-center self-center rounded-xl transition-colors hover:bg-sidebar-active/60 sc:md:flex">
        <Ring pct={leftPct} health={health} />
        <span className="absolute inset-0 grid place-items-center text-sidebar-fg">{pro ? <Sparkles aria-hidden className="h-4 w-4" /> : <Zap aria-hidden className="h-4 w-4" />}</span>
        <span aria-hidden className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 hidden -translate-y-1/2 whitespace-nowrap rounded-md bg-foreground px-2 py-1.5 text-xs font-medium text-background shadow-lg group-hover:block group-focus-visible:block">
          {planName} plan · {headline}
        </span>
      </Link>
    </>
  );
}
