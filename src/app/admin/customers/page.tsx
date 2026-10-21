import { PageHeader } from "@/components/ui/page-header";
import { CustomerSearch } from "@/components/admin/customers-view";

export default function CustomersPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Customers" description="Look up an account by email, name or id. Opening an account is recorded in the audit trail." />
      <CustomerSearch basePath="/admin/customers" />
    </div>
  );
}
