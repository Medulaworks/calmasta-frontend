"use client";

import { dashboardPath } from "@/lib/app-routes";

import {
  CreditCard,
  Hourglass,
  PauseCircle,
  Sparkles,
  Timer,
  Trash2,
  Zap,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { buttonClass } from "@/components/ui/button";
import {
  DUMMY_PLAN,
  type DeletionView,
  type PlanSummary,
  formatDate,
  formatNullableMinutes,
  orZero,
} from "@/lib/plan-client";
import { PLAN_LABEL, isPaidPlan } from "@/lib/plan-types";
import { formatMinutes } from "@/lib/status";

type Level = "info" | "warning" | "danger";
// Each level has a soft wash, a left edge, and a tint for its icon and the faint illustration behind it.
const LEVELS: Record<Level, { box: string; edge: string; tint: string }> = {
  info: {
    box: "border-accent/30 bg-accent/5",
    edge: "bg-accent",
    tint: "bg-accent/15 text-accent",
  },
  warning: {
    box: "border-warning/40 bg-warning/5",
    edge: "bg-warning",
    tint: "bg-warning/15 text-warning",
  },
  danger: {
    box: "border-danger/40 bg-danger/5",
    edge: "bg-danger-solid",
    tint: "bg-danger/15 text-danger",
  },
};

interface Banner {
  id: string;
  level: Level;
  /** A short heading above the sentence. */
  title: string;
  text: string;
  href?: string;
  cta?: string;
}

/** What the account needs the customer to know right now. The wording never promises more than the account has. */
export function bannersFor(
  plan: PlanSummary | null,
  deletion: DeletionView | null,
): Banner[] {
  const out: Banner[] = [];
  if (deletion) {
    const text =
      deletion.status === "requested"
        ? "Your account is set to be deleted. Nothing has been removed yet, and you can still change your mind."
        : deletion.status === "partial_failure"
          ? "Your account is still being deleted. A few files couldn’t be removed yet, so we’re trying again. Your account stays until everything is gone."
          : "Your account is being deleted.";
    out.push({
      id: "deletion",
      level: "danger",
      title:
        deletion.status === "requested"
          ? "Account set to be deleted"
          : "Account deletion in progress",
      text,
      href: "/dashboard/settings#delete-account",
      cta: deletion.canCancel ? "Review or cancel" : "See progress",
    });
  }
  if (!plan) return out;
  if (plan.paused)
    out.push({
      id: "paused",
      level: "warning",
      title: "Processing is paused",
      text: "New processing is paused for a short while. Everything you already have is safe, and work already under way will finish.",
    });
  if (plan.plan.status === "grace" && plan.plan.graceUntil) {
    out.push({
      id: "grace",
      level: "warning",
      title: "Payment needs attention",
      text: `Your last payment didn’t go through. ${PLAN_LABEL[plan.plan.plan]} stays on until ${formatDate(plan.plan.graceUntil, plan.timezone)}. After that you’ll move to Free and keep all your work.`,
      href: plan.billingUrl ?? "/dashboard/plan",
      cta: "Fix payment",
    });
  } else if (plan.plan.status === "expired") {
    out.push({
      id: "expired",
      level: "info",
      title: "Your plan has ended",
      text: "Your paid plan has ended, so you’re on Free. All your recordings, transcripts and documents are kept.",
      href: "/dashboard/plan",
      cta: "See plans",
    });
  } else if (plan.plan.status === "pending_activation") {
    out.push({
      id: "pending",
      level: "info",
      title: "Waiting for payment",
      text: "We’re waiting for the store to confirm your payment. Your plan starts as soon as it does.",
      href: "/dashboard/plan/confirming",
      cta: "Check status",
    });
  }
  if (plan.exhausted)
    out.push({
      id: "exhausted",
      level: "warning",
      title: "Allowance used up",
      text:
        (plan.reservedMinutes ?? 0) > 0
          ? "Your allowance is fully reserved or used. Part of it is held for recordings still being processed or waiting on billing confirmation, so new recordings can’t start until time frees up. See Plan and usage for the breakdown."
          : "You’ve used this month’s allowance, so new recordings can’t be processed. Everything you’ve saved stays available until its retention period ends.",
      href: "/dashboard/plan",
      cta: "Buy hours or upgrade",
    });
  else if (
    orZero(plan.allowanceMinutes) > 0 &&
    orZero(plan.remainingMinutes) <= orZero(plan.allowanceMinutes) * 0.2
  )
    out.push({
      id: "low",
      level: "info",
      title: "Running low this month",
      text: `${formatNullableMinutes(plan.remainingMinutes)} left this month.`,
      href: "/dashboard/plan",
      cta: "See usage",
    });
  return out;
}

export function AccountBanners({
  plan,
  deletion,
  hide = [],
}: {
  plan: PlanSummary | null;
  deletion: DeletionView | null;
  hide?: string[];
}) {
  const banners = bannersFor(plan, deletion).filter(
    (b) => !hide.includes(b.id),
  );
  if (banners.length === 0) return null;
  return (
    <div className="mb-5 space-y-3">
      {banners.map((b) => {
        const lv = LEVELS[b.level];
        const Icon = ICONS[b.id] ?? Zap;
        const cta =
          b.href && b.cta ? (
            b.href.startsWith("/") ? (
              <Link
                href={dashboardPath(b.href)}
                className={buttonClass(
                  b.level === "info" ? "secondary" : "primary",
                  "shrink-0",
                  "sm",
                )}>
                {b.cta}
              </Link>
            ) : (
              <a
                href={dashboardPath(b.href)}
                rel="noopener noreferrer"
                className={buttonClass(
                  b.level === "info" ? "secondary" : "primary",
                  "shrink-0",
                  "sm",
                )}>
                {b.cta}
              </a>
            )
          ) : null;
        return (
          <div
            key={b.id}
            role={b.level === "info" ? "status" : "alert"}
            className={`relative isolate flex flex-wrap items-center gap-x-4 gap-y-3 overflow-hidden rounded-2xl border py-4 pl-5 pr-4 ${lv.box}`}>
            <span
              aria-hidden
              className={`absolute inset-y-0 left-0 w-1 ${lv.edge}`}
            />
            {/* A faint set of rings and ticks, like a dial, behind the right-hand side. Decoration only. */}
            <svg
              aria-hidden
              viewBox="0 0 240 120"
              fill="none"
              className={`pointer-events-none absolute inset-y-0 right-0 -z-10 h-full w-1/2 max-w-sm opacity-40 ${lv.tint.split(" ")[1]}`}
              style={{
                maskImage: "linear-gradient(to left, black, transparent)",
                WebkitMaskImage: "linear-gradient(to left, black, transparent)",
              }}
              preserveAspectRatio="xMaxYMid slice">
              {[28, 52, 76, 100].map((r) => (
                <circle
                  key={r}
                  cx="200"
                  cy="60"
                  r={r}
                  stroke="currentColor"
                  strokeOpacity={0.35 - r / 400}
                  strokeWidth="1.5"
                />
              ))}
              {Array.from({ length: 12 }, (_, i) => {
                const a = (i / 12) * Math.PI * 2;
                return (
                  <line
                    key={i}
                    x1={200 + Math.cos(a) * 28}
                    y1={60 + Math.sin(a) * 28}
                    x2={200 + Math.cos(a) * 36}
                    y2={60 + Math.sin(a) * 36}
                    stroke="currentColor"
                    strokeOpacity="0.5"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                );
              })}
            </svg>
            <span
              aria-hidden
              className={`grid size-10 shrink-0 place-items-center rounded-xl ${lv.tint}`}>
              <Icon className="size-5" />
            </span>
            <div className="min-w-0 flex-1 basis-64">
              <p className="text-sm font-semibold">{b.title}</p>
              <p className="mt-0.5 text-sm text-muted">{b.text}</p>
            </div>
            {cta}
          </div>
        );
      })}
    </div>
  );
}

const ICONS: Record<string, LucideIcon> = {
  deletion: Trash2,
  paused: PauseCircle,
  grace: CreditCard,
  expired: Timer,
  pending: Hourglass,
  exhausted: Hourglass,
  low: Timer,
};

type Health = "ok" | "low" | "out" | "grace" | "pending";

/** How the allowance is doing, in one word, so the card can colour and word itself. */
function healthOf(plan: PlanSummary): Health {
  if (plan.plan.status === "grace") return "grace";
  if (plan.plan.status === "pending_activation") return "pending";
  if (plan.exhausted) return "out";
  const total = orZero(plan.allowanceMinutes) + orZero(plan.purchasedMinutes);
  return total > 0 && orZero(plan.remainingMinutes) <= total * 0.2
    ? "low"
    : "ok";
}

const FILL: Record<Health, string> = {
  ok: "bg-sidebar-active-fg",
  low: "bg-amber-300",
  out: "bg-danger-solid",
  grace: "bg-amber-300",
  pending: "bg-sidebar-active-fg",
};

/** A ring for the icon-only rail: how much of the allowance is left. */
function Ring({ pct, health }: { pct: number; health: Health }) {
  const r = 15,
    c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 40 40" className="h-10 w-10 -rotate-90" aria-hidden>
      <circle
        cx="20"
        cy="20"
        r={r}
        fill="none"
        strokeWidth="3.5"
        className="stroke-sidebar-fg/20"
      />
      <circle
        cx="20"
        cy="20"
        r={r}
        fill="none"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - Math.max(0, Math.min(100, pct)) / 100)}
        className={
          health === "out"
            ? "stroke-danger"
            : health === "low" || health === "grace"
              ? "stroke-amber-300"
              : "stroke-sidebar-active-fg"
        }
      />
    </svg>
  );
}

/**
 * The plan card at the foot of the sidebar: which plan, how much is left this month, when it resets, and the way to
 * upgrade. In the narrow rail it shrinks to a ring with the same facts in its tooltip.
 */
/**
 * Before the plan fetch lands (and only then) the card shows zeros, so it
 * never flashes the dummy minutes as if they were the customer's allowance.
 */
const ZERO_PLAN: PlanSummary = {
  ...DUMMY_PLAN,
  allowanceMinutes: 0,
  usedMinutes: 0,
  reservedMinutes: 0,
  includedUsedMinutes: 0,
  includedReservedMinutes: 0,
  includedRemainingMinutes: 0,
  purchasedMinutes: 0,
  remainingMinutes: 0,
  inProgress: 0,
};

export function SidebarPlanCard({ plan }: { plan: PlanSummary | null }) {
  const displayPlan = plan ?? ZERO_PLAN;
  const pro = isPaidPlan(displayPlan.plan.plan);
  const planName = PLAN_LABEL[displayPlan.plan.plan];
  const health = healthOf(displayPlan);
  const total =
    orZero(displayPlan.allowanceMinutes) + orZero(displayPlan.purchasedMinutes);
  const leftPct =
    total > 0
      ? Math.round((orZero(displayPlan.remainingMinutes) / total) * 100)
      : 0;
  const usedPct = 100 - leftPct;
  const headline =
    health === "out"
      ? "Allowance used up"
      : health === "grace"
        ? "Payment needs attention"
        : health === "pending"
          ? "Waiting for payment"
          : `${formatNullableMinutes(displayPlan.remainingMinutes)} left`;
  const cta =
    health === "out"
      ? "Buy hours or upgrade"
      : health === "grace"
        ? "Fix payment"
        : health === "pending"
          ? "Check status"
          : pro
            ? "Manage plan"
            : "Upgrade to Pro";
  const href =
    health === "pending" ? "/dashboard/plan/confirming" : "/dashboard/plan";
  const label = `${planName} plan, ${headline}${displayPlan.exhausted ? "" : ` of ${formatMinutes(total)}`}. ${cta}.`;

  return (
    <>
      {/* The full card */}
      <div className="relative mb-1 overflow-hidden rounded-xl border border-sidebar-border bg-gradient-to-br from-sidebar-active-fg/25 via-black/10 to-black/25 p-2.5 sc:md:hidden">
        <span
          aria-hidden
          className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-sidebar-active-fg/15 blur-2xl"
        />
        <div className="relative flex items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-[13px] font-semibold text-sidebar-fg">
            {pro ? (
              <Sparkles
                aria-hidden
                className="h-4 w-4 text-sidebar-active-fg"
              />
            ) : (
              <Zap aria-hidden className="h-4 w-4 text-sidebar-active-fg" />
            )}
            {planName} plan
          </p>
          <span className="rounded-full bg-sidebar-fg/15 px-2 py-1 text-[9px] font-semibold uppercase tracking-wide text-sidebar-fg">
            {health === "out"
              ? "Used up"
              : health === "low"
                ? "Running low"
                : health === "grace"
                  ? "Action needed"
                  : health === "pending"
                    ? "Pending"
                    : "Active"}
          </span>
        </div>
        <p className="relative mt-2.5 text-lg font-semibold leading-none tracking-tight text-sidebar-fg tabular-nums">
          {headline}
        </p>
        {!displayPlan.exhausted &&
          health !== "grace" &&
          health !== "pending" && (
            <p className="relative mt-1 text-[11px] text-sidebar-muted">
              of {formatMinutes(total)} this month
            </p>
          )}
        <div
          role="progressbar"
          aria-label="Allowance used this month"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={usedPct}
          className="relative mt-2.5 h-1.5 overflow-hidden rounded-full bg-sidebar-fg/20">
          <div
            className={`h-full rounded-full transition-[width] ${FILL[health]}`}
            style={{
              width: `${Math.max(usedPct, displayPlan.exhausted ? 100 : 3)}%`,
            }}
          />
        </div>
        <p className="relative mt-1.5 text-[11px] text-sidebar-muted">
          Resets {formatDate(displayPlan.resetsAt, displayPlan.timezone)}
        </p>
        <Link
          href={dashboardPath(href)}
          className="relative mt-2.5 flex w-full items-center justify-center gap-2 rounded-lg bg-sidebar-fg px-3 py-2 text-[13px] font-semibold text-sidebar transition-opacity hover:opacity-90">
          {pro && health === "ok" ? null : (
            <Zap aria-hidden className="h-4 w-4" />
          )}{" "}
          {cta}
        </Link>
      </div>

      {/* The rail: a ring that opens the plan page */}
      <Link
        href={dashboardPath(href)}
        aria-label={label}
        className="group relative mb-1 hidden h-12 w-12 items-center justify-center self-center rounded-xl transition-colors hover:bg-sidebar-active/60 sc:md:flex">
        <Ring pct={leftPct} health={health} />
        <span className="absolute inset-0 grid place-items-center text-sidebar-fg">
          {pro ? (
            <Sparkles aria-hidden className="h-4 w-4" />
          ) : (
            <Zap aria-hidden className="h-4 w-4" />
          )}
        </span>
        <span
          aria-hidden
          className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 hidden -translate-y-1/2 whitespace-nowrap rounded-md bg-foreground px-2 py-2 text-xs font-medium text-background shadow-lg group-hover:block group-focus-visible:block">
          {planName} plan · {headline}
        </span>
      </Link>
    </>
  );
}
