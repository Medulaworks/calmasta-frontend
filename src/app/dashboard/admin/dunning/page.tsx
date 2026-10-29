import { PageHeader } from "@/components/ui/page-header";
import { DunningView } from "@/components/admin/dunning-view";

export default function Page() {
  return (
    <div className="space-y-6">
      <PageHeader title="Dunning monitor" description="Customers with payment trouble, and what happens next." />
      <DunningView />
    </div>
  );
}
