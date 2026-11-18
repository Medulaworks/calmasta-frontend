import { redirect } from "next/navigation";
import { Suspense } from "react";
import { CaptureForm } from "@/components/capture-form";
import { PageHeader } from "@/components/ui/page-header";

export const metadata = { title: "Meet · Joobah" };

type Props = {
  searchParams: Promise<{ tab?: string }>;
};

async function MeetPageInner({ searchParams }: Props) {
  const { tab } = await searchParams;
  // Old links opened one page with two tabs. The voice tab now lives at Think.
  if (tab === "voice") redirect("/dashboard/voice");
  return (
    <div className="space-y-5">
      <PageHeader title="Meet" description="Send an assistant into a Google Meet, Microsoft Teams or Zoom call. It records and hands you a transcript." />
      <CaptureForm />
    </div>
  );
}

export default function MeetPage(props: Props) {
  return (
    <Suspense fallback={<div className="space-y-6"><div className="h-20 jb-skel rounded-2xl bg-border" /></div>}>
      <MeetPageInner {...props} />
    </Suspense>
  );
}
