import { AdminHeader } from "@/components/admin/section-tabs";
import { DunningView } from "@/components/admin/dunning-view";

export default function Page() {
  return (
    <div className="space-y-5">
      <AdminHeader title="Failed payments" />
      <DunningView />
    </div>
  );
}
