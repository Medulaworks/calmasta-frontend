import { Suspense } from "react";
import { LibraryRecording } from "@/components/library-recording";

export const metadata = { title: "Recording · Mojooba" };

async function Detail(props: PageProps<"/captures/[id]">) {
  const { id } = await props.params;
  return <LibraryRecording key={id} id={id} />;
}

export default function CapturePage(props: PageProps<"/captures/[id]">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
      <Detail {...props} />
    </Suspense>
  );
}
