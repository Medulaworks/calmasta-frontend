import { CaptureForm } from "@/components/capture-form";
import { CaptureTabs } from "@/components/capture/capture-tabs";
import { PageHeader } from "@/components/ui/page-header";

export const metadata = { title: "Capture · MyJooba" };

export default function CapturePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Capture"
        description="Add a meeting bot: paste a Google Meet, Teams or Zoom link and a visible MyJooba Assistant will join, record and hand you a transcript."
      />
      <CaptureTabs active="meeting" />
      <CaptureForm />
    </div>
  );
}
