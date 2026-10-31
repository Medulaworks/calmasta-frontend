import { Suspense } from "react";
import { DocumentStudio } from "@/components/document-studio";

export const metadata = { title: "Document · Jooba" };

async function Studio(props: PageProps<"/dashboard/library/[id]">) {
  const { id } = await props.params;
  return <DocumentStudio id={id} />;
}

export default function DocumentPage(
  props: PageProps<"/dashboard/library/[id]">,
) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
      <Studio {...props} />
    </Suspense>
  );
}
