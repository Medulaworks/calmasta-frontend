import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { CustomerDetail } from "@/components/admin/customers-view";

export default async function CustomerPage({ params }: PageProps<"/dashboard/admin/customers/[id]">) {
  const { id } = await params;
  return (
    <div className="space-y-6">
      <PageHeader title="Customer" description="Identifiers, plan and health. No recordings, transcripts or documents." actions={<Link href="/dashboard/admin/customers" className="text-sm text-muted underline underline-offset-2">All customers</Link>} />
      <CustomerDetail id={id} />
    </div>
  );
}
