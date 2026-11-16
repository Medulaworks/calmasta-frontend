import { SettingsPageLayout } from "@/components/admin/section-tabs";
import { SettingsView } from "@/components/admin/settings-view";

export default function Page() {
  return (
    <SettingsPageLayout title="Limits and switches">
      <SettingsView />
    </SettingsPageLayout>
  );
}
