"use client";

import { CircleCheck, CircleDashed, Clock } from "lucide-react";
import { fmtMoney } from "@/lib/admin-money";
import type { AdminPlan } from "@/lib/admin-types";
import { annualPrice } from "@/lib/pricing";
import { formatMinutes } from "@/lib/status";

/** Just what a card needs, so the editor can show a live preview of a plan that isn't saved yet. */
export type PlanShape = Pick<AdminPlan, "name" | "tagline" | "monthlyCents" | "allowanceMinutes" | "checkoutMonthlyUrl" | "checkoutYearlyUrl" | "subscribers">;

function Checkout({ label, url }: { label: string; url: string | null }) {
  return (
    <li className="flex items-center gap-3">
      {url ? <CircleCheck aria-hidden className="size-4 shrink-0 text-success" /> : <CircleDashed aria-hidden className="size-4 shrink-0 text-muted" />}
      <span className={url ? "" : "text-muted"}>{label}: {url ? "connected" : "not connected"}</span>
    </li>
  );
}

/** One plan, drawn like the pricing card people see: price first, then what they get. Click it to edit. */
export function PlanCard({ plan, discountPct, onOpen, preview = false }: { plan: PlanShape; discountPct: number; onOpen?: () => void; preview?: boolean }) {
  const free = plan.monthlyCents === 0 && plan.name === "Free";
  const yearly = discountPct > 0 ? fmtMoney(Math.round(annualPrice(plan.monthlyCents / 100, discountPct) * 100)) : null;
  return (
    <article
      onClick={(e) => { if (onOpen && !(e.target as HTMLElement).closest("button, a")) onOpen(); }}
      className={`flex h-full flex-col rounded-2xl border border-border bg-background p-5 transition-shadow ${onOpen ? "cursor-pointer hover:shadow-[0_12px_32px_-16px_rgb(0_0_0/0.35)]" : ""}`}
    >
      {onOpen ? (
        <button type="button" onClick={onOpen} className="self-start text-sm font-semibold outline-none hover:underline focus-visible:underline">{plan.name || "Plan"}</button>
      ) : (
        <p className="text-sm font-semibold">{plan.name || "Plan"}</p>
      )}

      <p className="mt-5 flex items-baseline gap-2">
        <span className="text-4xl font-semibold tabular-nums tracking-tight">{fmtMoney(plan.monthlyCents)}</span>
        <span className="text-sm text-muted">/ month</span>
      </p>
      <p className="mt-1 h-5 text-xs text-muted">{free ? "Free, no card needed" : yearly ? `${yearly} a month if billed yearly` : "Billed monthly"}</p>

      <p className="mt-4 min-h-11 text-sm text-muted">{plan.tagline || "No description."}</p>

      <ul className="mt-5 space-y-2 border-t border-border pt-5 text-sm">
        <li className="flex items-center gap-3"><Clock aria-hidden className="size-4 shrink-0 text-muted" />{formatMinutes(plan.allowanceMinutes)} of processing each month</li>
        {!free && <Checkout label="Monthly checkout" url={plan.checkoutMonthlyUrl} />}
        {!free && <Checkout label="Yearly checkout" url={plan.checkoutYearlyUrl} />}
      </ul>

      <footer className="mt-auto flex items-center justify-between pt-5 text-xs text-muted">
        <span>{preview ? "Preview" : `${plan.subscribers.toLocaleString("en")} ${plan.subscribers === 1 ? "subscriber" : "subscribers"}`}</span>
        {onOpen && <span className="font-medium text-foreground">Edit</span>}
      </footer>
    </article>
  );
}
