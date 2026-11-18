import { MoneyView } from "@/components/admin/money-view";
import { AdminHeader } from "@/components/admin/section-tabs";

export default function Page() {
  return (
    <div className="space-y-5">
      <AdminHeader title="Payments" description="Payments that are late, pending or ended. Select one to open the account." />
      <MoneyView />
    </div>
  );
}
