import { AdminProfile } from "@/components/admin/admin-profile";
import { PageHeader } from "@/components/ui/page-header";

export default function Page() {
  return (
    <div className="space-y-6">
      <PageHeader title="My profile" />
      <AdminProfile />
    </div>
  );
}
