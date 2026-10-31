import { PageHeader } from "@/components/ui/page-header";
import { ConfirmingView } from "@/components/plan/confirming-view";

export const metadata = { title: "Confirming payment · Jooba" };

export default function ConfirmingPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Confirming your payment"
        description="We're waiting for the store to tell us your payment went through."
      />
      <ConfirmingView />
    </div>
  );
}
