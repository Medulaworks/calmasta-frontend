import { PageHeader } from "@/components/ui/page-header";
import { SettingsView } from "@/components/settings-view";

export const metadata = { title: "Settings · Joobah" };

export default function SettingsPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="Settings"
        description="How Joobah looks and works for you. Your details, plan and usage are on your profile."
      />
      <SettingsView />
    </div>
  );
}
