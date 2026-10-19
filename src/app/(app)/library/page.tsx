import { Suspense } from "react";
import { LibraryList } from "@/components/library-list";
import { PageHeader } from "@/components/ui/page-header";

export const metadata = { title: "Library · Calmaster" };

export default function LibraryPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Library" description="Your documents and recordings in one place." />
      <Suspense fallback={null}>
        <LibraryList />
      </Suspense>
    </div>
  );
}
