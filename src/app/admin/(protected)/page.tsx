import { Suspense } from "react";
import { OverviewView } from "@/components/admin/overview-view";
import { AdminHeader } from "@/components/admin/section-tabs";

export default function Page() {
  return (
    <div className="space-y-5">
      <AdminHeader title="Home" />
      <Suspense fallback={<div role="status" aria-label="Loading" aria-busy="true" className="h-64 jb-skel rounded-xl border border-border bg-surface" />}>
        <OverviewView />
      </Suspense>
    </div>
  );
}
