import { Suspense } from "react";
import { SkeletonDetail } from "@/components/ui/skeleton";
import { DocumentStudio } from "@/components/document-studio";

export const metadata = { title: "Document · Joobah" };

async function Studio(props: PageProps<"/dashboard/library/[id]">) {
  const { id } = await props.params;
  return <DocumentStudio id={id} />;
}

export default function DocumentPage(
  props: PageProps<"/dashboard/library/[id]">,
) {
  return (
    <Suspense fallback={<SkeletonDetail label="Loading this document" />}>
      <Studio {...props} />
    </Suspense>
  );
}
