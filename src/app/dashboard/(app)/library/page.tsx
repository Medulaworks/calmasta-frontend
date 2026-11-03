import { Suspense } from "react";
import { NAV } from "@/lib/nav-labels";
import { TranscriptLibrary } from "@/components/transcript-library";
import { PageHeader } from "@/components/ui/page-header";

export const metadata = { title: `${NAV.folder} · Jooba` };

export default function LibraryPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title={NAV.folder}
        description="Search recordings and review or correct their transcripts."
      />
      <Suspense fallback={null}>
        <TranscriptLibrary />
      </Suspense>
    </div>
  );
}
