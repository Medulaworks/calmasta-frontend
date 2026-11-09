import { Suspense } from "react";
import { TranscriptLibrary } from "@/components/transcript-library";
import { PageHeader } from "@/components/ui/page-header";

export const metadata = { title: "My Folder · Jooba" };

export default function LibraryPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="My Folder"
        description="Everything you have recorded. Search by title or by what was said, and open any one to review or correct its transcript."
      />
      <Suspense fallback={null}>
        <TranscriptLibrary />
      </Suspense>
    </div>
  );
}
