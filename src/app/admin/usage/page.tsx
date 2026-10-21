import { PageHeader } from "@/components/ui/page-header";
import { UsageView } from "@/components/admin/usage-view";

export default function Page() {
  return (
    <div className="space-y-6">
      <PageHeader title="Usage and cost" description="Minutes used, estimated cost against the target, and the processing pause." />
      <UsageView />
    </div>
  );
}
