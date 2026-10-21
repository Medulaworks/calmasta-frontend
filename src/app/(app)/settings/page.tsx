import { PageHeader } from "@/components/ui/page-header";
import { SettingsView } from "@/components/settings-view";

export const metadata = { title: "Settings · CalMasta" };

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Your account, role and privacy." />
      <SettingsView />
    </div>
  );
}
