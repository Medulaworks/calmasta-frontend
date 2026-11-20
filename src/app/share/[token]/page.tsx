import { Suspense } from "react";
import { PublicSharedView } from "@/components/sharing/shared-notes-view";

export async function generateMetadata() {
  return { title: "Shared notes", robots: { index: false, follow: false } };
}

async function ShareContent({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <PublicSharedView token={token} />;
}

export default function Page({ params }: { params: Promise<{ token: string }> }) {
  return (
    <Suspense fallback={<div className="mx-auto max-w-3xl p-6 text-sm text-muted">Loading shared notes…</div>}>
      <ShareContent params={params} />
    </Suspense>
  );
}
