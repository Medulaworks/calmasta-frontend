import { notFound } from "next/navigation";
import { TestCheckoutView } from "@/components/plan/test-checkout-view";
import { PageHeader } from "@/components/ui/page-header";

export const metadata = { title: "Test checkout · Joobah" };

export default function TestCheckoutPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Test checkout"
        description="Development only: stands in for the store, so you can try buying a plan or hours end to end."
      />
      <TestCheckoutView />
    </div>
  );
}
