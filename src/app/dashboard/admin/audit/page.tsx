import { AdminHeader } from "@/components/admin/section-tabs";
import { AuditView } from "@/components/admin/audit-view";

export default function Page() {
  return (
    <div className="space-y-6">
      <AdminHeader title="Activity" />
      <AuditView />
    </div>
  );
}
