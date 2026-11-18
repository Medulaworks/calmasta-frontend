"use client";

import { dashboardPath } from "@/lib/app-routes";

import { AlertTriangle, ArrowRight, Check, Clock, Info, Zap } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { type CreditPackView, type PlanSummary, fetchPlan, formatDate, formatNullableMinutes, totalRemainingMinutes } from "@/lib/plan-client";
import { PLAN_LABEL, type PaidPlanId, isPaidPlan } from "@/lib/plan-types";
import { annualPrice, formatPrice, yearlyTotal } from "@/lib/pricing";
import { formatMinutes } from "@/lib/status";

type Billing = "monthly" | "annual";

/** The month's allowance as one bar: solid for minutes already used, striped for minutes held back for recordings still being processed. */
function Meter({ used, reserved, total, exhausted }: { used: number; reserved: number; total: number; exhausted: boolean }) {
  const pct = (n: number) => (total > 0 ? Math.min(100, (n / total) * 100) : 0);
  const usedPct = exhausted && total <= 0 ? 100 : pct(used);
  const reservedPct = Math.min(100 - usedPct, pct(reserved));
  return (
    <div
      role="progressbar"
      aria-label="Allowance used or reserved this month"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={Math.min(used + reserved, total)}
      aria-valuetext={`${used} minutes used and ${reserved} reserved, of ${total}`}
      className="flex h-2 overflow-hidden rounded-full bg-border">
      <div className={`h-full ${exhausted ? "bg-danger-solid" : "bg-accent-solid"}`} style={{ width: `${usedPct}%` }} />
      {reservedPct > 0 && (
        <div
          className={`h-full ${exhausted ? "text-danger-solid" : "text-accent-solid"}`}
          style={{ width: `${reservedPct}%`, backgroundImage: "repeating-linear-gradient(135deg, currentColor 0 4px, transparent 4px 8px)", opacity: 0.55 }}
        />
      )}
    </div>
  );
}

/** Where "buy this" goes: the store's link, or in development the built-in test checkout; null when neither exists. */
function checkoutHref(
  plan: PlanSummary,
  which: PaidPlanId,
  annual: boolean,
): string | null {
  const real =
    which === "business"
      ? annual
        ? plan.checkoutUrlBusinessAnnual
        : plan.checkoutUrlBusiness
      : annual
        ? plan.checkoutUrlAnnual
        : plan.checkoutUrl;
  if (real) return real;
  return plan.testCheckout
    ? `/dashboard/plan/test-checkout?plan=${which}&period=${annual ? "annual" : "monthly"}`
    : null;
}

/** One plan: name, one line, price, the action, and a short list. The recommended one gets an accent edge. */
function PlanCard({ name, current = false, highlight = false, badge, blurb, price, priceNote, action, points }: {
  name: string; current?: boolean; highlight?: boolean; badge?: string; blurb: string; price: React.ReactNode; priceNote: string; action: React.ReactNode; points: string[];
}) {
  const id = useId();
  return (
    <section aria-labelledby={id} className={`flex flex-col rounded-2xl border bg-background p-5 shadow-sm ${highlight ? "border-accent-solid ring-1 ring-accent-solid/30" : "border-border"}`}>
      <div className="flex items-center gap-2">
        <h3 id={id} className="text-base font-semibold">{name}</h3>
        {current && <Badge tone="success">Current</Badge>}
        {badge && !current && <span className="rounded-full bg-accent-solid/15 px-2 py-0.5 text-xs font-medium text-accent">{badge}</span>}
      </div>
      <p className="mt-1 min-h-10 text-sm text-muted">{blurb}</p>
      <p className="mt-4 text-3xl font-semibold tracking-tight tabular-nums">{price}</p>
      <p className="mt-1 text-sm text-muted">{priceNote}</p>
      <div className="mt-5">{action}</div>
      <ul className="mt-5 space-y-3 border-t border-border pt-5 text-sm">
        {points.map((p, i) => (
          <li key={p} className="flex gap-3">
            <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-accent" strokeWidth={2.5} />
            <span className={i === 0 ? "font-medium" : ""}>{p}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

const quiet = `${buttonClass("secondary", "w-full")} pointer-events-none text-muted`;
const wide = "w-full";

type NoteTone = "info" | "warning" | "danger" | "neutral";
const NOTE: Record<NoteTone, string> = {
  info: "border-accent/30 bg-accent/5",
  warning: "border-warning/40 bg-warning/5",
  danger: "border-danger/40 bg-danger/5",
  neutral: "border-border bg-surface",
};
/** A short, quiet message about the account. Same look for all of them, so the page never turns into a stack of coloured boxes. */
function Note({ tone = "neutral", role = "status", children }: { tone?: NoteTone; role?: "status" | "alert" | "note"; children: React.ReactNode }) {
  const Icon = tone === "warning" || tone === "danger" ? AlertTriangle : Info;
  return (
    <p role={role} className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${NOTE[tone]}`}>
      <Icon aria-hidden className="mt-0.5 size-4 shrink-0 text-muted" />
      <span>{children}</span>
    </p>
  );
}

function BillingToggle({
  value,
  onChange,
  discount,
}: {
  value: Billing;
  onChange: (b: Billing) => void;
  discount: number;
}) {
  const opt = (id: Billing, label: string, pill?: string) => (
    <button
      type="button"
      role="radio"
      aria-checked={value === id}
      onClick={() => onChange(id)}
      className={`flex h-8 items-center gap-2 rounded-lg px-4 text-sm transition-colors ${value === id ? "bg-background font-medium text-foreground shadow-sm ring-1 ring-border" : "text-muted hover:text-foreground"}`}>
      {label}
      {pill && (
        <span className="rounded bg-success/15 px-2 py-1 text-xs font-medium text-success">
          {pill}
        </span>
      )}
    </button>
  );
  return (
    <div
      role="radiogroup"
      aria-label="Billing period"
      className="flex w-fit items-center gap-1 rounded-xl bg-surface p-1 ring-1 ring-border">
      {opt("monthly", "Monthly")}
      {opt("annual", "Yearly", discount > 0 ? `${discount}% off` : undefined)}
    </div>
  );
}

export function PlanView() {
  const [plan, setPlan] = useState<PlanSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [billing, setBilling] = useState<Billing>("annual");

  useEffect(() => {
    let cancelled = false;
    fetchPlan().then(
      (p) => !cancelled && setPlan(p),
      (e) => !cancelled && setError(e instanceof Error ? e.message : "We couldn’t load your plan. Please try again."),
    );
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return <p role="alert" className="text-sm text-danger">{error}</p>;
  if (!plan)
    return (
      <div role="status" aria-label="Loading" aria-busy="true" className="space-y-5">
        <div className="h-56 jb-skel rounded-2xl border border-border bg-surface" />
        <div className="grid gap-4 md:grid-cols-3">
          {[0, 1, 2].map((i) => <div key={i} className="h-96 jb-skel rounded-2xl border border-border bg-surface" />)}
        </div>
      </div>
    );

  const current = plan.plan.plan;
  const paid = isPaidPlan(current);
  const tz = plan.timezone;
  const pricing = plan.pricing;
  const annual = billing === "annual";
  const proPerMonth = pricing ? (annual ? annualPrice(pricing.proMonthly, pricing.annualDiscountPct) : pricing.proMonthly) : 0;
  const businessPerMonth = pricing ? (annual ? annualPrice(pricing.businessMonthly, pricing.annualDiscountPct) : pricing.businessMonthly) : 0;
  const pending = plan.plan.status === "pending_activation";
  const grace = plan.plan.status === "grace";
  const paused = plan.paused;
  const label = PLAN_LABEL[current];

  const freeH = formatNullableMinutes(plan.freeAllowanceMinutes);
  const proH = formatNullableMinutes(plan.proAllowanceMinutes);
  const businessH = formatNullableMinutes(plan.businessAllowanceMinutes);

  /** The action for a paid plan's card, from where the customer is now. */
  const paidAction = (which: PaidPlanId): React.ReactNode => {
    const name = PLAN_LABEL[which];
    if (current === which) {
      return plan.billingUrl ? (
        <Link href={dashboardPath(plan.billingUrl)} className={buttonClass(grace ? "primary" : "secondary", wide)}>
          {grace ? "Fix payment" : "Manage billing"}
        </Link>
      ) : (
        <span className={quiet}>Current plan</span>
      );
    }
    if (pending)
      return (
        <Link href="/dashboard/plan/confirming" className={buttonClass("secondary", wide)}>
          <Clock aria-hidden className="size-4" /> Waiting for payment
        </Link>
      );
    const href = checkoutHref(plan, which, annual);
    // Moving between paid plans is a switch; from Free it is an upgrade. Business is the step up from Pro, so "Switch to Pro" is the quieter button.
    const stepDown = paid && which === "pro";
    if (href)
      return (
        <Link href={dashboardPath(href)} className={buttonClass(stepDown ? "secondary" : "primary", wide)}>
          {paid ? `Switch to ${name}` : `Upgrade to ${name}`}
        </Link>
      );
    return <span aria-disabled="true" className={quiet}>Upgrade to {name}</span>;
  };
  const checkoutMissing = !checkoutHref(plan, "pro", annual) && !checkoutHref(plan, "business", annual) && !pending;
  const yearlyOnlyMissing = annual && (plan.checkoutUrl || plan.checkoutUrlBusiness);

  // Extra hours are bought through the capability-aware billing flow, which shows each offer's availability from the server catalogue.
  const packHref = () => "/dashboard/billing";

  const reserved = plan.reservedMinutes ?? 0;
  const status = plan.exhausted ? { tone: "danger" as const, text: "Used up" } : grace ? { tone: "warning" as const, text: "Payment needed" } : pending ? { tone: "info" as const, text: "Pending" } : { tone: "success" as const, text: "Active" };

  const notices: React.ReactNode[] = [];
  if (plan.placeholder) notices.push(<Note key="ph" tone="warning" role="note">Prices, allowances and hour packs shown here are placeholders until pricing is confirmed.</Note>);
  if (grace) notices.push(<Note key="grace" tone="warning" role="alert">Your last payment didn&rsquo;t go through. {label} stays on for the 5-day grace period{plan.plan.graceUntil ? <> until <strong>{formatDate(plan.plan.graceUntil, tz, true)}</strong></> : null}. After that you&rsquo;ll move to Free and keep all your work.</Note>);
  if (paused) notices.push(<Note key="paused" tone="warning" role="alert">Processing is paused on your workspace, so new recordings can&rsquo;t be processed right now. Everything you&rsquo;ve already made is kept.</Note>);
  if (pending) notices.push(<Note key="pending" tone="info">Your plan starts as soon as the store confirms your payment. A checkout page alone doesn&rsquo;t switch it on.</Note>);
  if (plan.plan.status === "expired" || plan.plan.status === "cancelled" || plan.plan.status === "refunded") notices.push(<Note key="ended">Your paid plan has ended, so you&rsquo;re on Free. Everything you made is kept.</Note>);
  if (plan.plan.status === "pending-cancel" && plan.plan.renewsAt) notices.push(<Note key="pc">{label} ends on {formatDate(plan.plan.renewsAt, tz)} and won&rsquo;t renew. Everything you made is kept.</Note>);
  if (paid && plan.plan.status === "active" && plan.plan.renewsAt) notices.push(<Note key="renew">{label} renews or ends on {formatDate(plan.plan.renewsAt, tz)}.</Note>);

  return (
    <div className="space-y-5">
      {notices.length > 0 && <div className="space-y-3">{notices}</div>}

      {/* Where you are: the plan, what is left, and the ways to get more. */}
      <Card>
        <div className="space-y-5 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span aria-hidden className="grid size-10 place-items-center rounded-xl bg-accent-solid/15 text-accent"><Zap className="size-5" /></span>
              <div>
                <p className="flex items-center gap-2 text-base font-semibold">{label} plan <Badge tone={status.tone}>{status.text}</Badge></p>
                <p className="text-sm text-muted">Resets {formatDate(plan.resetsAt, tz)}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href={packHref()} className={buttonClass(plan.exhausted ? "primary" : "secondary", "", "sm")}>Buy extra hours</Link>
              {plan.billingUrl && <Link href={dashboardPath(plan.billingUrl)} className={buttonClass("secondary", "", "sm")}>Manage billing</Link>}
            </div>
          </div>

          <div>
            <p className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-4xl font-semibold tracking-tight tabular-nums">{plan.exhausted ? "Used up" : formatNullableMinutes(totalRemainingMinutes(plan))}</span>
              <span className="text-sm text-muted">{plan.exhausted ? (reserved > 0 ? "all used or reserved" : "for this month") : "left to use"}</span>
            </p>
            <div className="mt-3"><Meter used={plan.usedMinutes} reserved={reserved} total={plan.allowanceMinutes ?? 0} exhausted={plan.exhausted ?? false} /></div>
            <p className="mt-2 text-sm text-muted tabular-nums">
              {formatMinutes(plan.usedMinutes)} used{reserved > 0 ? <>, {formatMinutes(reserved)} <span className="whitespace-nowrap">reserved</span> for recordings still being processed</> : null} · of {formatNullableMinutes(plan.allowanceMinutes)} this month
            </p>
          </div>

          <dl className={`grid divide-y divide-border rounded-xl border border-border text-sm sm:divide-x sm:divide-y-0 ${reserved > 0 ? "sm:grid-cols-4" : "sm:grid-cols-3"}`}>
            {[
              ["Included left", formatNullableMinutes(plan.includedRemainingMinutes)],
              ...(reserved > 0 ? [["Reserved", formatMinutes(reserved)]] : []),
              ["Bought hours left", formatNullableMinutes(plan.purchasedMinutes)],
              ["Total you can use", formatNullableMinutes(totalRemainingMinutes(plan))],
            ].map(([k, v]) => (
              <div key={k} className="px-4 py-3">
                <dt className="text-muted">{k}</dt>
                <dd className="mt-1 text-base font-semibold tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
          {plan.exhausted && <p role="alert" className="text-sm text-danger">You&rsquo;ve used everything for this month, so new recordings can&rsquo;t be processed. Everything you already have stays available.</p>}
        </div>
      </Card>

      {/* Compare plans. */}
      <section aria-labelledby="compare-heading" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="compare-heading" className="text-base font-semibold">Compare plans</h2>
          <BillingToggle value={billing} onChange={setBilling} discount={pricing?.annualDiscountPct ?? 0} />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <PlanCard
            name="Free"
            current={current === "free"}
            blurb="For trying Joobah and for occasional recordings."
            price={pricing ? formatPrice(pricing.currency, 0) : "Free"}
            priceNote="No card needed"
            action={<span className={quiet}>{current === "free" ? "Current plan" : "Included with every account"}</span>}
            points={[
              `${freeH} of processing each month`,
              "Voice notes, uploads and meeting captures",
              "Transcripts you can read and correct",
              "Documents from templates, with search and action items",
              "Calendar and public booking pages",
            ]}
          />
          <PlanCard
            name="Pro"
            current={current === "pro"}
            highlight
            badge="Most popular"
            blurb="For people who record and write up conversations every week."
            price={pricing ? formatPrice(pricing.currency, proPerMonth) : <span className="text-xl font-medium text-muted">Coming soon</span>}
            priceNote={pricing ? (annual ? `per month, billed yearly (${formatPrice(pricing.currency, yearlyTotal(proPerMonth))})` : "per month, billed monthly") : "Pricing isn’t available yet."}
            action={paidAction("pro")}
            points={[
              `${proH} of processing each month`,
              "Everything in Free",
              "A far larger allowance for busy weeks",
              "Extra-hour packs that don’t reset",
            ]}
          />
          <PlanCard
            name="Business"
            current={current === "business"}
            blurb="For people who record all day, every day, and never want to count hours."
            price={pricing ? formatPrice(pricing.currency, businessPerMonth) : <span className="text-xl font-medium text-muted">Coming soon</span>}
            priceNote={pricing ? (annual ? `per month, billed yearly (${formatPrice(pricing.currency, yearlyTotal(businessPerMonth))})` : "per month, billed monthly") : "Pricing isn’t available yet."}
            action={paidAction("business")}
            points={[
              `${businessH} of processing each month`,
              "Everything in Pro",
              "Room for back-to-back meetings and daily recording",
              "The same extra-hour packs, if you ever need more",
            ]}
          />
        </div>
        <p className="text-center text-xs text-muted">
          {checkoutMissing ? (yearlyOnlyMissing ? "Yearly billing isn’t available yet. " : "Checkout isn’t connected yet. ") : ""}
          If a paid plan ever ends you move to Free and keep everything you made. Shared workspaces and team members are planned for Business.{" "}
          {plan.enterpriseUrl ? (
            <Link href={dashboardPath(plan.enterpriseUrl)} className="font-medium text-accent underline underline-offset-2">Need custom terms? Talk to us.</Link>
          ) : (
            "Need custom terms? Ask us once team features arrive."
          )}
        </p>
      </section>

      {/* Extra hours, and how this month's minutes were counted. */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Extra hours" />
          <div className="space-y-3 p-5 text-sm">
            <p className="text-muted">Extra hours are used after your monthly allowance runs out. They don&rsquo;t reset each month.</p>
            <ul className="divide-y divide-border rounded-xl border border-border">
              {plan.packs.map((k) => (
                <li key={k.sku} className="flex items-center justify-between gap-3 px-4 py-3">
                  <span className="font-medium">{k.label}</span>
                  <Link href={packHref()} className={buttonClass("secondary", "", "sm")}>Buy <ArrowRight aria-hidden className="size-4" /></Link>
                </li>
              ))}
            </ul>
          </div>
        </Card>

        <Card>
          <CardHeader title="Where your minutes went" />
          <div className="space-y-3 p-5 text-sm">
            {plan.breakdown.length > 0 ? (
              <ul className="divide-y divide-border rounded-xl border border-border">
                {plan.breakdown.map((b) => (
                  <li key={b.operation} className="flex justify-between px-4 py-3">
                    <span>{b.label}</span>
                    <span className="tabular-nums text-muted">{formatMinutes(b.minutes)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted">Nothing has been counted yet this month.</p>
            )}
            {plan.inProgress > 0 && (
              <p className="text-muted">
                {plan.inProgress} {plan.inProgress === 1 ? "recording is" : "recordings are"} still being processed. {plan.inProgress === 1 ? "Its" : "Their"} final length isn&rsquo;t known yet, so it isn&rsquo;t counted until it finishes.
              </p>
            )}
            <p className="text-xs text-muted">Minutes are counted when processing finishes, rounded up to the next whole minute. Meeting minutes are counted for the time the assistant was recording.</p>
          </div>
        </Card>
      </div>

      {(plan.creditPacks.length > 0 || plan.purchasedCredits) && (
        <Card>
          <CardHeader title="Purchased credits" />
          <div className="space-y-3 p-5 text-sm">
            <p className="text-muted">Bought hours never touch your subscription. They expire 90 days after purchase and are used after your monthly allowance runs out.</p>
            <ul className="divide-y divide-border rounded-xl border border-border">
              {plan.creditPacks.map((pack) => (
                <li key={pack.grantId} className="space-y-1 px-4 py-3">
                  <p className="flex items-center justify-between gap-3">
                    <span className="font-medium">{pack.sku}</span>
                    <span className="text-xs text-muted">{packStateLabel(pack.state)}</span>
                  </p>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted sm:grid-cols-5">
                    <div><dt className="inline">Available: </dt><dd className="inline font-medium tabular-nums">{formatMinutes(pack.availableSeconds / 60)}</dd></div>
                    <div><dt className="inline">Reserved: </dt><dd className="inline font-medium tabular-nums">{formatMinutes(pack.reservedSeconds / 60)}</dd></div>
                    <div><dt className="inline">Used: </dt><dd className="inline font-medium tabular-nums">{formatMinutes(pack.consumedSeconds / 60)}</dd></div>
                    <div><dt className="inline">Refunded: </dt><dd className="inline font-medium tabular-nums">{formatMinutes(pack.refundedSeconds / 60)}</dd></div>
                    <div><dt className="inline">Expires: </dt><dd className="inline font-medium tabular-nums">{pack.expiresAt ? formatDate(pack.expiresAt, tz) : "—"}</dd></div>
                  </dl>
                </li>
              ))}
            </ul>
            {plan.creditPacksTruncated && <p className="text-xs text-muted">Showing the first 100 packs.</p>}
          </div>
        </Card>
      )}
    </div>
  );
}

/** Human label for a ledger credit-pack state; unknown states render as-is. */
function packStateLabel(state: CreditPackView["state"]): string {
  switch (state) {
    case "active":
      return "Active";
    case "partially_refunded":
      return "Partially refunded";
    case "refunded":
      return "Refunded";
    case "consumed":
      return "Used up";
    case "expired":
      return "Expired";
    default:
      return state;
  }
}
