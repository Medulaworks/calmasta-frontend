import { AdminHeader } from "@/components/admin/section-tabs";
import { AuditView } from "@/components/admin/audit-view";

export default function Page() {
  return (
    <div className="space-y-5">
      <AdminHeader title="Activity" description="A record of what admins and the system have done, newest first. Use it to answer “who changed this?”." />
      <AuditView />
    </div>
  );
}
