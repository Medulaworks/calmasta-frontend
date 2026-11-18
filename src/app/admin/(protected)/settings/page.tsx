import { SettingsPageLayout } from "@/components/admin/section-tabs";
import { SettingsView } from "@/components/admin/settings-view";

export default function Page() {
  return (
    <SettingsPageLayout title="Limits and switches" description="Everything you can set for the whole product: recording, uploads, sharing, AI and the emergency pause.">
      <SettingsView />
    </SettingsPageLayout>
  );
}
