import { Suspense } from "react";
import { RecipientSharedView } from "@/components/sharing/shared-notes-view";

async function RecipientContent({ params }: { params: Promise<{ grantId: string }> }) {
  const { grantId } = await params;
  return <RecipientSharedView grantId={grantId} />;
}

export default function Page({ params }: { params: Promise<{ grantId: string }> }) {
  return (
    <Suspense fallback={<div className="mx-auto max-w-3xl p-6 text-sm text-muted">Loading shared notes…</div>}>
      <RecipientContent params={params} />
    </Suspense>
  );
}
