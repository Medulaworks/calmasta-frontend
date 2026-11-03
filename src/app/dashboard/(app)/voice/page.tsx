import { Suspense } from "react";
import { NAV } from "@/lib/nav-labels";
import { CaptureForm } from "@/components/capture-form";
import { CaptureTabs } from "@/components/capture/capture-tabs";
import { VoiceRecorder } from "@/components/voice-recorder";
import { PageHeader } from "@/components/ui/page-header";

export const metadata = { title: `${NAV.join} · Jooba` };

type Props = {
  searchParams: Promise<{ tab?: string }>;
};

function resolveTab(raw: string | undefined): "voice" | "bot" {
  if (raw === "voice") return "voice";
  if (raw === "bot" || raw === "meeting") return "bot";
  // Default to bot (first tab) when missing/unknown
  return "bot";
}

async function VoicePageInner({ searchParams }: Props) {
  const { tab } = await searchParams;
  const active = resolveTab(tab);
  const isVoice = active === "voice";
  return (
    <div className="space-y-6">
      <PageHeader
        title={isVoice ? "Record a voice note" : "Join a meeting"}
        description={
          isVoice
            ? "Record a thought or upload audio, then turn it into a brief, minutes or follow-up."
            : "Add a meeting bot: paste a Google Meet, Teams or Zoom link and a visible meeting assistant will join, record and hand you a transcript."
        }
      />
      <CaptureTabs active={active} />
      {isVoice ? <VoiceRecorder /> : <CaptureForm />}
    </div>
  );
}

export default function VoicePage(props: Props) {
  return (
    <Suspense fallback={<div className="space-y-6"><div className="h-20 animate-pulse rounded-xl bg-border" /></div>}>
      <VoicePageInner {...props} />
    </Suspense>
  );
}
