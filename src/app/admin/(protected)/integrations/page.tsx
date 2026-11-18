import { SettingsPageLayout } from "@/components/admin/section-tabs";
import { IntegrationsView } from "@/components/admin/integrations-view";

export default function Page() {
  return (
    <SettingsPageLayout title="Connected services">
      <IntegrationsView />
    </SettingsPageLayout>
  );
}
