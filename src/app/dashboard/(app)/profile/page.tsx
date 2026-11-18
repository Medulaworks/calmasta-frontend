import { ProfileView } from "@/components/profile/profile-view";
import { PageHeader } from "@/components/ui/page-header";

export const metadata = { title: "Your profile · Joobah" };

export default function ProfilePage() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="Your profile"
        description="Who you are in Joobah, your plan and what you have done this month."
      />
      <ProfileView />
    </div>
  );
}
