import { AdminHeader } from "@/components/admin/section-tabs";
import { IntegrationsView } from "@/components/admin/integrations-view";

export default function Page() {
  return (
    <div className="space-y-5">
      <AdminHeader title="Connected services" />
      <IntegrationsView />
    </div>
  );
}
