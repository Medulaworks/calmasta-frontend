import { Suspense } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { CheckoutStatusView } from "@/components/billing/checkout-status-view";

export const metadata = { title: "Confirming payment · Joobah" };

type Props = {
  searchParams: Promise<{ intent?: string; status?: string }>;
};

/**
 * Store return target (woo-entitlements-v1). Only the opaque `intent` pointer
 * is read; sibling query parameters such as `?status=success` are ignored and
 * never treated as proof of payment. Confirmation comes from authenticated
 * polling of GET /commerce/checkout/:id inside CheckoutStatusView.
 */
async function BillingReturnInner({ searchParams }: Props) {
  const { intent } = await searchParams;
  const intentId = typeof intent === "string" ? intent : null;
  return (
    <div className="space-y-6">
      <PageHeader
        title="Confirming your payment"
        description="We’re checking with the store to confirm your payment."
      />
      <CheckoutStatusView intentId={intentId} />
    </div>
  );
}

export default function BillingReturnPage(props: Props) {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <div className="h-20 jb-skel rounded-2xl bg-border" />
        </div>
      }
    >
      <BillingReturnInner {...props} />
    </Suspense>
  );
}
