import { PageHeader } from "@/components/ui/page-header";
import { BillingView } from "@/components/billing/billing-view";

export const metadata = { title: "Billing · Joobah" };

export default function BillingPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Billing"
        description="Buy extra hours and manage billing. Nothing is charged until the store confirms your payment."
      />
      <BillingView />
    </div>
  );
}
