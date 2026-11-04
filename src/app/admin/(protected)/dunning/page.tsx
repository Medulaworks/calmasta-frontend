import { AdminHeader } from "@/components/admin/section-tabs";
import { DunningView } from "@/components/admin/dunning-view";

export default function Page() {
  return (
    <div className="space-y-6">
      <AdminHeader title="Failed payments" />
      <DunningView />
    </div>
  );
}
