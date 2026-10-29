import { PageHeader } from "@/components/ui/page-header";
import { OverviewView } from "@/components/admin/overview-view";

export default function Page() {
  return (
    <div className="space-y-6">
      <PageHeader title="Overview and jobs" description="How work is flowing, what has failed, and what is safe to retry." />
      <OverviewView />
    </div>
  );
}
