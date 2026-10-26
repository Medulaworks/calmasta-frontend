import { Suspense } from "react";
import { CaptureDetail } from "@/components/capture-detail";

export const metadata = { title: "Recording · Mojooba" };

async function Detail(props: PageProps<"/captures/[id]">) {
  const { id } = await props.params;
  return <CaptureDetail id={id} devTools={process.env.NODE_ENV !== "production"} />;
}

export default function CapturePage(props: PageProps<"/captures/[id]">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
      <Detail {...props} />
    </Suspense>
  );
}
