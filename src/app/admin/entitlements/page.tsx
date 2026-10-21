import { PageHeader } from "@/components/ui/page-header";
import { RegistryView } from "@/components/admin/registry-view";

export default function Page() {
  return (
    <div className="space-y-6">
      <PageHeader title="Entitlements" description="Find a customer, see what they can use, and make audited changes." />
      <RegistryView />
    </div>
  );
}
