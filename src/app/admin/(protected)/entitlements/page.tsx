import { AdminHeader } from "@/components/admin/section-tabs";
import { RegistryView } from "@/components/admin/registry-view";

export default function Page() {
  return (
    <div className="space-y-5">
      <AdminHeader title="Subscribers" description="People on a paid plan, or given one by an admin." />
      <RegistryView />
    </div>
  );
}
