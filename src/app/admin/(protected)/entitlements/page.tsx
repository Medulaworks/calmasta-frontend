import { AdminHeader } from "@/components/admin/section-tabs";
import { RegistryView } from "@/components/admin/registry-view";

export default function Page() {
  return (
    <div className="space-y-5">
      <AdminHeader title="Subscribers" />
      <RegistryView />
    </div>
  );
}
