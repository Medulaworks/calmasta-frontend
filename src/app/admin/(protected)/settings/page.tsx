import { AdminHeader } from "@/components/admin/section-tabs";
import { SettingsView } from "@/components/admin/settings-view";

export default function Page() {
  return (
    <div className="space-y-6">
      <AdminHeader title="Limits and switches" />
      <SettingsView />
    </div>
  );
}
