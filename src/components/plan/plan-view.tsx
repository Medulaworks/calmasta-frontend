"use client";

import { dashboardPath } from "@/lib/app-routes";

import { AlertTriangle, BadgeCheck, Check, Clock } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { buttonClass } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { type PlanSummary, fetchPlan, formatDate } from "@/lib/plan-client";
import { PLAN_LABEL, type PaidPlanId, isPaidPlan } from "@/lib/plan-types";
import { annualPrice, formatPrice, yearlyTotal } from "@/lib/pricing";
import { formatMinutes } from "@/lib/status";

type Billing = "monthly" | "annual";

function Meter({
  used,
  total,
  exhausted,
}: {
  used: number;
  total: number;
  exhausted: boolean;
}) {
  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 100;
  return (
    <div
      role="progressbar"
      aria-label="Allowance used this month"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={Math.min(used, total)}
      aria-valuetext={`${used} of ${total} minutes used`}
      className="h-2 overflow-hidden rounded-full bg-border">
      <div
        className={`h-full rounded-full ${exhausted ? "bg-danger-solid" : "bg-accent-solid"}`}
        style={{ width: `${pct}%` }}
      />
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

/** One plan, laid out like a pricing table column: name, blurb, price, headline points, the rest, then the action. */
function PlanCard({
  name,
  current = false,
  highlight = false,
  badge,
  blurb,
  price,
  priceNote,
  headline,
  groupTitle,
  points,
  action,
}: {
  name: string;
  current?: boolean;
  highlight?: boolean;
  badge?: string;
  blurb: string;
  price: React.ReactNode;
  priceNote: string;
  headline: string[];
  groupTitle: string;
  points: string[];
  action: React.ReactNode;
}) {
  const id = useId();
  return (
    <section
      aria-labelledby={id}
      className={`flex flex-col rounded-xl border bg-background ${highlight ? "border-accent ring-1 ring-accent/20" : "border-border"}`}>
      <div className="space-y-4 p-6">
        <div className="flex items-center gap-2">
          <h2 id={id} className="text-xl font-semibold text-accent">
            {name}
          </h2>
          {current && (
            <BadgeCheck
              aria-label="Your current plan"
              className="h-5 w-5 text-accent"
            />
          )}
          {badge && (
            <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent ring-1 ring-inset ring-accent/25">
              {badge}
            </span>
          )}
        </div>
        <p className="min-h-10 text-sm text-muted">{blurb}</p>
        <div>
          <p className="text-3xl font-medium tracking-tight tabular-nums">
            {price}
          </p>
          <p className="mt-1 text-sm text-muted">{priceNote}</p>
        </div>
        <div>{action}</div>
      </div>
      <ul className="space-y-3 border-t border-border p-6 text-sm">
        {headline.map((h) => (
          <li key={h} className="flex gap-3">
            <Check
              aria-hidden
              className="mt-0.5 h-4 w-4 shrink-0 text-accent"
            />
            <span className="font-medium">{h}</span>
          </li>
        ))}
      </ul>
      <div className="flex flex-1 flex-col border-t border-border p-6 text-sm">
        <p className="text-muted">{groupTitle}</p>
        <ul className="mt-3 space-y-3">
          {points.map((p) => (
            <li key={p} className="flex gap-3">
              <Check
                aria-hidden
                className="mt-0.5 h-4 w-4 shrink-0 text-muted"
              />
              <span>{p}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

const quiet = `${buttonClass("secondary", "w-full")} pointer-events-none text-muted`;
const wide = "w-full";

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
      className={`flex h-8 items-center gap-2 rounded-md px-4 text-sm transition-colors ${value === id ? "bg-background font-medium text-foreground shadow-sm ring-1 ring-border" : "text-muted hover:text-foreground"}`}>
      {label}
      {pill && (
        <span className="rounded bg-success/15 px-1.5 py-0.5 text-xs font-medium text-success">
          {pill}
        </span>
      )}
    </button>
  );
  return (
    <div
      role="radiogroup"
      aria-label="Billing period"
      className="mx-auto flex w-fit items-center gap-1 rounded-lg bg-surface p-1 ring-1 ring-border">
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
      (e) =>
        !cancelled &&
        setError(e instanceof Error ? e.message : "Could not load your plan."),
    );
    return () => {
      cancelled = true;
    };
  }, []);

  if (error)
    return (
      <p role="alert" className="text-sm text-danger">
        {error}
      </p>
    );
  if (!plan)
    return (
      <div
        role="status"
        aria-label="Loading"
        aria-busy="true"
        className="space-y-6">
        <div className="mx-auto h-10 w-56 animate-pulse rounded-lg bg-border" />
        <div className="grid gap-4 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-[30rem] animate-pulse rounded-xl border border-border bg-surface"
            />
          ))}
        </div>
      </div>
    );

  const current = plan.plan.plan;
  const paid = isPaidPlan(current);
  const tz = plan.timezone;
  const { currency, proMonthly, businessMonthly, annualDiscountPct } =
    plan.pricing;
  const annual = billing === "annual";
  const proPerMonth = annual
    ? annualPrice(proMonthly, annualDiscountPct)
    : proMonthly;
  const businessPerMonth = annual
    ? annualPrice(businessMonthly, annualDiscountPct)
    : businessMonthly;
  const pending = plan.plan.status === "pending_activation";
  const grace = plan.plan.status === "grace";

  const freeH = formatMinutes(plan.freeAllowanceMinutes);
  const proH = formatMinutes(plan.proAllowanceMinutes);
  const businessH = formatMinutes(plan.businessAllowanceMinutes);
  const times = (a: number, b: number) =>
    Math.max(1, Math.round(a / Math.max(1, b)));

  /** The action for a paid plan's card, from where the customer is now. */
  const paidAction = (which: PaidPlanId): React.ReactNode => {
    const label = PLAN_LABEL[which];
    if (current === which) {
      return plan.billingUrl ? (
        <Link
          href={dashboardPath(plan.billingUrl)}
          className={buttonClass(grace ? "primary" : "secondary", wide)}>
          {grace ? "Fix payment" : "Manage billing"}
        </Link>
      ) : (
        <span className={quiet}>Current plan</span>
      );
    }
    if (pending)
      return (
        <Link
          href="/dashboard/plan/confirming"
          className={buttonClass("secondary", wide)}>
          <Clock aria-hidden className="h-4 w-4" /> Waiting for payment
        </Link>
      );
    const href = checkoutHref(plan, which, annual);
    // Moving between paid plans is a switch; from Free it is an upgrade. Business is the step up from Pro, so "Switch to Pro" is the quieter button.
    const stepDown = paid && which === "pro";
    if (href)
      return (
        <Link
          href={dashboardPath(href)}
          className={buttonClass(stepDown ? "secondary" : "primary", wide)}>
          {paid ? `Switch to ${label}` : `Upgrade to ${label}`}
        </Link>
      );
    return (
      <>
        <span aria-disabled="true" className={quiet}>
          Upgrade to {label}
        </span>
        <p className="mt-2 text-center text-xs text-muted">
          {annual &&
          (which === "business" ? plan.checkoutUrlBusiness : plan.checkoutUrl)
            ? "Yearly billing isn't available yet."
            : "Checkout isn't connected yet."}
        </p>
      </>
    );
  };

  const packHref = (sku: string) =>
    plan.checkoutUrl ??
    (plan.testCheckout
      ? `/dashboard/plan/test-checkout?pack=${encodeURIComponent(sku)}`
      : null);
  const label = PLAN_LABEL[current];

  return (
    <div className="space-y-8">
      {plan.placeholder && (
        <p
          role="note"
          className="flex gap-2 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
          <AlertTriangle
            aria-hidden
            className="mt-0.5 h-4 w-4 shrink-0 text-warning"
          />
          Prices, allowances and hour packs shown here are placeholders until
          pricing is confirmed.
        </p>
      )}

      {grace && plan.plan.graceUntil && (
        <p
          role="alert"
          className="rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
          Your last payment didn&rsquo;t go through. {label} stays on until{" "}
          <strong>{formatDate(plan.plan.graceUntil, tz, true)}</strong>. After
          that you&rsquo;ll move to Free and keep all your work.
        </p>
      )}
      {pending && (
        <p
          role="status"
          className="rounded-lg border border-accent/30 bg-accent/10 px-4 py-3 text-sm">
          Your plan starts as soon as the store confirms your payment. A
          checkout page alone doesn&rsquo;t switch it on.
        </p>
      )}
      {plan.plan.status === "expired" && (
        <p
          role="status"
          className="rounded-lg border border-border bg-surface px-4 py-3 text-sm text-muted">
          Your paid plan has ended, so you&rsquo;re on Free. Everything you made
          is kept.
        </p>
      )}
      {paid && plan.plan.status === "active" && plan.plan.renewsAt && (
        <p
          role="status"
          className="rounded-lg border border-border bg-surface px-4 py-3 text-sm text-muted">
          {label} renews or ends on {formatDate(plan.plan.renewsAt, tz)}.
        </p>
      )}

      <BillingToggle
        value={billing}
        onChange={setBilling}
        discount={annualDiscountPct}
      />

      <div className="grid gap-4 md:grid-cols-3">
        <PlanCard
          name="Free"
          current={current === "free"}
          blurb="For trying MyJooba and for occasional recordings."
          price={formatPrice(currency, 0)}
          priceNote="Free, no card needed"
          action={
            current === "free" ? (
              <span className={quiet}>Current plan</span>
            ) : (
              <span className={quiet}>Included with every account</span>
            )
          }
          headline={[
            `${freeH} of processing each month`,
            "Voice notes, uploads and meeting captures",
            "Transcripts you can read and correct",
          ]}
          groupTitle="What you get"
          points={[
            "Documents from templates, with search and action items",
            "Calendar and public booking pages",
            "Original audio removed after a set time; transcripts and documents stay",
            "Extra hours when you need them",
          ]}
        />
        <PlanCard
          name="Pro"
          current={current === "pro"}
          highlight
          badge="Most popular"
          blurb="For people who record and write up conversations every week."
          price={formatPrice(currency, proPerMonth)}
          priceNote={
            annual
              ? `per month, billed yearly (${formatPrice(currency, yearlyTotal(proPerMonth))})`
              : "per month, billed monthly"
          }
          action={paidAction("pro")}
          headline={[
            `${proH} of processing each month`,
            `${times(plan.proAllowanceMinutes, plan.freeAllowanceMinutes)} times the Free allowance`,
            "Buy extra hours any time",
          ]}
          groupTitle="Everything in Free, plus"
          points={[
            "A far larger monthly allowance for busy weeks",
            "Extra-hour packs that don't reset each month",
            "If it ever ends you move to Free and keep everything you made",
          ]}
        />
        <PlanCard
          name="Business"
          current={current === "business"}
          blurb="For people who record all day, every day, and never want to count hours."
          price={formatPrice(currency, businessPerMonth)}
          priceNote={
            annual
              ? `per month, billed yearly (${formatPrice(currency, yearlyTotal(businessPerMonth))})`
              : "per month, billed monthly"
          }
          action={paidAction("business")}
          headline={[
            `${businessH} of processing each month`,
            `${times(plan.businessAllowanceMinutes, plan.proAllowanceMinutes)} times the Pro allowance`,
            "Buy extra hours any time",
          ]}
          groupTitle="Everything in Pro, plus"
          points={[
            "Room for back-to-back meetings and daily recording",
            "The same extra-hour packs, if you ever need more",
            "If it ever ends you move to Free and keep everything you made",
          ]}
        />
      </div>

      <p className="text-center text-sm text-muted">
        Shared workspaces and team members are planned for Business.{" "}
        {plan.enterpriseUrl ? (
          <Link
            href={dashboardPath(plan.enterpriseUrl)}
            className="font-medium text-accent underline underline-offset-2">
            Need custom terms? Talk to us.
          </Link>
        ) : (
          "Need custom terms? Ask us once team features arrive."
        )}
      </p>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader
            title="Your usage this month"
            action={
              <span className="text-xs text-muted">
                Resets {formatDate(plan.resetsAt, tz)}
              </span>
            }
          />
          <div className="space-y-4 p-5 text-sm">
            <p>
              <span className="text-2xl font-medium tabular-nums">
                {formatMinutes(plan.usedMinutes)}
              </span>
              <span className="text-muted">
                {" "}
                of {formatMinutes(plan.allowanceMinutes)} used
              </span>
            </p>
            <Meter
              used={plan.usedMinutes}
              total={plan.allowanceMinutes}
              exhausted={plan.exhausted}
            />
            <dl className="grid gap-3 sm:grid-cols-3">
              <div>
                <dt className="text-muted">Included left</dt>
                <dd className="font-medium tabular-nums">
                  {formatMinutes(plan.includedRemainingMinutes)}
                </dd>
              </div>
              <div>
                <dt className="text-muted">Bought hours left</dt>
                <dd className="font-medium tabular-nums">
                  {formatMinutes(plan.purchasedMinutes)}
                </dd>
              </div>
              <div>
                <dt className="text-muted">Total you can use</dt>
                <dd className="font-medium tabular-nums">
                  {formatMinutes(plan.remainingMinutes)}
                </dd>
              </div>
            </dl>
            {plan.exhausted && (
              <p role="alert" className="text-danger">
                You&rsquo;ve used everything for this month, so new recordings
                can&rsquo;t be processed. Everything you already have stays
                available.
              </p>
            )}
            {plan.breakdown.length > 0 && (
              <ul className="divide-y divide-border rounded-lg border border-border">
                {plan.breakdown.map((b) => (
                  <li
                    key={b.operation}
                    className="flex justify-between px-4 py-2">
                    <span>{b.label}</span>
                    <span className="tabular-nums text-muted">
                      {formatMinutes(b.minutes)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {plan.inProgress > 0 && (
              <p className="text-muted">
                {plan.inProgress}{" "}
                {plan.inProgress === 1 ? "recording is" : "recordings are"}{" "}
                still being processed. {plan.inProgress === 1 ? "Its" : "Their"}{" "}
                final length isn&rsquo;t known yet, so it isn&rsquo;t counted
                until it finishes.
              </p>
            )}
            <p className="text-xs text-muted">
              Minutes are counted when processing finishes, rounded up to the
              next whole minute. Meeting minutes are counted for the time the
              assistant was recording.
            </p>
          </div>
        </Card>

        <Card>
          <CardHeader title="Extra hours" />
          <div className="space-y-3 p-5 text-sm">
            <p className="text-muted">
              Extra hours are used after your monthly allowance runs out. They
              don&rsquo;t reset each month.
            </p>
            <ul className="divide-y divide-border rounded-lg border border-border">
              {plan.packs.map((k) => (
                <li
                  key={k.sku}
                  className="flex items-center justify-between gap-3 px-4 py-3">
                  <span className="font-medium">{k.label}</span>
                  {packHref(k.sku) ? (
                    <Link
                      href={packHref(k.sku)!}
                      className={buttonClass("secondary", "", "sm")}>
                      Buy
                    </Link>
                  ) : (
                    <span className="text-xs text-muted">
                      Checkout not connected
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </Card>
      </div>
    </div>
  );
}
