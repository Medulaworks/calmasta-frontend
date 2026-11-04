import { PlansView } from "@/components/admin/plans-view";
import { AdminHeader } from "@/components/admin/section-tabs";

export default function Page() {
  return (
    <div className="space-y-6">
      <AdminHeader title="Plans" />
      <PlansView />
    </div>
  );
}
