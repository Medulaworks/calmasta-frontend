import { AdminHeader } from "@/components/admin/section-tabs";
import { UsageView } from "@/components/admin/usage-view";

export default function Page() {
  return (
    <div className="space-y-5">
      <AdminHeader title="Credit usage" description="How many minutes people have used, who uses the most, and what that has cost. Use Pause to stop new work for everyone." />
      <UsageView />
    </div>
  );
}
