import { PageHeader } from "@/components/ui/page-header";
import { ReconciliationView } from "@/components/admin/reconciliation-view";

export default function Page() {
  return (
    <div className="space-y-6">
      <PageHeader title="Reconciliation" description="Where the store, entitlements and usage ledger disagree." />
      <ReconciliationView />
    </div>
  );
}
