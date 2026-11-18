import { AdminHeader } from "@/components/admin/section-tabs";
import { ReconciliationView } from "@/components/admin/reconciliation-view";

export default function Page() {
  return (
    <div className="space-y-5">
      <AdminHeader title="Mismatches" description="Places where our records and the store’s disagree, for example someone who paid but has no plan. Each one says what to do." />
      <ReconciliationView />
    </div>
  );
}
