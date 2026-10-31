import { Suspense } from "react";
import { TranscriptLibrary } from "@/components/transcript-library";
import { PageHeader } from "@/components/ui/page-header";

export const metadata = { title: "Library · Jooba" };

export default function LibraryPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Library"
        description="Search recordings and review or correct their transcripts."
      />
      <Suspense fallback={null}>
        <TranscriptLibrary />
      </Suspense>
    </div>
  );
}
