import { ProfileView } from "@/components/profile/profile-view";
import { PageHeader } from "@/components/ui/page-header";

export const metadata = { title: "Your profile · Mojooba" };

export default function ProfilePage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Your profile" description="Who you are in Mojooba: your photo, name, time zone, role and how you sign in." />
      <ProfileView />
    </div>
  );
}
