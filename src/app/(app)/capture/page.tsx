import { CaptureForm } from "@/components/capture-form";
import { CaptureTabs } from "@/components/capture/capture-tabs";
import { PageHeader } from "@/components/ui/page-header";

export const metadata = { title: "Capture · CalMasta" };

export default function CapturePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Capture"
        description="Add a meeting bot: paste a Google Meet, Teams or Zoom link and a visible CalMasta Assistant will join, record and hand you a transcript."
      />
      <CaptureTabs active="meeting" />
      {process.env.NODE_ENV !== "production" && (
        <p className="max-w-2xl rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
          Development mode: meeting requests are accepted and tracked, but no assistant actually joins a meeting until a capture provider is connected.
        </p>
      )}
      <CaptureForm />
    </div>
  );
}
