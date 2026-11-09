import { AdminHeader } from "@/components/admin/section-tabs";
import { UsageView } from "@/components/admin/usage-view";

export default function Page() {
  return (
    <div className="space-y-5">
      <AdminHeader title="Usage and cost" />
      <UsageView />
    </div>
  );
}
