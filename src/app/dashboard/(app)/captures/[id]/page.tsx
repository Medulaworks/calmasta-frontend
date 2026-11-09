import { Suspense } from "react";
import { SkeletonDetail } from "@/components/ui/skeleton";
import { LibraryRecording } from "@/components/library-recording";

export const metadata = { title: "Recording · Jooba" };

async function Detail(props: PageProps<"/dashboard/captures/[id]">) {
  const { id } = await props.params;
  return <LibraryRecording key={id} id={id} />;
}

export default function CapturePage(
  props: PageProps<"/dashboard/captures/[id]">,
) {
  return (
    <Suspense fallback={<SkeletonDetail label="Loading this recording" />}>
      <Detail {...props} />
    </Suspense>
  );
}
