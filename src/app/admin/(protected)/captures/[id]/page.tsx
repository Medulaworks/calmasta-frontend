import { CaptureOperationsView } from "@/components/admin/capture-operations-view";

export function generateMetadata() {
  return { title: `Capture — Admin` };
}

export default function Page({ params }: { params: { id: string } }) {
  return <CaptureOperationsView id={params.id} />;
}
