import Link from "next/link";
import { Suspense } from "react";
import { CustomerDetail } from "@/components/admin/customers-view";
import { SkeletonDetail } from "@/components/ui/skeleton";

async function Detail({ params }: { params: PageProps<"/admin/customers/[id]">["params"] }) {
  const { id } = await params;
  return <CustomerDetail id={id} />;
}

export default function CustomerPage({ params }: PageProps<"/admin/customers/[id]">) {
  return (
    <div className="space-y-6">
      <Link href="/admin/customers" className="inline-flex text-sm text-muted hover:text-foreground">&larr; All users</Link>
      <Suspense fallback={<SkeletonDetail label="Loading user" />}>
        <Detail params={params} />
      </Suspense>
    </div>
  );
}
