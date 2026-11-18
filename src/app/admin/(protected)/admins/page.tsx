import { AdminHeader } from "@/components/admin/section-tabs";
import { AdminsView } from "@/components/admin/admins-view";

export default function Page() {
  return (
    <div className="space-y-5">
      <AdminHeader title="Admins" description="The people who can use this admin area, and invites that are still waiting." />
      <AdminsView />
    </div>
  );
}
