import { AdminHeader } from "@/components/admin/section-tabs";
import { PrivacyView } from "@/components/admin/privacy-view";

export default function Page() {
  return (
    <div className="space-y-5">
      <AdminHeader title="Deletion requests" description="People who asked us to delete their account, and how far each request has got." />
      <PrivacyView />
    </div>
  );
}
