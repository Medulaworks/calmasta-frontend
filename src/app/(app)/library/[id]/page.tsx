import { Suspense } from "react";
import { DocumentStudio } from "@/components/document-studio";

export const metadata = { title: "Document · Mojooba" };

async function Studio(props: PageProps<"/library/[id]">) {
  const { id } = await props.params;
  return <DocumentStudio id={id} />;
}

export default function DocumentPage(props: PageProps<"/library/[id]">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
      <Studio {...props} />
    </Suspense>
  );
}
