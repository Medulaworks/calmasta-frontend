import { Suspense } from "react";
import { AdminHeader } from "@/components/admin/section-tabs";
import { WebhooksView } from "@/components/admin/webhooks-view";

export default function Page() {
  return (
    <div className="space-y-6">
      <AdminHeader title="Store messages" />
      <Suspense fallback={<div role="status" aria-label="Loading" aria-busy="true" className="h-48 jb-skel rounded-xl border border-border bg-surface" />}>
        <WebhooksView />
      </Suspense>
    </div>
  );
}
