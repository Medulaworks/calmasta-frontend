import { Suspense } from "react";
import { AdminHeader } from "@/components/admin/section-tabs";
import { WebhooksView } from "@/components/admin/webhooks-view";

export default function Page() {
  return (
    <div className="space-y-5">
      <AdminHeader title="Store messages" description="Notes the app store sends us when someone subscribes, renews, cancels or gets a refund. If one fails, that person’s plan can end up wrong." />
      <Suspense fallback={<div role="status" aria-label="Loading" aria-busy="true" className="h-48 jb-skel rounded-xl border border-border bg-surface" />}>
        <WebhooksView />
      </Suspense>
    </div>
  );
}
