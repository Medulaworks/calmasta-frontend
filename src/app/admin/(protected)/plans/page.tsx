import { PlansView } from "@/components/admin/plans-view";
import { SettingsPageLayout } from "@/components/admin/section-tabs";

export default function Page() {
  return (
    <SettingsPageLayout title="Plans and pricing" description="What each plan costs, how many hours it includes, and the extra-hours packs people can buy.">
      <PlansView />
    </SettingsPageLayout>
  );
}
