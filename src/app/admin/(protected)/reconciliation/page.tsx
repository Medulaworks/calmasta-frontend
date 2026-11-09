import { AdminHeader } from "@/components/admin/section-tabs";
import { ReconciliationView } from "@/components/admin/reconciliation-view";

export default function Page() {
  return (
    <div className="space-y-5">
      <AdminHeader title="Mismatches" />
      <ReconciliationView />
    </div>
  );
}
