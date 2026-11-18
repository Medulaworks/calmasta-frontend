import { AdminHeader } from "@/components/admin/section-tabs";
import { UserDirectory } from "@/components/admin/users-view";

export default function UsersPage() {
  return (
    <div className="space-y-5">
      <AdminHeader title="Users" description="Everyone with a Joobah account. Select a row to see their details." />
      <UserDirectory basePath="/admin/customers" />
    </div>
  );
}
