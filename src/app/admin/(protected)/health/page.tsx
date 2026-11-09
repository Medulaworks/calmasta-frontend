import { AdminHeader } from "@/components/admin/section-tabs";
import { HealthView } from "@/components/admin/health-view";

export default function Page() {
  return (
    <div className="space-y-5">
      <AdminHeader title="System status" />
      <HealthView />
    </div>
  );
}
