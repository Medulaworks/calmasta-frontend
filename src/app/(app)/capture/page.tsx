import { CaptureForm } from "@/components/capture-form";
import { PageHeader } from "@/components/ui/page-header";

export const metadata = { title: "Capture · Calmaster" };

export default function CapturePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Capture"
        description="Paste a Google Meet, Teams or Zoom link and a visible Calmaster assistant will join, record and hand you a transcript."
      />
      {process.env.NODE_ENV !== "production" && (
        <p className="max-w-2xl rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
          Development mode: meeting requests are accepted and tracked, but no assistant actually joins a meeting until a capture provider is connected.
        </p>
      )}
      <CaptureForm />
    </div>
  );
}
