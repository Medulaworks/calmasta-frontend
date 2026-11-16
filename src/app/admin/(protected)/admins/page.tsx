import { AdminHeader } from "@/components/admin/section-tabs";
import { AdminsView } from "@/components/admin/admins-view";

export default function Page() {
  return (
    <div className="space-y-5">
      <AdminHeader title="Admins" />
      <AdminsView />
    </div>
  );
}
