import { PageHeader } from "@/components/ui/page-header";
import { PlanView } from "@/components/plan/plan-view";

export const metadata = { title: "Plan and usage · Joobah" };

type Props = {
  searchParams: Promise<{ purchase?: string }>;
};

export default async function PlanPage({ searchParams }: Props) {
  const { purchase } = await searchParams;
  return (
    <div className="space-y-6">
      <PageHeader
        title="Plan and usage"
        description="What your plan includes and how much of this month you’ve used."
      />
      {purchase === "success" && (
        <p
          role="status"
          className="rounded-lg border border-success/40 bg-success/10 px-4 py-3 text-sm">
          Your payment was confirmed and your credits are active.
        </p>
      )}
      <PlanView />
    </div>
  );
}
