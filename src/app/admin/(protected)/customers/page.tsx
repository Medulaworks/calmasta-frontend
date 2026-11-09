import { AdminHeader } from "@/components/admin/section-tabs";
import { UserDirectory } from "@/components/admin/users-view";

export default function UsersPage() {
  return (
    <div className="space-y-5">
      <AdminHeader title="Users" />
      <UserDirectory basePath="/admin/customers" />
    </div>
  );
}
