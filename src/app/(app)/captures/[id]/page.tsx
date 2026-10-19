import { Suspense } from "react";
import { CaptureDetail } from "@/components/capture-detail";

async function Detail(props: PageProps<"/captures/[id]">) {
  const { id } = await props.params;
  return <CaptureDetail id={id} />;
}

export default function CapturePage(props: PageProps<"/captures/[id]">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
      <Detail {...props} />
    </Suspense>
  );
}
