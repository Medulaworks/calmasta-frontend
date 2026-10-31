import { PageHeader } from "@/components/ui/page-header";
import { PlanView } from "@/components/plan/plan-view";

export const metadata = { title: "Plan and usage · Jooba" };

export default function PlanPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Plan and usage"
        description="What your plan includes and how much of this month you've used."
      />
      <PlanView />
    </div>
  );
}
