import { PageHeader } from "@/components/ui/page-header";
import { WebhooksView } from "@/components/admin/webhooks-view";

export default async function Page({ searchParams }: PageProps<"/dashboard/admin/webhooks">) {
  const f = (await searchParams).filter;
  const initial = f === "attention" || f === "rejected" || f === "duplicates" ? f : "all";
  return (
    <div className="space-y-6">
      <PageHeader title="Webhook health" description="What the store and meeting provider have sent, and what became of it." />
      <WebhooksView initialFilter={initial} />
    </div>
  );
}
