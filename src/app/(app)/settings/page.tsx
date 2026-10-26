import { PageHeader } from "@/components/ui/page-header";
import { SettingsView } from "@/components/settings-view";

export const metadata = { title: "Settings · Mojooba" };

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="How Mojooba looks and works for you: appearance, connections, privacy and your data. Your photo, name and password are under Your profile." />
      <SettingsView />
    </div>
  );
}
