import { AdminHeader } from "@/components/admin/section-tabs";
import { PrivacyView } from "@/components/admin/privacy-view";

export default function Page() {
  return (
    <div className="space-y-6">
      <AdminHeader title="Deletion requests" />
      <PrivacyView />
    </div>
  );
}
