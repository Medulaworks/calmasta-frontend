import { SettingsPageLayout } from "@/components/admin/section-tabs";
import { EmailTemplatesView } from "@/components/admin/email-templates-view";

export default function Page() {
  return (
    <SettingsPageLayout
      title="Email templates"
      description="Customize subjects, messaging, and button labels across transactional customer emails. System security codes and links are locked."
    >
      <EmailTemplatesView />
    </SettingsPageLayout>
  );
}
