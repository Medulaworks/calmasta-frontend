import { CaptureOperationsView } from "@/components/admin/capture-operations-view";
import { Breadcrumb } from "@/components/ui/breadcrumb";

export function generateMetadata() {
  return { title: `Recording — Admin` };
}

export default function Page({ params }: { params: { id: string } }) {
  return (
    <div className="space-y-5">
      <Breadcrumb items={[{ label: "Recordings", href: "/admin/captures" }, { label: "Recording details" }]} />
      <CaptureOperationsView id={params.id} />
    </div>
  );
}
