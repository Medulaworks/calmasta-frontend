import { redirect } from "next/navigation";
import { Suspense } from "react";
import { VoiceRecorder } from "@/components/voice-recorder";
import { PageHeader } from "@/components/ui/page-header";

export const metadata = { title: "Record · Jooba" };

type Props = {
  searchParams: Promise<{ tab?: string; link?: string }>;
};

async function ThinkPageInner({ searchParams }: Props) {
  const { tab, link } = await searchParams;
  // Old links opened one page with two tabs. The meeting tab now lives at Meet.
  if (tab === "bot" || tab === "meeting") redirect(`/dashboard/capture${link ? `?link=${encodeURIComponent(link)}` : ""}`);
  return (
    <div className="space-y-6">
      <PageHeader title="Record" description="Say it out loud, or upload a recording. Jooba turns it into a transcript, then into notes, a plan or reminders." />
      <VoiceRecorder />
    </div>
  );
}

export default function ThinkPage(props: Props) {
  return (
    <Suspense fallback={<div className="space-y-6"><div className="h-20 jb-skel rounded-2xl bg-border" /></div>}>
      <ThinkPageInner {...props} />
    </Suspense>
  );
}
