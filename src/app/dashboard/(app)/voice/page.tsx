import { CaptureTabs } from "@/components/capture/capture-tabs";
import { VoiceRecorder } from "@/components/voice-recorder";
import { PageHeader } from "@/components/ui/page-header";

export const metadata = { title: "Voice Inbox · MyJooba" };

export default function VoicePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Capture"
        description="Record a thought or upload audio, then turn it into a brief, minutes or follow-up."
      />
      <CaptureTabs active="voice" />
      <VoiceRecorder />
    </div>
  );
}
