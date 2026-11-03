import { AdminsView } from "@/components/admin/admins-view";
import { AdminHeader } from "@/components/admin/section-tabs";

export default function Page() {
  return (
    <div className="space-y-6">
      <AdminHeader title="Admins" />
      <AdminsView />
    </div>
  );
}
