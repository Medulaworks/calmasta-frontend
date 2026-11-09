import { Suspense } from "react";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { CustomerDetail } from "@/components/admin/customers-view";
import { SkeletonDetail } from "@/components/ui/skeleton";

async function Detail({ params }: { params: PageProps<"/admin/customers/[id]">["params"] }) {
  const { id } = await params;
  return <CustomerDetail id={id} />;
}

export default function CustomerPage({ params }: PageProps<"/admin/customers/[id]">) {
  return (
    <div className="space-y-5">
      <Breadcrumb items={[{ label: "Users", href: "/admin/customers" }, { label: "Account" }]} />
      <Suspense fallback={<SkeletonDetail label="Loading user" />}>
        <Detail params={params} />
      </Suspense>
    </div>
  );
}
